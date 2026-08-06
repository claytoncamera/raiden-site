/* ============================================================
   RAIDEN — hero visualizer
   Rising particle storm + procedural lightning strikes.
   Audio-reactive when the booth is playing; ambient when idle.
   ============================================================ */

(() => {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas) return;
  const ctx2d = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let bolts = [];
  let lastBoltAt = 0;
  let nextIdleBolt = 4000 + Math.random() * 6000;
  let accent = "#8b5cf6";
  let accent2 = "#22d3ee";

  function readTheme() {
    const styles = getComputedStyle(document.documentElement);
    accent = styles.getPropertyValue("--accent").trim() || accent;
    accent2 = styles.getPropertyValue("--accent-2").trim() || accent2;
  }
  readTheme();
  new MutationObserver(readTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-light"],
  });

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedParticles();
  }

  function seedParticles() {
    const count = reduceMotion ? 0 : (W < 700 ? 42 : 95);
    particles = Array.from({ length: count }, () => spawnParticle(true));
  }

  function spawnParticle(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 10,
      r: 0.6 + Math.random() * 1.8,
      vy: 0.15 + Math.random() * 0.5,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.003 + Math.random() * 0.008,
      alpha: 0.15 + Math.random() * 0.5,
      hue2: Math.random() < 0.3,
    };
  }

  /* ------- lightning ------- */
  function makeBolt() {
    const startX = W * (0.15 + Math.random() * 0.7);
    const segments = [];
    let x = startX;
    let y = -10;
    const endY = H * (0.45 + Math.random() * 0.3);
    while (y < endY) {
      const nx = x + (Math.random() - 0.5) * 46;
      const ny = y + 14 + Math.random() * 26;
      segments.push({ x1: x, y1: y, x2: nx, y2: ny });
      // occasional branch
      if (Math.random() < 0.22) {
        let bx = nx, by = ny;
        const dir = Math.random() < 0.5 ? -1 : 1;
        for (let i = 0; i < 2 + Math.random() * 3; i++) {
          const bx2 = bx + dir * (10 + Math.random() * 26);
          const by2 = by + 10 + Math.random() * 18;
          segments.push({ x1: bx, y1: by, x2: bx2, y2: by2, branch: true });
          bx = bx2; by = by2;
        }
      }
      x = nx; y = ny;
    }
    return { segments, born: performance.now(), life: 260 + Math.random() * 160 };
  }

  function strike() {
    bolts.push(makeBolt());
    if (Math.random() < 0.35) bolts.push(makeBolt());
    lastBoltAt = performance.now();
    nextIdleBolt = 5000 + Math.random() * 8000;
  }

  /* ------- main loop ------- */
  let smoothedLow = 0;
  function frame(now) {
    ctx2d.clearRect(0, 0, W, H);

    // backdrop gradient depth
    const grad = ctx2d.createRadialGradient(W / 2, H * 1.15, H * 0.1, W / 2, H * 1.15, H * 1.4);
    grad.addColorStop(0, hexA(accent, 0.10));
    grad.addColorStop(0.5, hexA(accent, 0.03));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, W, H);

    // audio drive
    let low = 0;
    if (window.RaidenAudio && RaidenAudio.ready && RaidenAudio.anyPlaying()) {
      const b = RaidenAudio.bands();
      low = b.low;
      // kick-triggered strikes (cooldown keeps it classy)
      if (low > 0.55 && now - lastBoltAt > 2600) strike();
    } else if (!reduceMotion && now - lastBoltAt > nextIdleBolt) {
      strike();
    }
    smoothedLow += (low - smoothedLow) * 0.12;

    // particles
    if (!reduceMotion) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.sway += p.swaySpeed;
        p.x += Math.sin(p.sway) * 0.35;
        p.y -= p.vy * (1 + smoothedLow * 2.2);
        if (p.y < -12) particles[i] = spawnParticle(false);
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.r * (1 + smoothedLow * 0.8), 0, Math.PI * 2);
        ctx2d.fillStyle = hexA(p.hue2 ? accent2 : accent, p.alpha * (0.55 + smoothedLow * 0.6));
        ctx2d.fill();
      }
    }

    // bolts
    const alive = [];
    for (const bolt of bolts) {
      const age = now - bolt.born;
      if (age > bolt.life) continue;
      alive.push(bolt);
      const fade = 1 - age / bolt.life;
      const flicker = 0.7 + Math.random() * 0.3;

      // screen flash on fresh strikes
      if (age < 90) {
        ctx2d.fillStyle = hexA(accent, 0.05 * fade * flicker);
        ctx2d.fillRect(0, 0, W, H);
      }

      ctx2d.lineCap = "round";
      for (const s of bolt.segments) {
        // glow pass
        ctx2d.strokeStyle = hexA(accent, 0.28 * fade * flicker);
        ctx2d.lineWidth = s.branch ? 4 : 7;
        ctx2d.beginPath();
        ctx2d.moveTo(s.x1, s.y1);
        ctx2d.lineTo(s.x2, s.y2);
        ctx2d.stroke();
        // core pass
        ctx2d.strokeStyle = `rgba(255,255,255,${0.85 * fade * flicker})`;
        ctx2d.lineWidth = s.branch ? 1 : 1.8;
        ctx2d.beginPath();
        ctx2d.moveTo(s.x1, s.y1);
        ctx2d.lineTo(s.x2, s.y2);
        ctx2d.stroke();
      }
    }
    bolts = alive;

    requestAnimationFrame(frame);
  }

  function hexA(hex, a) {
    hex = hex.trim();
    if (hex.startsWith("#")) {
      const n = parseInt(hex.length === 4
        ? hex.slice(1).split("").map((c) => c + c).join("")
        : hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    return hex;
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  // let other modules trigger a strike (e.g. Drop-the-beat CTA)
  window.RaidenStrike = strike;
})();
