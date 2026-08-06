/* ============================================================
   RAIDEN — hero storm system
   Layers (back → front): sky gradient, storm clouds, sheet
   lightning, rising particles, rain, fractal bolts (leader →
   strike → afterglow) with impact ripples, crowd silhouettes.
   A storm-level meter driven by the music escalates all of it.
   Click an empty patch of sky to summon a bolt.
   ============================================================ */

(() => {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas) return;
  const ctx2d = canvas.getContext("2d");
  const hero = canvas.closest(".hero");

  const STATIC = new URLSearchParams(location.search).has("static");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || STATIC;

  let W = 0, H = 0, dpr = 1;
  let accent = "#8b5cf6";
  let accent2 = "#22d3ee";

  function readTheme() {
    const styles = getComputedStyle(document.documentElement);
    accent = styles.getPropertyValue("--accent").trim() || accent;
    accent2 = styles.getPropertyValue("--accent-2").trim() || accent2;
  }
  readTheme();
  new MutationObserver(() => { readTheme(); if (reduceMotion) drawStaticFrame(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-light"] });

  function hexA(hex, a) {
    hex = hex.trim();
    if (!hex.startsWith("#")) return hex;
    const h = hex.slice(1);
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ================= state ================= */
  let particles = [];
  let crowd = [];
  let drops = [];
  let clouds = [];
  let bolts = [];
  let ripples = [];
  let cloudSprite = null;

  let stormLevel = 0.12;      // 0..1 — everything scales off this
  let smoothedLow = 0;
  let lastBoltAt = 0;
  let nextIdleBolt = 1200;    // first strike lands fast
  let lastThunderAt = 0;
  let sheet = null;           // active sheet-lightning flash
  let nextSheetAt = 4000 + Math.random() * 6000;

  /* ================= setup ================= */
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedParticles();
    seedCrowd();
    seedRain();
    seedClouds();
  }

  function seedParticles() {
    const count = reduceMotion ? 0 : (W < 700 ? 40 : 90);
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

  function seedCrowd() {
    crowd = [];
    for (let x = -10; x < W + 10; x += 40 + Math.random() * 26) {
      const roll = Math.random();
      crowd.push({
        x: x + Math.random() * 12,
        r: 14 + Math.random() * 9,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.9,
        arm: roll < 0.12 ? "hand" : roll < 0.2 ? "phone" : null,
        armSide: Math.random() < 0.5 ? -1 : 1,
        armThresh: 0.4 + Math.random() * 0.25,
        armUp: 0,
      });
    }
  }

  function seedRain() {
    const count = reduceMotion || W < 700 ? 0 : 130;
    drops = Array.from({ length: count }, () => ({
      x: Math.random() * (W + 80) - 40,
      y: Math.random() * H,
      len: 9 + Math.random() * 12,
      sp: 9 + Math.random() * 6,
    }));
  }

  function seedClouds() {
    // pre-render one soft cloud mass, stamp it around the sky
    cloudSprite = document.createElement("canvas");
    cloudSprite.width = 320;
    cloudSprite.height = 150;
    const cs = cloudSprite.getContext("2d");
    for (let i = 0; i < 14; i++) {
      const cx = 30 + Math.random() * 260;
      const cy = 45 + Math.random() * 70;
      const r = 28 + Math.random() * 48;
      const g = cs.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(185,185,215,0.10)");
      g.addColorStop(1, "rgba(185,185,215,0)");
      cs.fillStyle = g;
      cs.fillRect(0, 0, 320, 150);
    }
    clouds = [];
    const n = Math.max(4, Math.round(W / 320));
    for (let i = 0; i < n + 1; i++) {
      clouds.push({
        x: (W / n) * i - 160 + Math.random() * 120,
        y: -30 + Math.random() * 50,
        scale: 1.6 + Math.random() * 1.6,
        sp: 0.008 + Math.random() * 0.016,
        alpha: 0.4 + Math.random() * 0.35,
      });
    }
  }

  /* ================= lightning ================= */
  function displace(segs, x0, y0, x1, y1, offset, gen) {
    if (offset < 4) {
      segs.push({ x1: x0, y1: y0, x2: x1, y2: y1, gen });
      return;
    }
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * offset;
    const my = (y0 + y1) / 2 + (Math.random() - 0.5) * offset * 0.35;
    displace(segs, x0, y0, mx, my, offset / 2, gen);
    displace(segs, mx, my, x1, y1, offset / 2, gen);
    // branch off the midpoint occasionally
    if (gen < 2 && Math.random() < 0.16) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const bx = mx + dir * (30 + Math.random() * 70) * (offset / 90);
      const by = my + (40 + Math.random() * 90) * (offset / 90);
      displace(segs, mx, my, bx, by, offset / 2.4, gen + 1);
    }
  }

  function genBolt(x0, y0, x1, y1) {
    const segs = [];
    displace(segs, x0, y0, x1, y1, Math.abs(y1 - y0) * 0.35, 0);
    return segs;
  }

  const titleEl = document.querySelector(".hero-title");
  function strike(opts = {}) {
    const now = performance.now();
    let tx, ty, aimedTitle = false;

    if (opts.x != null) {
      tx = opts.x;
      ty = opts.y != null ? opts.y : H - 30 - Math.random() * 60;
    } else if (titleEl && Math.random() < 0.28) {
      // sometimes the storm goes straight for the name
      const r = titleEl.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      tx = r.left - c.left + r.width * (0.15 + Math.random() * 0.7);
      ty = r.top - c.top - 6;
      aimedTitle = true;
    } else {
      tx = W * (0.12 + Math.random() * 0.76);
      ty = H - 30 - Math.random() * (H * 0.35);
    }

    const sx = tx + (Math.random() - 0.5) * W * 0.3;
    bolts.push({
      segments: genBolt(sx, -12, tx, ty),
      born: now,
      leader: 70 + Math.random() * 50,
      life: 430 + Math.random() * 260,
      impact: { x: tx, y: ty },
      major: true,
    });
    // companion bolt, dimmer and offset in time
    if (Math.random() < 0.4) {
      const tx2 = W * (0.1 + Math.random() * 0.8);
      bolts.push({
        segments: genBolt(tx2 + (Math.random() - 0.5) * 160, -12, tx2, H * (0.35 + Math.random() * 0.3)),
        born: now + 60 + Math.random() * 120,
        leader: 40,
        life: 300 + Math.random() * 150,
        impact: null,
        major: false,
      });
    }
    if (!aimedTitle || Math.random() < 0.8) {
      ripples.push({ x: tx, y: ty, r: 2, max: 60 + Math.random() * 50, born: now });
    }

    lastBoltAt = now;
    nextIdleBolt = (5000 + Math.random() * 8000) * (1 - stormLevel * 0.55);

    // thunder — only while the set is actually playing (no random rumbles for idle visitors)
    if (window.RaidenAudio && RaidenAudio.ready && RaidenAudio.anyPlaying() && RaidenAudio.thunder && now - lastThunderAt > 3200) {
      lastThunderAt = now;
      setTimeout(() => RaidenAudio.thunder(0.35 + stormLevel * 0.55), 110);
    }
    window.dispatchEvent(new CustomEvent("raiden:strike", { detail: { title: aimedTitle } }));
  }

  function drawBolt(bolt, now) {
    const age = now - bolt.born;
    if (age < 0) return true;
    if (age > bolt.life) return false;
    const fade = 1 - age / bolt.life;
    const flicker = 0.72 + Math.random() * 0.28;

    if (age < bolt.leader) {
      // stepped leader: faint preview crawling down
      ctx2d.lineCap = "round";
      ctx2d.strokeStyle = hexA(accent, 0.3 * flicker);
      ctx2d.lineWidth = 1;
      const frac = age / bolt.leader;
      const upto = Math.floor(bolt.segments.length * frac);
      ctx2d.beginPath();
      for (let i = 0; i < upto; i++) {
        const s = bolt.segments[i];
        ctx2d.moveTo(s.x1, s.y1);
        ctx2d.lineTo(s.x2, s.y2);
      }
      ctx2d.stroke();
      return true;
    }

    const mAge = age - bolt.leader;
    // photographic double-flash on impact
    if (bolt.major && mAge < 130) {
      const pulse = mAge < 45 ? 1 : mAge < 75 ? 0.35 : mAge < 110 ? 0.7 : 0.2;
      ctx2d.fillStyle = hexA(accent, 0.07 * pulse * flicker);
      ctx2d.fillRect(0, 0, W, H);
    }

    const ember = fade < 0.45; // afterglow phase
    ctx2d.lineCap = "round";
    for (const s of bolt.segments) {
      const wMul = s.gen === 0 ? 1 : s.gen === 1 ? 0.55 : 0.35;
      if (!ember) {
        ctx2d.strokeStyle = hexA(accent, 0.3 * fade * flicker);
        ctx2d.lineWidth = 8 * wMul;
        ctx2d.beginPath(); ctx2d.moveTo(s.x1, s.y1); ctx2d.lineTo(s.x2, s.y2); ctx2d.stroke();
        ctx2d.strokeStyle = `rgba(255,255,255,${0.9 * fade * flicker})`;
        ctx2d.lineWidth = 1.9 * wMul;
        ctx2d.beginPath(); ctx2d.moveTo(s.x1, s.y1); ctx2d.lineTo(s.x2, s.y2); ctx2d.stroke();
      } else {
        ctx2d.strokeStyle = hexA(accent, 0.4 * fade * flicker);
        ctx2d.lineWidth = 1.4 * wMul;
        ctx2d.beginPath(); ctx2d.moveTo(s.x1, s.y1); ctx2d.lineTo(s.x2, s.y2); ctx2d.stroke();
      }
    }

    // impact glow
    if (bolt.impact && !ember) {
      const g = ctx2d.createRadialGradient(bolt.impact.x, bolt.impact.y, 0, bolt.impact.x, bolt.impact.y, 70);
      g.addColorStop(0, hexA(accent, 0.35 * fade));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = g;
      ctx2d.fillRect(bolt.impact.x - 70, bolt.impact.y - 70, 140, 140);
    }
    return true;
  }

  /* ================= layers ================= */
  function drawSky() {
    const grad = ctx2d.createRadialGradient(W / 2, H * 1.15, H * 0.1, W / 2, H * 1.15, H * 1.4);
    grad.addColorStop(0, hexA(accent, 0.10));
    grad.addColorStop(0.5, hexA(accent, 0.03));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, W, H);
  }

  function drawClouds(flashAmt) {
    for (const c of clouds) {
      if (!reduceMotion) {
        c.x += c.sp * (0.4 + stormLevel * 1.6);
        if (c.x > W + 200) c.x = -320 * c.scale;
      }
      ctx2d.globalAlpha = c.alpha * (1 + flashAmt * 1.6);
      ctx2d.drawImage(cloudSprite, c.x, c.y, 320 * c.scale, 150 * c.scale);
    }
    ctx2d.globalAlpha = 1;
  }

  function drawSheet(now) {
    if (!sheet && !reduceMotion && now > nextSheetAt && now - lastBoltAt > 1500) {
      sheet = { born: now, x: W * (0.1 + Math.random() * 0.8), dur: 240 + Math.random() * 160 };
      nextSheetAt = now + (6000 + Math.random() * 9000) * (1 - stormLevel * 0.5);
    }
    if (!sheet) return 0;
    const age = now - sheet.born;
    if (age > sheet.dur) { sheet = null; return 0; }
    const frac = age / sheet.dur;
    const pulse = frac < 0.2 ? frac / 0.2 : frac < 0.45 ? 0.5 : frac < 0.6 ? 0.9 : 1 - frac;
    const amt = Math.max(0, pulse) * (0.5 + stormLevel * 0.5);
    const g = ctx2d.createRadialGradient(sheet.x, -40, 0, sheet.x, -40, H * 0.85);
    g.addColorStop(0, hexA(accent, 0.14 * amt));
    g.addColorStop(0.4, hexA(accent, 0.05 * amt));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = g;
    ctx2d.fillRect(0, 0, W, H);
    return amt;
  }

  function drawParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.sway += p.swaySpeed;
      p.x += Math.sin(p.sway) * 0.35;
      p.y -= p.vy * (1 + smoothedLow * 2.2 + stormLevel * 0.6);
      if (p.y < -12) particles[i] = spawnParticle(false);
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.r * (1 + smoothedLow * 0.8), 0, Math.PI * 2);
      ctx2d.fillStyle = hexA(p.hue2 ? accent2 : accent, p.alpha * (0.55 + smoothedLow * 0.6));
      ctx2d.fill();
    }
  }

  function rainIntensity() {
    if (reduceMotion || !drops.length) return 0;
    let deckB = 0;
    if (window.RaidenAudio && RaidenAudio.ready && RaidenAudio.isPlaying("b")) deckB = 0.4;
    return Math.min(1, 0.22 + stormLevel * 0.5 + deckB);
  }

  function drawRain() {
    const inten = rainIntensity();
    if (inten <= 0) return;
    const n = Math.floor(drops.length * inten);
    ctx2d.strokeStyle = hexA(accent2, 0.11);
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    for (let i = 0; i < n; i++) {
      const d = drops[i];
      d.y += d.sp * (0.8 + stormLevel * 0.8);
      d.x += 1.1;
      if (d.y > H + 20) { d.y = -20; d.x = Math.random() * (W + 80) - 40; }
      ctx2d.moveTo(d.x, d.y);
      ctx2d.lineTo(d.x + d.len * 0.14, d.y + d.len);
    }
    ctx2d.stroke();
  }

  function drawRipples(now) {
    ripples = ripples.filter((r) => {
      const age = now - r.born;
      const frac = age / 600;
      if (frac > 1) return false;
      r.r = 2 + r.max * frac;
      ctx2d.strokeStyle = hexA(accent, 0.35 * (1 - frac));
      ctx2d.lineWidth = 1.6;
      ctx2d.beginPath();
      ctx2d.ellipse(r.x, r.y, r.r, r.r * 0.35, 0, 0, Math.PI * 2);
      ctx2d.stroke();
      return true;
    });
  }

  function drawCrowd(now) {
    const t = now * 0.0016;
    const energy = Math.max(smoothedLow, stormLevel * 0.25);
    for (const h of crowd) {
      const bob = reduceMotion ? 0 : Math.sin(t * h.speed + h.phase) * 2.4 + energy * 6;
      const headY = H - h.r * 1.55 - bob;

      const wantUp = !reduceMotion && h.arm && energy > h.armThresh;
      h.armUp += ((wantUp ? 1 : 0) - h.armUp) * 0.07;
      if (h.arm && h.armUp > 0.03) {
        const ax = h.x + h.armSide * h.r * 0.9;
        const hy = headY - h.r * 2.5 * h.armUp;
        ctx2d.strokeStyle = "#04040a";
        ctx2d.lineWidth = Math.max(3.5, h.r * 0.36);
        ctx2d.lineCap = "round";
        ctx2d.beginPath();
        ctx2d.moveTo(ax, headY + h.r * 0.9);
        ctx2d.lineTo(ax + h.armSide * 5, hy);
        ctx2d.stroke();
        if (h.arm === "phone") {
          ctx2d.fillStyle = hexA(accent2, 0.7 * h.armUp);
          ctx2d.shadowColor = accent2;
          ctx2d.shadowBlur = 9 * h.armUp;
          ctx2d.fillRect(ax + h.armSide * 5 - 3.5, hy - 10, 7, 11);
          ctx2d.shadowBlur = 0;
        } else {
          ctx2d.fillStyle = "#04040a";
          ctx2d.beginPath();
          ctx2d.arc(ax + h.armSide * 5, hy - 2, h.r * 0.3, 0, Math.PI * 2);
          ctx2d.fill();
        }
      }

      ctx2d.fillStyle = "#04040a";
      ctx2d.beginPath();
      ctx2d.arc(h.x, headY, h.r, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.beginPath();
      ctx2d.ellipse(h.x, H + h.r * 0.35, h.r * 1.9, h.r * 1.6, 0, Math.PI, 0);
      ctx2d.fill();
    }
  }

  /* ================= main loop ================= */
  function frame(now) {
    ctx2d.clearRect(0, 0, W, H);

    // storm level follows the music, breathes when idle
    let low = 0;
    const playing = window.RaidenAudio && RaidenAudio.ready && RaidenAudio.anyPlaying();
    if (playing) {
      const b = RaidenAudio.bands();
      low = b.low;
      if (low > 0.55 && now - lastBoltAt > 2600 * (1 - stormLevel * 0.4)) strike();
    } else if (!reduceMotion && now - lastBoltAt > nextIdleBolt) {
      strike();
    }
    smoothedLow += (low - smoothedLow) * 0.12;
    const targetStorm = playing ? Math.min(1, 0.3 + smoothedLow * 1.1) : 0.12;
    stormLevel += (targetStorm - stormLevel) * 0.01;

    drawSky();
    const flashAmt = drawSheet(now);
    drawClouds(flashAmt);
    if (!reduceMotion) drawParticles();
    drawRain();

    bolts = bolts.filter((b) => drawBolt(b, now));
    drawRipples(now);
    drawCrowd(now);

    requestAnimationFrame(frame);
  }

  function drawStaticFrame() {
    ctx2d.clearRect(0, 0, W, H);
    drawSky();
    drawClouds(0);
    drawCrowd(0);
  }

  /* ================= interaction ================= */
  if (hero && !reduceMotion) {
    hero.addEventListener("pointerdown", (e) => {
      if (e.target.closest("a, button, input")) return;
      const r = canvas.getBoundingClientRect();
      strike({ x: e.clientX - r.left, y: e.clientY - r.top });
    });
  }

  window.addEventListener("resize", () => { resize(); if (reduceMotion) drawStaticFrame(); });
  resize();
  if (reduceMotion) {
    drawStaticFrame();
  } else {
    requestAnimationFrame(frame);
  }

  // public: other modules can summon the storm
  window.RaidenStrike = (x, y) => strike(x != null ? { x, y } : {});
})();
