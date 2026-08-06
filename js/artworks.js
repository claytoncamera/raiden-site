/* ============================================================
   RAIDEN — storm visuals
   Six generative pieces painted by the site itself. Every load
   is unique; click a tile to re-roll it. Theme-aware.
   ============================================================ */

(() => {
  const grid = document.getElementById("artGrid");
  if (!grid) return;

  let accent = "#8b5cf6";
  let accent2 = "#22d3ee";
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    accent = s.getPropertyValue("--accent").trim() || accent;
    accent2 = s.getPropertyValue("--accent-2").trim() || accent2;
  }
  readTheme();

  function hexA(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function bg(ctx, W, H, cx = 0.5, cy = 0.75) {
    ctx.fillStyle = "#06060c";
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * cx, H * cy, 10, W * cx, H * cy, H);
    g.addColorStop(0, hexA(accent, 0.14));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function grain(ctx, W, H, n = 320) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
  }

  /* ---------------- painters ---------------- */
  const PAINTERS = {
    strike(ctx, W, H) {
      bg(ctx, W, H, 0.5, 0.9);
      const tx = W * (0.3 + Math.random() * 0.4);
      const ty = H * (0.7 + Math.random() * 0.2);
      // glow + core in one committed geometry: build once into a Path2D
      const p = new Path2D();
      (function seg(x0, y0, x1, y1, off, gen) {
        if (off < 4) { p.moveTo(x0, y0); p.lineTo(x1, y1); return; }
        const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * off;
        const my = (y0 + y1) / 2 + (Math.random() - 0.5) * off * 0.35;
        seg(x0, y0, mx, my, off / 2, gen);
        seg(mx, my, x1, y1, off / 2, gen);
        if (gen < 2 && Math.random() < 0.22) {
          const d = Math.random() < 0.5 ? -1 : 1;
          seg(mx, my, mx + d * off * 0.8, my + off, off / 2.4, gen + 1);
        }
      })(tx + (Math.random() - 0.5) * W * 0.4, -10, tx, ty, H * 0.32, 0);
      for (const [w, a] of [[12, 0.1], [6, 0.3], [1.8, 0.95]]) {
        ctx.strokeStyle = a > 0.9 ? "rgba(255,255,255,0.95)" : hexA(accent, a);
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.stroke(p);
      }
      const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 60);
      g.addColorStop(0, hexA(accent, 0.5));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(tx - 60, ty - 60, 120, 120);
      grain(ctx, W, H);
    },

    clouds(ctx, W, H) {
      bg(ctx, W, H, 0.5, 0.2);
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H * 0.6;
        const r = 24 + Math.random() * 70;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(185,185,215,${0.04 + Math.random() * 0.07})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      // hidden flash inside the mass
      const fx = W * (0.2 + Math.random() * 0.6);
      const g2 = ctx.createRadialGradient(fx, H * 0.3, 0, fx, H * 0.3, H * 0.5);
      g2.addColorStop(0, hexA(accent, 0.35));
      g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
      grain(ctx, W, H, 220);
    },

    crowd(ctx, W, H) {
      bg(ctx, W, H, 0.5, 0.55);
      // stage glow
      const g = ctx.createRadialGradient(W / 2, H * 0.62, 8, W / 2, H * 0.62, W * 0.55);
      g.addColorStop(0, hexA(accent, 0.5));
      g.addColorStop(0.5, hexA(accent, 0.1));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // beams
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(W * (0.25 + Math.random() * 0.5), 0);
        ctx.rotate((Math.random() - 0.5) * 0.9);
        const bg2 = ctx.createLinearGradient(0, 0, 0, H);
        bg2.addColorStop(0, hexA(i % 2 ? accent2 : accent, 0.2));
        bg2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = bg2;
        ctx.beginPath();
        ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.lineTo(22, H); ctx.lineTo(-22, H);
        ctx.fill();
        ctx.restore();
      }
      // crowd
      for (let x = -8; x < W + 8; x += 14 + Math.random() * 12) {
        const r = 9 + Math.random() * 8;
        const y = H - r * 1.1 - Math.random() * 8;
        ctx.fillStyle = "#04040a";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x, H + r * 0.4, r * 1.9, r * 1.6, 0, Math.PI, 0);
        ctx.fill();
        if (Math.random() < 0.14) {
          ctx.strokeStyle = "#04040a";
          ctx.lineWidth = r * 0.35;
          ctx.lineCap = "round";
          const ax = x + (Math.random() < 0.5 ? -1 : 1) * r;
          ctx.beginPath();
          ctx.moveTo(ax, y + r * 0.6);
          ctx.lineTo(ax + 3, y - r * 2.1);
          ctx.stroke();
          if (Math.random() < 0.5) {
            ctx.fillStyle = hexA(accent2, 0.8);
            ctx.fillRect(ax, y - r * 2.7, 4, 6);
          }
        }
      }
      grain(ctx, W, H, 260);
    },

    wave(ctx, W, H) {
      bg(ctx, W, H, 0.5, 0.5);
      const bars = 64;
      const bw = W / bars;
      const mid = H / 2;
      for (let i = 0; i < bars; i++) {
        const beat = i % 8 === 0 ? 1 : 0.55;
        const h = (0.1 + Math.random() * 0.75) * beat * H * 0.42;
        const t = i / bars;
        ctx.fillStyle = hexA(t < 0.5 ? accent : accent2, 0.35 + Math.random() * 0.5);
        ctx.fillRect(i * bw + 1, mid - h, bw - 2, h * 2);
      }
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(W * (0.2 + Math.random() * 0.6), 6, 1.5, H - 12);
      grain(ctx, W, H, 180);
    },

    signal(ctx, W, H) {
      bg(ctx, W, H, 0.5, 0.5);
      const cx = W / 2, cy = H / 2;
      for (let r = 16; r < W * 0.46; r += 10 + Math.random() * 8) {
        const start = Math.random() * Math.PI * 2;
        const len = Math.PI * (0.3 + Math.random() * 1.5);
        ctx.strokeStyle = hexA(Math.random() < 0.35 ? accent2 : accent, 0.2 + Math.random() * 0.5);
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + len);
        ctx.stroke();
      }
      ctx.fillStyle = hexA(accent, 0.9);
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 20 + Math.random() * W * 0.42;
        ctx.fillStyle = hexA(Math.random() < 0.4 ? accent2 : accent, 0.3 + Math.random() * 0.5);
        ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6, 1.6);
      }
      grain(ctx, W, H, 160);
    },

    grid(ctx, W, H) {
      bg(ctx, W, H, 0.5, 0.42);
      const horizon = H * 0.55;
      // glow on the horizon
      const g = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 40);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.5, hexA(accent, 0.4));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, horizon - 30, W, 70);
      // perspective floor
      ctx.strokeStyle = hexA(accent, 0.35);
      ctx.lineWidth = 1;
      for (let i = 0; i <= 14; i++) {
        const x = (i / 14) * W;
        ctx.beginPath();
        ctx.moveTo(W / 2 + (x - W / 2) * 0.12, horizon);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let i = 0; i < 7; i++) {
        const t = i / 7;
        const y = horizon + (H - horizon) * t * t;
        ctx.strokeStyle = hexA(accent, 0.15 + t * 0.3);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // a distant strike above the horizon
      const p = new Path2D();
      const tx = W * (0.25 + Math.random() * 0.5);
      (function seg(x0, y0, x1, y1, off) {
        if (off < 3) { p.moveTo(x0, y0); p.lineTo(x1, y1); return; }
        const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * off;
        const my = (y0 + y1) / 2 + (Math.random() - 0.5) * off * 0.3;
        seg(x0, y0, mx, my, off / 2);
        seg(mx, my, x1, y1, off / 2);
      })(tx + (Math.random() - 0.5) * 60, -6, tx, horizon, 40);
      ctx.strokeStyle = hexA(accent2, 0.25);
      ctx.lineWidth = 4;
      ctx.stroke(p);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.2;
      ctx.stroke(p);
      grain(ctx, W, H, 200);
    },
  };

  /* ---------------- wiring ---------------- */
  function paint(tile) {
    const canvas = tile.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const painter = PAINTERS[tile.dataset.art];
    if (!painter) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    painter(ctx, canvas.width, canvas.height);
  }

  const tiles = Array.from(grid.querySelectorAll(".art-tile"));
  tiles.forEach((tile) => {
    paint(tile);
    tile.addEventListener("click", () => paint(tile));
    tile.setAttribute("role", "button");
    tile.setAttribute("tabindex", "0");
    tile.setAttribute("aria-label", `Regenerate artwork: ${tile.querySelector("figcaption").textContent}`);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); paint(tile); }
    });
  });

  // repaint the gallery when the lighting preset changes
  new MutationObserver(() => { readTheme(); tiles.forEach(paint); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-light"] });
})();
