/* ============================================================
   RAIDEN — stream stage scene
   Moving-head light beams behind the rig + crowd silhouettes
   in front of it. Audio-reactive; sleeps when off-screen.
   ============================================================ */

(() => {
  const stage = document.getElementById("streamStage");
  const beamsCanvas = document.getElementById("beamsCanvas");
  const crowdCanvas = document.getElementById("crowdCanvas");
  if (!stage || !beamsCanvas || !crowdCanvas) return;

  const STATIC = new URLSearchParams(location.search).has("static");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || STATIC;

  const bctx = beamsCanvas.getContext("2d");
  const cctx = crowdCanvas.getContext("2d");

  let accent = "#8b5cf6";
  let accent2 = "#22d3ee";
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    accent = s.getPropertyValue("--accent").trim() || accent;
    accent2 = s.getPropertyValue("--accent-2").trim() || accent2;
  }
  readTheme();
  new MutationObserver(() => { readTheme(); if (reduceMotion) drawStatic(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-light"] });

  /* ---------- geometry ---------- */
  let BW = 0, BH = 0, CW = 0, CH = 0;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let beams = [];
  let heads = [];

  function resize() {
    BW = beamsCanvas.clientWidth; BH = beamsCanvas.clientHeight;
    beamsCanvas.width = BW * dpr; beamsCanvas.height = BH * dpr;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    CW = crowdCanvas.clientWidth; CH = crowdCanvas.clientHeight;
    crowdCanvas.width = CW * dpr; crowdCanvas.height = CH * dpr;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // beams from a truss across the top
    beams = [
      { x: BW * 0.08, base: 0.55, range: 0.5, speed: 0.00023, phase: 0.0, color: () => accent },
      { x: BW * 0.34, base: 0.25, range: 0.6, speed: 0.00031, phase: 2.1, color: () => accent2 },
      { x: BW * 0.66, base: -0.25, range: 0.6, speed: 0.00027, phase: 4.0, color: () => accent },
      { x: BW * 0.92, base: -0.55, range: 0.5, speed: 0.00021, phase: 1.2, color: () => accent2 },
    ];

    // two rows of heads: back (smaller, lighter) + front (bigger, darker)
    heads = [];
    for (let x = 10; x < CW; x += 34 + Math.random() * 16) {
      heads.push(mkHead(x + Math.random() * 8, 9 + Math.random() * 4, "#0b0b14", 0));
    }
    for (let x = -6; x < CW; x += 44 + Math.random() * 20) {
      heads.push(mkHead(x + Math.random() * 10, 13 + Math.random() * 6, "#030308", 1));
    }
  }

  function mkHead(x, r, fill, front) {
    const roll = Math.random();
    return {
      x, r, fill, front,
      phase: Math.random() * Math.PI * 2,
      speed: 0.9 + Math.random() * 0.9,
      arm: roll < 0.16 ? "hand" : roll < 0.26 ? "phone" : null,
      armSide: Math.random() < 0.5 ? -1 : 1,
      armThresh: 0.42 + Math.random() * 0.25,
      armUp: 0, // eased 0..1
    };
  }

  /* ---------- drawing ---------- */
  function hexA(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function drawBeams(now, energy) {
    bctx.clearRect(0, 0, BW, BH);
    bctx.globalCompositeOperation = "lighter";
    const len = BH * 1.5;
    for (const b of beams) {
      const angle = b.base + Math.sin(now * b.speed + b.phase) * b.range * (reduceMotion ? 0 : 1);
      const alpha = 0.09 + energy * 0.2;
      bctx.save();
      bctx.translate(b.x, -6);
      bctx.rotate(angle);
      const grad = bctx.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, hexA(b.color(), alpha * 1.6));
      grad.addColorStop(0.7, hexA(b.color(), alpha * 0.45));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      bctx.fillStyle = grad;
      bctx.beginPath();
      bctx.moveTo(-2, 0);
      bctx.lineTo(2, 0);
      bctx.lineTo(26, len);
      bctx.lineTo(-26, len);
      bctx.closePath();
      bctx.fill();
      // fixture dot
      bctx.fillStyle = hexA(b.color(), 0.5 + energy * 0.5);
      bctx.beginPath();
      bctx.arc(0, 2, 2.4, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    }
    bctx.globalCompositeOperation = "source-over";
    // floor haze
    const haze = bctx.createRadialGradient(BW / 2, BH * 1.1, BH * 0.1, BW / 2, BH * 1.1, BH * 0.9);
    haze.addColorStop(0, hexA(accent, 0.05 + energy * 0.07));
    haze.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = haze;
    bctx.fillRect(0, 0, BW, BH);
  }

  function drawCrowd(now, energy) {
    cctx.clearRect(0, 0, CW, CH);
    for (const h of heads) {
      const bob = reduceMotion ? 0 : Math.sin(now * 0.0016 * h.speed + h.phase) * 2.2 + energy * 6;
      const baseY = CH - (h.front ? 0 : 14);
      const headY = baseY - h.r * 1.7 - bob;

      // arm (behind the head)
      const wantUp = !reduceMotion && h.arm && energy > h.armThresh;
      h.armUp += ((wantUp ? 1 : 0) - h.armUp) * 0.08;
      if (h.arm && h.armUp > 0.03) {
        const ax = h.x + h.armSide * h.r * 0.9;
        const reach = (h.r * 2.6) * h.armUp;
        const hy = headY - reach + Math.sin(now * 0.004 + h.phase) * 2 * h.armUp;
        cctx.strokeStyle = h.fill;
        cctx.lineWidth = Math.max(3, h.r * 0.38);
        cctx.lineCap = "round";
        cctx.beginPath();
        cctx.moveTo(ax, headY + h.r);
        cctx.lineTo(ax + h.armSide * 4, hy);
        cctx.stroke();
        if (h.arm === "phone") {
          cctx.fillStyle = hexA(accent2, 0.75 * h.armUp);
          cctx.shadowColor = accent2;
          cctx.shadowBlur = 8 * h.armUp;
          cctx.fillRect(ax + h.armSide * 4 - 3, hy - 9, 6, 10);
          cctx.shadowBlur = 0;
        } else {
          cctx.fillStyle = h.fill;
          cctx.beginPath();
          cctx.arc(ax + h.armSide * 4, hy - 2, h.r * 0.3, 0, Math.PI * 2);
          cctx.fill();
        }
      }

      // head + shoulders
      cctx.fillStyle = h.fill;
      cctx.beginPath();
      cctx.arc(h.x, headY, h.r, 0, Math.PI * 2);
      cctx.fill();
      cctx.beginPath();
      cctx.ellipse(h.x, baseY + h.r * 0.6, h.r * 1.9, h.r * 1.5, 0, Math.PI, 0);
      cctx.fill();
    }
  }

  /* ---------- loop ---------- */
  let onScreen = false;
  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
  }, { threshold: 0.05 }).observe(stage);

  let smooth = 0;
  function frame(now) {
    if (onScreen) {
      let low = 0;
      if (window.RaidenAudio && RaidenAudio.ready && RaidenAudio.anyPlaying()) {
        low = RaidenAudio.bands().low;
      }
      smooth += (low - smooth) * 0.14;
      drawBeams(now, smooth);
      drawCrowd(now, smooth);
    }
    requestAnimationFrame(frame);
  }

  function drawStatic() {
    drawBeams(0, 0.25);
    drawCrowd(0, 0);
  }

  window.addEventListener("resize", () => { resize(); if (reduceMotion) drawStatic(); });
  resize();
  if (reduceMotion) {
    drawStatic();
  } else {
    requestAnimationFrame(frame);
  }
})();
