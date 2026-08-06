/* ============================================================
   RAIDEN — booth UI wiring
   Builds the six V10 channel strips, wires transport, faders,
   crossfader, filter knob, LED meters, platters, CDJ screens.
   ============================================================ */

(() => {
  const STRIPS = [
    { role: "kick", label: "KICK" },
    { role: "hats", label: "HATS" },
    { role: "perc", label: "PERC" },
    { role: "bass", label: "BASS" },
    { role: "chords", label: "CHRD" },
    { role: "lead", label: "LEAD" },
  ];
  const METER_SEGS = 8;

  const stripsHost = document.getElementById("mixerStrips");
  if (!stripsHost) return;

  /* ---------- build channel strips ---------- */
  const meters = {}; // role -> [segment els]
  for (const { role, label } of STRIPS) {
    const strip = document.createElement("div");
    strip.className = "strip";
    strip.innerHTML = `
      <span class="strip-label">${label}</span>
      <div class="meter" aria-hidden="true">${"<i></i>".repeat(METER_SEGS)}</div>
      <div class="fader-slot">
        <input type="range" class="fader" min="0" max="100" value="85"
               aria-label="${label} channel fader" data-role="${role}" />
      </div>
      <button class="strip-mute" data-role="${role}" aria-label="Mute ${label}" title="Mute ${label}"></button>
    `;
    stripsHost.appendChild(strip);
    meters[role] = Array.from(strip.querySelectorAll(".meter i"));
  }

  stripsHost.addEventListener("input", (e) => {
    if (!e.target.classList.contains("fader")) return;
    RaidenAudio.init();
    RaidenAudio.setFader(e.target.dataset.role, e.target.value / 100);
  });

  stripsHost.addEventListener("click", (e) => {
    const btn = e.target.closest(".strip-mute");
    if (!btn) return;
    RaidenAudio.init();
    const muted = RaidenAudio.toggleMute(btn.dataset.role);
    btn.classList.toggle("muted", muted);
  });

  /* ---------- transport ---------- */
  const playBtns = {
    a: document.querySelector('.cdj-btn.play[data-deck="a"]'),
    b: document.querySelector('.cdj-btn.play[data-deck="b"]'),
  };
  const platters = {
    a: document.querySelector('.platter[data-deck="a"]'),
    b: document.querySelector('.platter[data-deck="b"]'),
  };
  const times = {
    a: document.querySelector('.cdj-time[data-deck="a"]'),
    b: document.querySelector('.cdj-time[data-deck="b"]'),
  };

  document.querySelectorAll(".cdj-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const deck = btn.dataset.deck;
      if (btn.dataset.action === "play") {
        const on = RaidenAudio.toggleDeck(deck);
        setDeckUI(deck, on);
        if (on && window.RaidenStrike) window.RaidenStrike();
      } else {
        RaidenAudio.init();
        RaidenAudio.cueDeck(deck);
        setDeckUI(deck, false);
      }
    });
  });

  function setDeckUI(deck, on) {
    playBtns[deck].classList.toggle("on", on);
    platters[deck].classList.toggle("spinning", on);
    if (!on) times[deck].textContent = "00:00";
  }

  RaidenAudio.on("deckstate", ({ deck, playing }) => {
    // keep UI honest for quantized starts/stops scheduled by the engine
    playBtns[deck].classList.toggle("on", playing || RaidenAudio.isPlaying(deck));
    platters[deck].classList.toggle("spinning", playing || RaidenAudio.isPlaying(deck));
  });

  /* ---------- crossfader ---------- */
  const xfader = document.getElementById("crossfader");
  xfader.addEventListener("input", () => {
    RaidenAudio.init();
    RaidenAudio.setCrossfade(xfader.value / 100);
  });

  /* ---------- filter knob ---------- */
  const knob = document.getElementById("filterKnob");
  const indicator = knob.querySelector(".knob-indicator");
  let knobValue = 0; // -1..1
  let dragStartY = 0;
  let dragStartVal = 0;
  let dragging = false;

  function applyKnob(v) {
    knobValue = Math.max(-1, Math.min(1, v));
    // indicator sits at top with transform-origin at the knob center (CSS)
    indicator.style.transform = `rotate(${knobValue * 135}deg)`;
    knob.setAttribute("aria-valuenow", Math.round(knobValue * 100));
    RaidenAudio.init();
    RaidenAudio.setFilter(knobValue);
  }

  knob.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    knob.setPointerCapture(e.pointerId);
    dragging = true;
    dragStartY = e.clientY;
    dragStartVal = knobValue;
  });
  knob.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dy = dragStartY - e.clientY;
    applyKnob(dragStartVal + dy / 90);
  });
  knob.addEventListener("pointerup", () => { dragging = false; });
  knob.addEventListener("pointercancel", () => { dragging = false; });
  knob.addEventListener("dblclick", () => applyKnob(0));
  knob.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { applyKnob(knobValue + 0.08); e.preventDefault(); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") { applyKnob(knobValue - 0.08); e.preventDefault(); }
    if (e.key === "0" || e.key === "Home") { applyKnob(0); e.preventDefault(); }
  });

  /* ---------- CDJ waveform screens ---------- */
  const waves = {};
  document.querySelectorAll(".cdj-wave").forEach((c) => {
    waves[c.dataset.deck] = c;
    drawWave(c, 0, false);
  });

  // seeded pseudo-waveform so each deck has a consistent "track"
  function waveHeights(deck) {
    if (waveHeights[deck]) return waveHeights[deck];
    let seed = deck === "a" ? 1337 : 4242;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const arr = [];
    for (let i = 0; i < 512; i++) {
      const beat = i % 8 < 1 ? 1 : 0.55;
      arr.push((0.25 + rand() * 0.75) * beat);
    }
    waveHeights[deck] = arr;
    return arr;
  }

  function drawWave(canvas, phase, playing) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const heights = waveHeights(canvas.dataset.deck);
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--accent").trim();
    const bars = 60;
    const bw = W / bars;
    const offset = Math.floor(phase * heights.length);
    for (let i = 0; i < bars; i++) {
      const h = heights[(offset + i) % heights.length] * (H - 6);
      const x = i * bw;
      const past = i < bars * 0.35;
      ctx.fillStyle = playing
        ? (past ? "rgba(255,255,255,0.22)" : accent)
        : "rgba(255,255,255,0.14)";
      ctx.fillRect(x + 1, (H - h) / 2, bw - 2, h);
    }
    // playhead
    ctx.fillStyle = "#fff";
    ctx.fillRect(W * 0.35, 0, 1.5, H);
  }

  /* ---------- meters + screens loop ---------- */
  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  let frameCount = 0;
  function tick() {
    frameCount++;
    if (RaidenAudio.ready) {
      // meters every other frame
      if (frameCount % 2 === 0) {
        for (const { role } of STRIPS) {
          const lvl = RaidenAudio.roleLevel(role);
          const lit = Math.round(lvl * METER_SEGS);
          const segs = meters[role];
          for (let i = 0; i < METER_SEGS; i++) {
            segs[i].classList.toggle("lit", i < lit);
          }
        }
      }
      for (const deck of ["a", "b"]) {
        if (RaidenAudio.isPlaying(deck)) {
          times[deck].textContent = fmtTime(RaidenAudio.deckElapsed(deck));
          if (frameCount % 3 === 0) drawWave(waves[deck], RaidenAudio.deckPhase(deck), true);
        }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- expose a "drop the beat" entry point ---------- */
  window.RaidenBooth = {
    dropTheBeat() {
      RaidenAudio.init();
      if (!RaidenAudio.isPlaying("a")) {
        RaidenAudio.toggleDeck("a");
        setDeckUI("a", true);
      }
      if (window.RaidenStrike) window.RaidenStrike();
    },
  };
})();
