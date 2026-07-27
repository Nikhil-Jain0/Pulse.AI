/* Premium cursor: a semi-transparent red "plasma" trail that follows the
   mouse using a chain of spring-lagged points, plus a tiny heartbeat pulse
   on hover over interactive elements. */
(function () {
  const canvas = document.getElementById('cursor-canvas');
  if (!canvas) return;
  const isTouch = window.matchMedia('(hover: none)').matches || window.innerWidth < 820;
  if (isTouch) return;

  const ctx = canvas.getContext('2d');
  let W, H, DPR;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const POINTS = 14;
  const chain = Array.from({ length: POINTS }, () => ({ x: W / 2, y: H / 2 }));
  let mouse = { x: W / 2, y: H / 2 };
  let hoverPulse = 0;

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
  });

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('button, input, .opt-card, .seg-btn, a')) hoverPulse = 1;
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('button, input, .opt-card, .seg-btn, a')) hoverPulse = 0;
  });

  function animate() {
    chain[0].x += (mouse.x - chain[0].x) * 0.35;
    chain[0].y += (mouse.y - chain[0].y) * 0.35;
    for (let i = 1; i < POINTS; i++) {
      chain[i].x += (chain[i - 1].x - chain[i].x) * 0.32;
      chain[i].y += (chain[i - 1].y - chain[i].y) * 0.32;
    }

    ctx.clearRect(0, 0, W, H);

    // flowing plasma ribbon
    ctx.beginPath();
    ctx.moveTo(chain[0].x, chain[0].y);
    for (let i = 1; i < POINTS - 1; i++) {
      const xc = (chain[i].x + chain[i + 1].x) / 2;
      const yc = (chain[i].y + chain[i + 1].y) / 2;
      ctx.quadraticCurveTo(chain[i].x, chain[i].y, xc, yc);
    }
    const grad = ctx.createLinearGradient(chain[0].x, chain[0].y, chain[POINTS - 1].x, chain[POINTS - 1].y);
    grad.addColorStop(0, 'rgba(255,59,92,0.55)');
    grad.addColorStop(1, 'rgba(255,59,92,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // dot core
    const pulseR = 5 + hoverPulse * (2 + Math.sin(performance.now() * 0.012) * 1.5);
    ctx.beginPath();
    ctx.arc(chain[0].x, chain[0].y, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowColor = 'rgba(255,59,92,0.8)';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
