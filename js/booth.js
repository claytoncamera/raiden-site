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

  // broadcast booth actions (chat + any future listeners)
  function act(type, data) {
    window.dispatchEvent(new CustomEvent("raiden:action", { detail: { type, ...data } }));
  }

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
    act("fader", { role: e.target.dataset.role, v: e.target.value / 100 });
  });

  stripsHost.addEventListener("click", (e) => {
    const btn = e.target.closest(".strip-mute");
    if (!btn) return;
    RaidenAudio.init();
    const muted = RaidenAudio.toggleMute(btn.dataset.role);
    btn.classList.toggle("muted", muted);
    act("mute", { role: btn.dataset.role, muted });
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
        act("play", { deck, on });
      } else {
        RaidenAudio.init();
        RaidenAudio.cueDeck(deck);
        setDeckUI(deck, false);
        act("cue", { deck });
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
    act("xfade", { v: xfader.value / 100 });
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
    act("filter", { v: knobValue });
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

  /* ---------- RISE / DROP ---------- */
  const riseBtn = document.getElementById("riseBtn");
  if (riseBtn) {
    riseBtn.addEventListener("click", () => {
      const ok = RaidenAudio.riseDrop();
      if (!ok) {
        act("riseidle", {});
        return;
      }
      riseBtn.classList.add("armed");
      act("rise", {});
    });
    RaidenAudio.on("risestart", () => {
      riseBtn.classList.remove("armed");
      riseBtn.classList.add("building");
    });
    RaidenAudio.on("drop", () => {
      riseBtn.classList.remove("armed", "building");
      act("drop", {});
      if (window.RaidenStrike) {
        RaidenStrike();
        setTimeout(() => window.RaidenStrike && RaidenStrike(), 180);
      }
    });
  }

  /* ---------- tempo ---------- */
  const tempoSlider = document.getElementById("tempoSlider");
  const masterBpmEl = document.getElementById("masterBpm");
  const cdjBpms = document.querySelectorAll(".cdj-bpm");
  if (tempoSlider) {
    tempoSlider.addEventListener("input", () => {
      RaidenAudio.init();
      const v = RaidenAudio.setBpm(parseFloat(tempoSlider.value));
      masterBpmEl.textContent = v.toFixed(1);
      cdjBpms.forEach((el) => (el.textContent = v.toFixed(1)));
      act("tempo", { bpm: v });
    });
    tempoSlider.addEventListener("dblclick", () => {
      tempoSlider.value = 126;
      tempoSlider.dispatchEvent(new Event("input"));
    });
  }

  /* ---------- platter drag → spinback ---------- */
  document.querySelectorAll(".platter").forEach((platter) => {
    const deck = platter.dataset.deck;
    const disc = platter.querySelector(".platter-disc");
    let dragging = false;
    let startY = 0;
    let travel = 0;
    platter.style.cursor = "grab";
    platter.addEventListener("pointerdown", (e) => {
      if (!RaidenAudio.ready || !RaidenAudio.isPlaying(deck)) return;
      dragging = true;
      startY = e.clientY;
      travel = 0;
      platter.setPointerCapture(e.pointerId);
      disc.style.animationPlayState = "paused";
      platter.style.cursor = "grabbing";
      e.preventDefault();
    });
    platter.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      travel = e.clientY - startY;
      disc.style.transform = `rotate(${travel * 1.6}deg)`;
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      disc.style.transform = "";
      disc.style.animationPlayState = "";
      platter.style.cursor = "grab";
      if (Math.abs(travel) > 45 && RaidenAudio.spinback(deck)) {
        setDeckUI(deck, false);
        act("spinback", { deck });
      }
    };
    platter.addEventListener("pointerup", release);
    platter.addEventListener("pointercancel", release);
  });

  /* ---------- CDJ waveform screens ---------- */
  let waveAccent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const waves = {};
  document.querySelectorAll(".cdj-wave").forEach((c) => {
    waves[c.dataset.deck] = c;
    drawWave(c, 0, false);
  });
  new MutationObserver(() => {
    waveAccent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    for (const deck of ["a", "b"]) drawWave(waves[deck], 0, RaidenAudio.ready && RaidenAudio.isPlaying(deck));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-light"] });

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
    const accent = waveAccent;
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
        act("play", { deck: "a", on: true });
      }
      if (window.RaidenStrike) window.RaidenStrike();
    },
  };
})();
