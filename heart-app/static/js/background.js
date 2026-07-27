/* Ambient living background: a slowly beating line-art heart with
   expanding pulse rings and drifting particles. Pure canvas, no deps. */
(function () {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W, H, DPR;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // Heart path in a local -100..100 coordinate space (anatomical-ish, minimal line-art)
  function heartPath(scale, cx, cy) {
    const p = new Path2D();
    p.moveTo(cx, cy + 60 * scale);
    p.bezierCurveTo(cx - 70 * scale, cy + 10 * scale, cx - 95 * scale, cy - 40 * scale, cx - 55 * scale, cy - 70 * scale);
    p.bezierCurveTo(cx - 25 * scale, cy - 92 * scale, cx - 5 * scale, cy - 65 * scale, cx, cy - 40 * scale);
    p.bezierCurveTo(cx + 5 * scale, cy - 65 * scale, cx + 25 * scale, cy - 92 * scale, cx + 55 * scale, cy - 70 * scale);
    p.bezierCurveTo(cx + 95 * scale, cy - 40 * scale, cx + 70 * scale, cy + 10 * scale, cx, cy + 60 * scale);
    p.closePath();
    return p;
  }

  // Particles
  const PARTICLE_COUNT = 26;
  const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.6 + Math.random() * 1.6,
    speed: 0.05 + Math.random() * 0.1,
    phase: Math.random() * Math.PI * 2,
    drift: Math.random() * 0.4 - 0.2,
  }));

  // Pulse rings, spawned on each beat
  let rings = [];

  let t0 = performance.now();
  const BEAT_INTERVAL = 1100; // ms, "lub-dub" cycle
  let lastBeatIndex = -1;

  function heartScaleAt(msIntoBeat) {
    // two-pulse "lub-dub" easing within BEAT_INTERVAL
    const x = msIntoBeat / BEAT_INTERVAL;
    const lub = Math.exp(-Math.pow((x - 0.08) * 14, 2)) * 1.0;
    const dub = Math.exp(-Math.pow((x - 0.24) * 14, 2)) * 0.6;
    return 1 + (lub + dub) * 0.09;
  }

  function draw(now) {
    const elapsed = now - t0;
    ctx.clearRect(0, 0, W, H);

    const cx = W * 0.72;
    const cy = H * 0.42;
    const baseScale = Math.min(W, H) * 0.0038;

    const msIntoBeat = elapsed % BEAT_INTERVAL;
    const beatIndex = Math.floor(elapsed / BEAT_INTERVAL);
    const scaleMul = reduceMotion ? 1 : heartScaleAt(msIntoBeat);

    if (!reduceMotion && beatIndex !== lastBeatIndex) {
      lastBeatIndex = beatIndex;
      rings.push({ born: now, cx, cy });
      if (rings.length > 4) rings.shift();
    }

    // pulse rings
    rings.forEach((ring) => {
      const age = (now - ring.born) / 900;
      if (age > 1) return;
      const r = (60 + age * 220) * baseScale;
      ctx.beginPath();
      ctx.arc(ring.cx, ring.cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,59,92,${0.22 * (1 - age)})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });
    rings = rings.filter((r) => (now - r.born) / 900 <= 1);

    // soft glow behind heart
    const glowR = 220 * baseScale * scaleMul;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    grad.addColorStop(0, `rgba(255,59,92,${0.14 + (scaleMul - 1) * 1.4})`);
    grad.addColorStop(1, 'rgba(255,59,92,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();

    // heart line-art
    const path = heartPath(baseScale * scaleMul, cx, cy);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1.3;
    ctx.stroke(path);
    ctx.strokeStyle = `rgba(255,59,92,${0.28 + (scaleMul - 1) * 3})`;
    ctx.lineWidth = 1.3;
    ctx.stroke(path);

    // particles
    particles.forEach((p) => {
      const px = p.x * W + Math.sin(elapsed * 0.0003 + p.phase) * 30 * p.drift;
      const py = (p.y * H - (elapsed * p.speed * 0.02) % H + H) % H;
      const flicker = 0.3 + 0.3 * Math.sin(elapsed * 0.002 + p.phase);
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,120,140,${reduceMotion ? 0.25 : flicker})`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
