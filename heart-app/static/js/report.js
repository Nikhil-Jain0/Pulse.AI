/**
 * report.js
 *
 * Adds a "Download PDF Report" button to the results page and generates a
 * clean, print-friendly, black-and-white A4 PDF using jsPDF + jspdf-autotable
 * (loaded from CDN at runtime).
 *
 * This file is fully self-contained and additive:
 *   - It does NOT modify app.js, background.js, style.css, or app.py.
 *   - It reads assessment data directly from the existing DOM (the same
 *     hidden inputs / sliders / result elements app.js already populates).
 *   - It injects its own button into the results footer at runtime.
 */
(function () {
  'use strict';

  const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';

  let librariesLoaded = false;
  let loadingPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function ensureLibraries() {
    if (librariesLoaded) return Promise.resolve();
    if (loadingPromise) return loadingPromise;
    loadingPromise = loadScript(JSPDF_URL)
      .then(() => loadScript(AUTOTABLE_URL))
      .then(() => { librariesLoaded = true; });
    return loadingPromise;
  }

  /* ==========================================================================
   * Layout constants
   * ======================================================================== */
  const PAGE = { marginX: 20, marginTop: 18, marginBottom: 20 };
  const COLOR = {
    black: '#000000', darkGray: '#333333', midGray: '#666666',
    lightGray: '#999999', ruleGray: '#cccccc',
  };
  const FONT = { title: 18, subtitle: 10, sectionHeading: 12, body: 10, small: 8, riskPercent: 40, riskLabel: 13 };
  const SPACING = { afterTitle: 6, afterMetaLine: 5, afterDivider: 8, afterSectionHeading: 7, betweenSections: 12, lineHeight: 5.5, bulletIndent: 5 };

  const CHEST_PAIN_LABELS = { ATA: 'Atypical Angina', NAP: 'Non-Anginal Pain', ASY: 'Asymptomatic', TA: 'Typical Angina' };
  const RESTING_ECG_LABELS = { Normal: 'Normal', ST: 'ST-T Wave Abnormality', LVH: 'Left Ventricular Hypertrophy' };
  const ST_SLOPE_LABELS = { Up: 'Upsloping', Flat: 'Flat', Down: 'Downsloping' };

  /* ==========================================================================
   * Helpers
   * ======================================================================== */
  function humanize(map, code) { return map[code] || code; }
  function formatSex(sex) { return sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : sex; }
  function formatYesNo(v) { return v === 'Y' ? 'Yes' : v === 'N' ? 'No' : v; }
  function formatFastingBS(v) { return v === '1' ? 'Yes (> 120 mg/dl)' : 'No (\u2264 120 mg/dl)'; }

  function generateReportId() {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `HR-${stamp}-${rand}`;
  }
  function formatDate(date) { return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
  function formatTime(date) { return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }

  function getRiskCategory(riskPercent) {
    if (riskPercent < 25) return 'Low';
    if (riskPercent < 50) return 'Moderate';
    if (riskPercent < 75) return 'High';
    return 'Very High';
  }

  function getSummaryText(riskPercent, category) {
    const phrase = {
      Low: 'a low estimated cardiovascular risk',
      Moderate: 'a moderate estimated cardiovascular risk',
      High: 'a high estimated cardiovascular risk',
      'Very High': 'a very high estimated cardiovascular risk',
    }[category];
    return `The submitted clinical indicators suggest ${phrase} (${riskPercent.toFixed(1)}%). ` +
      `This assessment is generated using a machine learning model and should be interpreted ` +
      `alongside professional medical evaluation.`;
  }

  /* ==========================================================================
   * Page-break-aware cursor
   * ======================================================================== */
  function PageCursor(doc) {
    this.doc = doc;
    this.pageHeight = doc.internal.pageSize.getHeight();
    this.y = PAGE.marginTop;
  }
  PageCursor.prototype.ensureSpace = function (requiredHeight) {
    const bottomLimit = this.pageHeight - PAGE.marginBottom;
    if (this.y + requiredHeight > bottomLimit) {
      this.doc.addPage();
      this.y = PAGE.marginTop;
    }
  };
  PageCursor.prototype.advance = function (amount) { this.y += amount; };

  /* ==========================================================================
   * Section builders (ported from generatePDF.ts)
   * ======================================================================== */
  function drawDivider(doc, cursor) {
    cursor.ensureSpace(SPACING.afterDivider);
    doc.setDrawColor(COLOR.ruleGray);
    doc.setLineWidth(0.3);
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.line(PAGE.marginX, cursor.y, pageWidth - PAGE.marginX, cursor.y);
    cursor.advance(SPACING.afterDivider);
  }

  function drawReportHeader(doc, cursor, data) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    const generatedAt = data.generatedAt || new Date();
    const reportId = data.reportId || generateReportId();

    doc.setTextColor(COLOR.black);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT.title);
    doc.text('Heart Attack Risk Assessment Report', centerX, cursor.y, { align: 'center' });
    cursor.advance(SPACING.afterTitle + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT.subtitle);
    doc.setTextColor(COLOR.midGray);

    [`Generated Date: ${formatDate(generatedAt)}`, `Generated Time: ${formatTime(generatedAt)}`, `Report ID: ${reportId}`]
      .forEach((line) => { doc.text(line, centerX, cursor.y, { align: 'center' }); cursor.advance(SPACING.afterMetaLine); });

    doc.setTextColor(COLOR.black);
    cursor.advance(2);
    drawDivider(doc, cursor);
  }

  function drawSectionHeading(doc, cursor, title) {
    cursor.ensureSpace(SPACING.afterSectionHeading + 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT.sectionHeading);
    doc.setTextColor(COLOR.black);
    doc.text(title, PAGE.marginX, cursor.y);
    cursor.advance(SPACING.afterSectionHeading);
  }

  function drawPatientInfoSection(doc, cursor, data) {
    drawSectionHeading(doc, cursor, '1. Patient Information');
    const pageWidth = doc.internal.pageSize.getWidth();
    const colWidth = (pageWidth - PAGE.marginX * 2) / 2;
    const leftColX = PAGE.marginX;
    const rightColX = PAGE.marginX + colWidth;

    cursor.ensureSpace(16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT.body);

    function drawField(x, label, value) {
      doc.setTextColor(COLOR.midGray);
      doc.text(label, x, cursor.y);
      doc.setTextColor(COLOR.black);
      doc.setFont('helvetica', 'bold');
      doc.text(value, x, cursor.y + 5.5);
      doc.setFont('helvetica', 'normal');
    }

    drawField(leftColX, 'Age', `${data.age} years`);
    drawField(rightColX, 'Sex', formatSex(data.sex));

    cursor.advance(16);
    drawDivider(doc, cursor);
  }

  function drawAssessmentResultSection(doc, cursor, data) {
    drawSectionHeading(doc, cursor, '2. Assessment Result');
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    const category = getRiskCategory(data.riskPercent);

    cursor.ensureSpace(FONT.riskPercent + FONT.riskLabel + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT.riskPercent);
    doc.setTextColor(COLOR.black);
    doc.text(`${data.riskPercent.toFixed(1)}%`, centerX, cursor.y + 14, { align: 'center' });
    cursor.advance(20);

    doc.setFontSize(FONT.riskLabel);
    doc.setTextColor(COLOR.darkGray);
    doc.text(`Risk Category: ${category.toUpperCase()}`, centerX, cursor.y, { align: 'center' });
    cursor.advance(10);

    doc.setFont('helvetica', 'normal');
    cursor.advance(4);
    drawDivider(doc, cursor);
    return category;
  }

  function drawClinicalInputsTable(doc, cursor, data) {
    drawSectionHeading(doc, cursor, '3. Submitted Clinical Inputs');

    const rows = [
      ['Age', `${data.age} years`],
      ['Sex', formatSex(data.sex)],
      ['Chest Pain Type', humanize(CHEST_PAIN_LABELS, data.chestPainType)],
      ['Resting Blood Pressure', `${data.restingBP} mmHg`],
      ['Cholesterol', `${data.cholesterol} mg/dl`],
      ['Fasting Blood Sugar', formatFastingBS(data.fastingBS)],
      ['Resting ECG', humanize(RESTING_ECG_LABELS, data.restingECG)],
      ['Maximum Heart Rate', `${data.maxHR} bpm`],
      ['Exercise Angina', formatYesNo(data.exerciseAngina)],
      ['Oldpeak', Number(data.oldpeak).toFixed(1)],
      ['ST Slope', humanize(ST_SLOPE_LABELS, data.stSlope)],
    ];

    doc.autoTable({
      startY: cursor.y,
      margin: { left: PAGE.marginX, right: PAGE.marginX },
      head: [['Feature', 'Value']],
      body: rows,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: FONT.body, textColor: COLOR.black, lineColor: COLOR.ruleGray, lineWidth: 0.2, cellPadding: 3 },
      headStyles: { fillColor: '#ffffff', textColor: COLOR.black, fontStyle: 'bold', lineColor: COLOR.black, lineWidth: 0.3 },
      alternateRowStyles: { fillColor: '#f5f5f5' },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 'auto' } },
    });

    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : cursor.y;
    cursor.y = finalY + SPACING.betweenSections;
  }

  function drawWrappedParagraph(doc, cursor, text) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const lines = doc.splitTextToSize(text, pageWidth - PAGE.marginX * 2);
    cursor.ensureSpace(lines.length * SPACING.lineHeight);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT.body);
    doc.setTextColor(COLOR.darkGray);
    lines.forEach((line) => { doc.text(line, PAGE.marginX, cursor.y); cursor.advance(SPACING.lineHeight); });
  }

  function drawSummarySection(doc, cursor, data, category) {
    drawSectionHeading(doc, cursor, '4. Summary');
    drawWrappedParagraph(doc, cursor, getSummaryText(data.riskPercent, category));
    cursor.advance(SPACING.betweenSections - SPACING.lineHeight);
    drawDivider(doc, cursor);
  }

  function drawRecommendationsSection(doc, cursor) {
    drawSectionHeading(doc, cursor, '5. Recommendations');
    const recommendations = [
      'Monitor blood pressure regularly.',
      'Maintain a balanced diet.',
      'Exercise regularly.',
      'Consult a qualified healthcare professional if necessary.',
    ];
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - PAGE.marginX * 2 - SPACING.bulletIndent;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT.body);
    doc.setTextColor(COLOR.darkGray);

    recommendations.forEach((item) => {
      const lines = doc.splitTextToSize(item, usableWidth);
      cursor.ensureSpace(lines.length * SPACING.lineHeight);
      doc.text('\u2022', PAGE.marginX, cursor.y);
      lines.forEach((line, idx) => doc.text(line, PAGE.marginX + SPACING.bulletIndent, cursor.y + idx * SPACING.lineHeight));
      cursor.advance(lines.length * SPACING.lineHeight);
    });

    cursor.advance(SPACING.betweenSections - SPACING.lineHeight);
    drawDivider(doc, cursor);
  }

  function drawDisclaimerSection(doc, cursor) {
    drawSectionHeading(doc, cursor, '6. Disclaimer');
    const disclaimer = 'This report is generated using an AI prediction model and is intended only ' +
      'for educational and informational purposes. It is not a medical diagnosis ' +
      'and should not replace professional medical advice.';
    const pageWidth = doc.internal.pageSize.getWidth();
    const lines = doc.splitTextToSize(disclaimer, pageWidth - PAGE.marginX * 2);

    cursor.ensureSpace(lines.length * (SPACING.lineHeight - 1.5));
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(FONT.small);
    doc.setTextColor(COLOR.lightGray);
    lines.forEach((line) => { doc.text(line, PAGE.marginX, cursor.y); cursor.advance(SPACING.lineHeight - 1.5); });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLOR.black);
  }

  function applyFooterToAllPages(doc) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 10;
    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT.small);
      doc.setTextColor(COLOR.lightGray);
      doc.text('HeartSense AI', PAGE.marginX, footerY);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - PAGE.marginX, footerY, { align: 'right' });
      doc.setDrawColor(COLOR.ruleGray);
      doc.setLineWidth(0.2);
      doc.line(PAGE.marginX, footerY - 4, pageWidth - PAGE.marginX, footerY - 4);
    }
  }

  function generateHeartReport(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cursor = new PageCursor(doc);

    drawReportHeader(doc, cursor, data);
    drawPatientInfoSection(doc, cursor, data);
    const category = drawAssessmentResultSection(doc, cursor, data);
    drawClinicalInputsTable(doc, cursor, data);
    drawSummarySection(doc, cursor, data, category);
    drawRecommendationsSection(doc, cursor);
    drawDisclaimerSection(doc, cursor);
    applyFooterToAllPages(doc);

    const fileId = data.reportId || generateReportId();
    doc.save(`Heart_Risk_Report_${fileId}.pdf`);
  }

  /* ==========================================================================
   * Read current assessment data straight from the existing DOM.
   * (No dependency on app.js internals — just reads the same hidden inputs,
   * sliders, and result elements app.js already populates.)
   * ======================================================================== */
  function readDataFromDOM() {
    function val(selector) {
      const el = document.querySelector(selector);
      return el ? el.value : '';
    }

    const riskText = document.getElementById('risk-percent').textContent.replace('%', '').trim();

    return {
      age: Number(document.getElementById('Age').value),
      sex: val('input[name="Sex"]'),
      chestPainType: val('input[name="ChestPainType"]'),
      restingBP: Number(document.getElementById('RestingBP').value),
      cholesterol: Number(document.getElementById('Cholesterol').value),
      fastingBS: val('input[name="FastingBS"]'),
      restingECG: val('input[name="RestingECG"]'),
      maxHR: Number(document.getElementById('MaxHR').value),
      exerciseAngina: val('input[name="ExerciseAngina"]'),
      oldpeak: Number(document.getElementById('Oldpeak').value),
      stSlope: val('input[name="ST_Slope"]'),
      riskPercent: Number(riskText) || 0,
    };
  }

  /* ==========================================================================
   * Inject a "Download PDF Report" button into the results footer whenever
   * the results view becomes active. Pure addition — no existing elements
   * are modified.
   * ======================================================================== */
  function injectButtonIfNeeded() {
    const footer = document.querySelector('.result-footer');
    if (!footer || document.getElementById('btn-download-pdf')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-download-pdf';
    btn.className = 'btn btn-primary';
    btn.type = 'button';
    btn.textContent = 'Download PDF Report';
    btn.style.marginRight = '12px';

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Preparing report...';
      try {
        await ensureLibraries();
        const data = readDataFromDOM();
        generateHeartReport(data);
      } catch (err) {
        console.error('PDF generation failed:', err);
        alert('Could not generate the PDF report. Please try again.');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    footer.insertBefore(btn, footer.firstChild);
  }

  const resultView = document.getElementById('view-result');
  if (resultView) {
    const observer = new MutationObserver(() => {
      if (resultView.classList.contains('view-active')) injectButtonIfNeeded();
    });
    observer.observe(resultView, { attributes: true, attributeFilter: ['class'] });
  }
})();
