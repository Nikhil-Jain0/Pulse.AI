(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     View routing
  --------------------------------------------------------------------- */
  const views = {
    landing: document.getElementById('view-landing'),
    assessment: document.getElementById('view-assessment'),
    loading: document.getElementById('view-loading'),
    result: document.getElementById('view-result'),
  };

  function showView(name) {
    Object.values(views).forEach((v) => v.classList.remove('view-active'));
    views[name].classList.add('view-active');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------------------------------------------------------------------
     State
  --------------------------------------------------------------------- */
  const formData = {
    Age: 45, Sex: null, ChestPainType: null, RestingBP: 130, Cholesterol: 220,
    FastingBS: null, RestingECG: null, MaxHR: 150, ExerciseAngina: null,
    Oldpeak: 1.0, ST_Slope: null,
  };

  const TOTAL_STEPS = 5;
  let currentStep = 1;

  /* ---------------------------------------------------------------------
     Landing -> Assessment
  --------------------------------------------------------------------- */
  document.getElementById('btn-start').addEventListener('click', () => {
    showView('assessment');
  });
  document.getElementById('btn-back-landing').addEventListener('click', () => {
    showView('landing');
  });

  /* ---------------------------------------------------------------------
     Progress steps UI
  --------------------------------------------------------------------- */
  const stepNames = ['Personal', 'Symptoms', 'Vitals', 'Clinical', 'ECG'];
  const progressStepsEl = document.getElementById('progress-steps');
  stepNames.forEach((n, i) => {
    const span = document.createElement('span');
    span.textContent = n;
    span.dataset.step = i + 1;
    progressStepsEl.appendChild(span);
  });
  document.getElementById('step-total').textContent = TOTAL_STEPS;

  function updateProgressUI() {
    document.getElementById('step-current').textContent = currentStep;
    document.getElementById('progress-fill').style.width = (currentStep / TOTAL_STEPS) * 100 + '%';
    [...progressStepsEl.children].forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle('active', s === currentStep);
      el.classList.toggle('done', s < currentStep);
    });
  }

  /* ---------------------------------------------------------------------
     Sliders
  --------------------------------------------------------------------- */
  function bindSlider(id, formatFn) {
    const input = document.getElementById(id);
    const out = document.getElementById(id + '-out');
    function refresh() {
      const min = Number(input.min), max = Number(input.max), val = Number(input.value);
      input.style.setProperty('--val', ((val - min) / (max - min)) * 100 + '%');
      out.textContent = formatFn ? formatFn(val) : val;
      formData[id] = val;
    }
    input.addEventListener('input', refresh);
    refresh();
  }
  bindSlider('Age');
  bindSlider('RestingBP');
  bindSlider('MaxHR');
  bindSlider('Cholesterol');
  bindSlider('Oldpeak', (v) => v.toFixed(1));

  /* ---------------------------------------------------------------------
     Segmented + card-select controls
  --------------------------------------------------------------------- */
  function bindChoiceGroup(selector, className) {
    document.querySelectorAll(selector).forEach((group) => {
      const name = group.dataset.name;
      const hidden = group.parentElement.querySelector(`input[type="hidden"][name="${name}"]`);
      group.querySelectorAll(`.${className}`).forEach((btn) => {
        btn.addEventListener('click', () => {
          group.querySelectorAll(`.${className}`).forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          hidden.value = btn.dataset.value;
          formData[name] = btn.dataset.value;
          clearStepError();
        });
      });
    });
  }
  bindChoiceGroup('.segmented', 'seg-btn');
  bindChoiceGroup('.card-select', 'opt-card');

  /* ---------------------------------------------------------------------
     Step navigation + validation
  --------------------------------------------------------------------- */
  const stepEls = [...document.querySelectorAll('.step')];
  const btnNext = document.getElementById('btn-next');
  const btnPrev = document.getElementById('btn-prev');

  const stepFieldMap = {
    1: ['Sex'],
    2: ['ChestPainType', 'ExerciseAngina'],
    3: [],
    4: ['FastingBS', 'RestingECG'],
    5: ['ST_Slope'],
  };

  function clearStepError() {
    const existing = document.querySelector('.step-error');
    if (existing) existing.remove();
  }

  function showStepError(msg) {
    clearStepError();
    const active = stepEls[currentStep - 1];
    const div = document.createElement('div');
    div.className = 'step-error';
    div.style.cssText = 'margin-top:-16px;margin-bottom:24px;color:#ff3b5c;font-size:13px;font-weight:600;';
    div.textContent = msg;
    active.appendChild(div);
  }

  function validateStep(step) {
    const required = stepFieldMap[step];
    for (const field of required) {
      if (formData[field] === null || formData[field] === undefined) {
        return `Please select an option to continue.`;
      }
    }
    return null;
  }

  function goToStep(step) {
    const outgoing = stepEls[currentStep - 1];
    outgoing.classList.remove('step-active');
    currentStep = step;
    const incoming = stepEls[currentStep - 1];
    incoming.classList.add('step-active');
    updateProgressUI();
    btnPrev.disabled = currentStep === 1;
    btnNext.textContent = currentStep === TOTAL_STEPS ? 'See My Results' : 'Continue';
  }

  btnNext.addEventListener('click', () => {
    const error = validateStep(currentStep);
    if (error) { showStepError(error); return; }
    clearStepError();

    if (currentStep < TOTAL_STEPS) {
      goToStep(currentStep + 1);
    } else {
      runPrediction(formData).then((result) => {
        renderResults(formData, result);
        showView('result');
      });
    }
  });

  btnPrev.addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  // init
  stepEls[0].classList.add('step-active');
  updateProgressUI();

  /* ---------------------------------------------------------------------
     Loading screen sequence + API call
  --------------------------------------------------------------------- */
  const loadingMessages = [
    'Analyzing cardiovascular profile...',
    'Evaluating risk factors...',
    'Calculating prediction...',
    'Generating recommendations...',
  ];

  async function runPrediction(payload) {
    showView('loading');
    const loadingTextEl = document.getElementById('loading-text');
    let msgIndex = 0;
    loadingTextEl.textContent = loadingMessages[0];
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % loadingMessages.length;
      loadingTextEl.style.opacity = 0;
      setTimeout(() => {
        loadingTextEl.textContent = loadingMessages[msgIndex];
        loadingTextEl.style.opacity = 1;
      }, 220);
    }, 850);

    const minWait = new Promise((res) => setTimeout(res, 2600));
    const apiCall = callPredictAPI(payload);

    try {
      const [result] = await Promise.all([apiCall, minWait]);
      clearInterval(interval);
      return result;
    } catch (err) {
      clearInterval(interval);
      throw err;
    }
  }

  async function callPredictAPI(payload) {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Prediction failed.' }));
      throw new Error(err.error || 'Prediction failed.');
    }
    return res.json();
  }

  /* ---------------------------------------------------------------------
     Results rendering
  --------------------------------------------------------------------- */
  function renderResults(data, result) {
    const risk = result.risk_percent;
    const isHigh = result.prediction === 1;

    // Meter
    const CIRC = 2 * Math.PI * 96;
    const fillEl = document.getElementById('meter-fill');
    fillEl.style.strokeDasharray = CIRC;
    fillEl.style.strokeDashoffset = CIRC;
    const color = risk >= 66 ? '#ff3b5c' : risk >= 33 ? '#ff9f43' : '#33d17a';
    requestAnimationFrame(() => {
      fillEl.style.stroke = color;
      fillEl.style.strokeDashoffset = CIRC - (CIRC * risk) / 100;
    });

    animateNumber(document.getElementById('risk-percent'), risk);
    document.getElementById('risk-label').textContent = isHigh ? 'Elevated Risk' : 'Low Risk';

    renderFactorGrid(data);
    const { positives, concerns } = classifyFactors(data);
    renderIndicatorList('positive-list', positives, 'good');
    renderIndicatorList('concern-list', concerns, 'bad');
    renderRecommendations(concerns, data);
    renderSimulator(data, risk);
  }

  function animateNumber(el, target) {
    const start = 0, duration = 1400, t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (start + (target - start) * eased).toFixed(1) + '%';
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderFactorGrid(d) {
    const items = [
      { label: 'Age', value: `${d.Age} yrs` },
      { label: 'Sex', value: d.Sex === 'M' ? 'Male' : 'Female' },
      { label: 'Blood Pressure', value: `${d.RestingBP} mmHg` },
      { label: 'Cholesterol', value: `${d.Cholesterol} mg/dl` },
      { label: 'Max Heart Rate', value: `${d.MaxHR} bpm` },
      { label: 'ST Depression', value: `${Number(d.Oldpeak).toFixed(1)} mm` },
    ];
    const grid = document.getElementById('factor-grid');
    grid.innerHTML = items.map((it) => `
      <div class="factor-card">
        <div class="fc-label">${it.label}</div>
        <div class="fc-value">${it.value}</div>
      </div>
    `).join('');
  }

  function classifyFactors(d) {
    const positives = [];
    const concerns = [];
    const expectedMaxHR = 220 - Number(d.Age);

    if (Number(d.Cholesterol) >= 240) concerns.push('Cholesterol is in the high range (≥ 240 mg/dl), a well-established cardiovascular risk factor.');
    else if (Number(d.Cholesterol) < 200) positives.push('Cholesterol is within the desirable range (< 200 mg/dl).');
    else positives.push('Cholesterol is borderline — worth monitoring, but not yet high.');

    if (Number(d.RestingBP) >= 140) concerns.push('Resting blood pressure is elevated (≥ 140 mmHg), consistent with hypertension.');
    else if (Number(d.RestingBP) < 130) positives.push('Resting blood pressure is within a healthy range.');

    if (d.FastingBS === '1') concerns.push('Fasting blood sugar is above 120 mg/dl, an indicator linked to diabetes risk.');
    else positives.push('Fasting blood sugar is within normal limits.');

    if (Number(d.MaxHR) < expectedMaxHR * 0.85) concerns.push('Maximum heart rate achieved is lower than typically expected for your age, which can reflect reduced cardiovascular fitness.');
    else positives.push('Maximum heart rate achieved is strong for your age group.');

    if (d.ExerciseAngina === 'Y') concerns.push('Exercise-induced angina was reported — chest pain during exertion is a notable cardiac symptom.');
    else positives.push('No angina reported during exercise.');

    if (Number(d.Oldpeak) >= 2) concerns.push('ST depression (Oldpeak) is significantly elevated, often associated with reduced blood flow to the heart.');
    else if (Number(d.Oldpeak) <= 0.5) positives.push('ST depression (Oldpeak) is minimal.');

    if (d.ST_Slope === 'Flat' || d.ST_Slope === 'Down') concerns.push(`A ${d.ST_Slope.toLowerCase()} ST segment slope is associated with increased cardiac risk.`);
    else if (d.ST_Slope === 'Up') positives.push('An upsloping ST segment is generally the healthiest pattern.');

    if (d.ChestPainType === 'ASY') concerns.push('Asymptomatic chest pain classification — perhaps counterintuitively, this pattern is associated with higher risk in clinical data.');
    else positives.push('Reported chest pain type is not the highest-risk classification.');

    return { positives, concerns };
  }

  function renderIndicatorList(elId, items, kind) {
    const el = document.getElementById(elId);
    const icon = kind === 'good'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#33d17a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L14.7 3.86a2 2 0 00-3.4 0z" stroke="#ff3b5c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    if (items.length === 0) {
      el.innerHTML = `<div class="indicator-item">Nothing notable in this category.</div>`;
      return;
    }
    el.innerHTML = items.map((txt) => `
      <div class="indicator-item ${kind}">${icon}<span>${txt}</span></div>
    `).join('');
  }

  function renderRecommendations(concerns, d) {
    const recs = [];
    if (Number(d.Cholesterol) >= 200) recs.push({ h: 'Review cholesterol with your doctor', p: 'A lipid panel and dietary adjustment (fiber, unsaturated fats) can meaningfully lower LDL cholesterol over 8–12 weeks.' });
    if (Number(d.RestingBP) >= 130) recs.push({ h: 'Monitor blood pressure regularly', p: 'Track resting BP weekly; reducing sodium intake and managing stress are proven first steps.' });
    if (Number(d.MaxHR) < (220 - Number(d.Age)) * 0.85) recs.push({ h: 'Build cardiovascular fitness gradually', p: '150 minutes of moderate aerobic activity per week improves heart rate reserve over time.' });
    if (d.ExerciseAngina === 'Y' || Number(d.Oldpeak) >= 1) recs.push({ h: 'Discuss exertional symptoms with a cardiologist', p: 'Chest discomfort during activity and ST depression both warrant a clinical stress test.' });
    recs.push({ h: 'Schedule a routine cardiac check-up', p: 'Annual screening catches changes early — especially valuable alongside the factors above.' });

    const el = document.getElementById('recommendation-timeline');
    el.innerHTML = recs.map((r, i) => `
      <div class="timeline-item">
        <div class="timeline-marker">
          <div class="timeline-dot"></div>
          ${i < recs.length - 1 ? '<div class="timeline-line"></div>' : ''}
        </div>
        <div class="timeline-content">
          <h4>${r.h}</h4>
          <p>${r.p}</p>
        </div>
      </div>
    `).join('');
  }

  /* ---------------------------------------------------------------------
     What-if simulator — each row toggles ONE change against the baseline
     profile and calls the API to get the resulting risk.
  --------------------------------------------------------------------- */
  const SIM_SCENARIOS = [
    {
      key: 'chol', label: 'Reduce cholesterol by 40 mg/dl',
      applicable: (d) => Number(d.Cholesterol) > 160,
      apply: (d) => ({ ...d, Cholesterol: Math.max(120, Number(d.Cholesterol) - 40) }),
    },
    {
      key: 'bp', label: 'Lower resting blood pressure by 15 mmHg',
      applicable: (d) => Number(d.RestingBP) > 100,
      apply: (d) => ({ ...d, RestingBP: Math.max(90, Number(d.RestingBP) - 15) }),
    },
    {
      key: 'fitness', label: 'Increase exercise capacity (Max HR +15 bpm)',
      applicable: (d) => Number(d.MaxHR) < 200,
      apply: (d) => ({ ...d, MaxHR: Math.min(202, Number(d.MaxHR) + 15) }),
    },
    {
      key: 'angina', label: 'Resolve exercise-induced angina',
      applicable: (d) => d.ExerciseAngina === 'Y',
      apply: (d) => ({ ...d, ExerciseAngina: 'N' }),
    },
    {
      key: 'oldpeak', label: 'Reduce ST depression (Oldpeak) by 1.0',
      applicable: (d) => Number(d.Oldpeak) > 0.5,
      apply: (d) => ({ ...d, Oldpeak: Math.max(0, Number(d.Oldpeak) - 1) }),
    },
  ];

  async function renderSimulator(baseline, baselineRisk) {
    const scenarios = SIM_SCENARIOS.filter((s) => s.applicable(baseline));
    const el = document.getElementById('simulator');

    if (scenarios.length === 0) {
      el.innerHTML = `<div class="sim-row"><div class="sim-info"><strong>No further improvements to simulate</strong><span>Your profile is already near-optimal on the modeled factors.</span></div></div>`;
      return;
    }

    el.innerHTML = scenarios.map((s) => `
      <div class="sim-row" data-key="${s.key}">
        <div class="sim-info">
          <strong>${s.label}</strong>
          <span>Toggle to simulate</span>
        </div>
        <div class="sim-result">
          <span class="sim-baseline">${baselineRisk.toFixed(1)}%</span>
          <span class="sim-arrow">→</span>
          <span class="sim-new">—</span>
          <div class="sim-toggle" role="switch" aria-checked="false" tabindex="0"></div>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.sim-row').forEach((row) => {
      const key = row.dataset.key;
      const scenario = scenarios.find((s) => s.key === key);
      const toggle = row.querySelector('.sim-toggle');
      const newEl = row.querySelector('.sim-new');
      let cache = null;
      let on = false;

      async function activate() {
        toggle.classList.add('on');
        newEl.textContent = '…';
        if (cache === null) {
          try {
            const modified = scenario.apply(baseline);
            const res = await callPredictAPI(modified);
            cache = res.risk_percent;
          } catch (e) {
            newEl.textContent = 'N/A';
            return;
          }
        }
        newEl.textContent = cache.toFixed(1) + '%';
        newEl.className = 'sim-new ' + (cache < baselineRisk ? 'sim-badge better' : cache > baselineRisk ? 'sim-badge worse' : '');
      }
      function deactivate() {
        toggle.classList.remove('on');
        newEl.textContent = '—';
        newEl.className = 'sim-new';
      }

      function toggleHandler() {
        on = !on;
        toggle.setAttribute('aria-checked', String(on));
        on ? activate() : deactivate();
      }
      toggle.addEventListener('click', toggleHandler);
      toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHandler(); }
      });
    });
  }

  /* ---------------------------------------------------------------------
     Restart
  --------------------------------------------------------------------- */
  document.getElementById('btn-restart').addEventListener('click', () => {
    showView('landing');
  });

})();
