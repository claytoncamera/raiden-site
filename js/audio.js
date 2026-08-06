/* ============================================================
   RAIDEN — Web Audio house engine
   Two decks, six channel roles, one clock. Everything is
   synthesized live — no samples, no downloads.
   Roles (mixer channels): KICK HATS PERC BASS CHORDS LEAD
   ============================================================ */

window.RaidenAudio = (() => {
  let bpm = 126;
  const STEPS_PER_BAR = 16;
  let SECONDS_PER_STEP = 60 / bpm / 4;
  const LOOP_BARS = 4;
  const LOOP_STEPS = STEPS_PER_BAR * LOOP_BARS;
  const LOOKAHEAD_MS = 25;
  const SCHEDULE_AHEAD = 0.12;

  const ROLES = ["kick", "hats", "perc", "bass", "chords", "lead"];

  let ctx = null;
  let masterFilter, compressor, masterAnalyser, delayNode, delayGain, delayFeedback;
  const roleBus = {}; // role -> { gain, analyser, level (0..1 user fader), muted }
  const decks = {
    a: { playing: false, startStep: 0, pendingStart: false },
    b: { playing: false, startStep: 0, pendingStart: false },
  };

  let crossfade = 0.5; // 0 = full A, 1 = full B
  let filterValue = 0; // -1..1
  let schedulerTimer = null;
  let nextStepTime = 0;
  let currentStep = 0; // global step counter since engine start

  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------------- patterns ----------------
     Each deck: role -> array of events {b: bar 0-3, s: step 0-15,
     n: midi note (or notes[]), v: velocity, l: length in steps} */
  const PATTERNS = {
    a: {
      // VOLTAGE — deep and rolling
      kick: bars((b) => [0, 4, 8, 12].map((s) => ({ b, s, v: 1 }))),
      hats: bars((b) => {
        const ev = [];
        for (let s = 1; s < 16; s += 2) ev.push({ b, s, v: 0.16, open: false });
        [2, 6, 10, 14].forEach((s) => ev.push({ b, s, v: 0.42, open: true }));
        return ev;
      }),
      perc: bars((b) => {
        const ev = [{ b, s: 4, v: 0.75 }, { b, s: 12, v: 0.75 }];
        if (b === 1) ev.push({ b, s: 7, v: 0.3, rim: true });
        if (b === 3) ev.push({ b, s: 15, v: 0.35, rim: true });
        return ev;
      }),
      bass: bars((b) => {
        const base = [
          { s: 2, n: 33, v: 0.9 }, { s: 3, n: 33, v: 0.5 },
          { s: 6, n: 33, v: 0.9 }, { s: 7, n: 33, v: 0.5 },
          { s: 10, n: 33, v: 0.9 }, { s: 11, n: 36, v: 0.6 },
          { s: 14, n: b === 3 ? 38 : 31, v: 0.9 }, { s: 15, n: 33, v: 0.5 },
        ];
        return base.map((e) => ({ ...e, b, l: 0.6 }));
      }),
      chords: bars((b) => {
        const ev = [
          { b, s: 2, n: [57, 60, 64, 67], v: 0.5 },
          { b, s: 10, n: [57, 60, 64, 67], v: 0.45 },
        ];
        if (b === 1 || b === 3) ev.push({ b, s: 7, n: [55, 60, 64], v: 0.32 });
        return ev;
      }),
      lead: [
        { b: 2, s: 2, n: 76, v: 0.3, l: 3 },
        { b: 2, s: 6, n: 72, v: 0.28, l: 3 },
        { b: 2, s: 10, n: 69, v: 0.3, l: 3 },
        { b: 2, s: 14, n: 67, v: 0.26, l: 3 },
        { b: 3, s: 2, n: 64, v: 0.3, l: 10 },
      ],
    },
    b: {
      // ION RAIN — peak-time drive
      kick: bars((b) => {
        const ev = [0, 4, 8, 12].map((s) => ({ b, s, v: 1 }));
        if (b === 3) ev.push({ b, s: 15, v: 0.45 });
        return ev;
      }),
      hats: bars((b) => {
        const ev = [];
        for (let s = 0; s < 16; s += 2) ev.push({ b, s, v: s % 4 === 0 ? 0.14 : 0.3, open: false });
        [2, 6, 10, 14].forEach((s) => ev.push({ b, s, v: 0.55, open: true }));
        return ev;
      }),
      perc: bars((b) => [
        { b, s: 4, v: 0.8 }, { b, s: 12, v: 0.8 },
        { b, s: 5, v: 0.22, rim: true }, { b, s: 13, v: 0.22, rim: true },
      ]),
      bass: bars((b) => {
        const ev = [2, 6, 10, 14].map((s) => ({ b, s, n: 33, v: 1, l: 1.4 }));
        if (b === 1 || b === 3) ev.push({ b, s: 15, n: 45, v: 0.5, l: 0.6 });
        return ev;
      }),
      chords: bars((b) => {
        const voicing = b < 2 ? [50, 53, 57, 60, 64] : [57, 60, 64, 71];
        return [
          { b, s: 2, n: voicing, v: 0.5 },
          { b, s: 7, n: voicing, v: 0.35 },
          { b, s: 10, n: voicing, v: 0.45 },
        ];
      }),
      lead: bars((b) => {
        const notes = [69, 76, 72, 81];
        const oct = b % 2 === 1 ? 12 : 0;
        const ev = [];
        for (let i = 0; i < 8; i++) {
          ev.push({ b, s: i * 2, n: notes[i % 4] + oct, v: i % 4 === 0 ? 0.3 : 0.2, l: 1 });
        }
        return ev;
      }),
    },
  };

  function bars(fn) {
    const out = [];
    for (let b = 0; b < LOOP_BARS; b++) out.push(...fn(b));
    return out;
  }

  // index patterns by absolute loop step for fast scheduling
  const INDEXED = {};
  for (const deck of ["a", "b"]) {
    INDEXED[deck] = {};
    for (const role of ROLES) {
      INDEXED[deck][role] = new Map();
      for (const ev of PATTERNS[deck][role]) {
        const step = ev.b * STEPS_PER_BAR + ev.s;
        if (!INDEXED[deck][role].has(step)) INDEXED[deck][role].set(step, []);
        INDEXED[deck][role].get(step).push(ev);
      }
    }
  }

  /* ---------------- graph ---------------- */
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    masterFilter = ctx.createBiquadFilter();
    masterFilter.type = "lowpass";
    masterFilter.frequency.value = 20000;
    masterFilter.Q.value = 0.9;

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;

    masterAnalyser = ctx.createAnalyser();
    masterAnalyser.fftSize = 512;
    masterAnalyser.smoothingTimeConstant = 0.75;

    masterFilter.connect(compressor);
    compressor.connect(masterAnalyser);
    masterAnalyser.connect(ctx.destination);

    // shared space delay (dotted-8th) for chords + lead
    delayNode = ctx.createDelay(1.0);
    delayNode.delayTime.value = SECONDS_PER_STEP * 3;
    delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.3;
    delayGain = ctx.createGain();
    delayGain.gain.value = 0.16;
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayGain);
    delayGain.connect(masterFilter);

    for (const role of ROLES) {
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      gain.connect(analyser);
      analyser.connect(masterFilter);
      roleBus[role] = { gain, analyser, level: 0.85, muted: false };
      gain.gain.value = 0.85;
    }
    // taste: pre-balance the roles
    setRoleBase("kick", 1.0);
    setRoleBase("hats", 0.7);
    setRoleBase("perc", 0.8);
    setRoleBase("bass", 0.9);
    setRoleBase("chords", 0.75);
    setRoleBase("lead", 0.6);

    nextStepTime = ctx.currentTime + 0.06;
    currentStep = 0;
    schedulerTimer = setInterval(scheduler, LOOKAHEAD_MS);
  }

  const roleBase = {};
  function setRoleBase(role, v) { roleBase[role] = v; applyRoleGain(role); }
  function applyRoleGain(role) {
    const bus = roleBus[role];
    if (!bus || !ctx) return;
    const target = bus.muted ? 0 : (roleBase[role] || 1) * bus.level;
    bus.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.015);
  }

  /* ---------------- scheduler ---------------- */
  // background tabs throttle timers to ~1s — widen the lookahead there so audio never gaps
  let scheduleAhead = SCHEDULE_AHEAD;
  document.addEventListener("visibilitychange", () => {
    scheduleAhead = document.hidden ? 1.6 : SCHEDULE_AHEAD;
  });

  function scheduler() {
    while (nextStepTime < ctx.currentTime + scheduleAhead) {
      scheduleStep(currentStep, nextStepTime);
      nextStepTime += SECONDS_PER_STEP;
      currentStep++;
    }
  }

  function applyFilterValue(v) {
    filterValue = Math.min(1, Math.max(-1, v));
    if (!ctx) return;
    const t = ctx.currentTime;
    if (Math.abs(filterValue) < 0.06) {
      masterFilter.type = "lowpass";
      masterFilter.frequency.setTargetAtTime(20000, t, 0.03);
      masterFilter.Q.setTargetAtTime(0.9, t, 0.03);
    } else if (filterValue < 0) {
      masterFilter.type = "lowpass";
      const f = 20000 * Math.pow(150 / 20000, -filterValue);
      masterFilter.frequency.setTargetAtTime(f, t, 0.03);
      masterFilter.Q.setTargetAtTime(4, t, 0.03);
    } else {
      masterFilter.type = "highpass";
      const f = 20 * Math.pow(2600 / 20, filterValue);
      masterFilter.frequency.setTargetAtTime(f, t, 0.03);
      masterFilter.Q.setTargetAtTime(4, t, 0.03);
    }
  }

  /* ---------------- rise / drop choreography ---------------- */
  let riser = null; // {state: "armed"|"building", startStep, savedFilter}

  function handleRiser(step, time) {
    if (!riser) return;
    if (riser.state === "armed" && step % STEPS_PER_BAR === 0) {
      riser.state = "building";
      riser.startStep = step;
      riser.savedFilter = filterValue;
      startRiserAudio(time);
      emit("risestart", {});
    }
    if (riser.state !== "building") return;
    const rel = step - riser.startStep;
    if (rel >= 32) {
      // THE DROP
      const saved = riser.savedFilter;
      riser = null;
      playCrash(time);
      applyFilterValue(saved); // hand the filter back to the knob position
      emit("drop", {});
      return;
    }
    // snare roll: 8ths in bar one, 16ths in bar two, rising velocity
    const roll = rel < 16 ? rel % 2 === 0 : true;
    if (roll) playSnare(time, 0.25 + (rel / 32) * 0.55);
    // auto high-pass climb across the build
    const frac = rel / 32;
    masterFilter.type = "highpass";
    masterFilter.frequency.setTargetAtTime(20 + frac * frac * 900, time, 0.05);
    masterFilter.Q.setTargetAtTime(2.5, time, 0.05);
  }

  function scheduleStep(step, time) {
    handleRiser(step, time);
    const building = riser && riser.state === "building";
    for (const deckId of ["a", "b"]) {
      const deck = decks[deckId];
      // quantized start: arm fires on the next bar boundary
      if (deck.pendingStart && step % STEPS_PER_BAR === 0) {
        deck.playing = true;
        deck.pendingStart = false;
        deck.startStep = step;
        deck.startTime = time;
        emit("deckstate", { deck: deckId, playing: true });
      }
      if (!deck.playing) continue;

      const deckGainNow = deckId === "a"
        ? Math.cos(crossfade * Math.PI / 2)
        : Math.sin(crossfade * Math.PI / 2);
      if (deckGainNow < 0.02) continue;

      const loopStep = (step - deck.startStep) % LOOP_STEPS;
      for (const role of ROLES) {
        if (building && (role === "kick" || role === "bass")) continue; // the build strips the floor out
        const events = INDEXED[deckId][role].get(loopStep);
        if (!events) continue;
        for (const ev of events) {
          trigger(role, ev, time, ev.v * deckGainNow);
        }
      }
    }
  }

  function trigger(role, ev, time, vel) {
    if (vel <= 0.001) return;
    switch (role) {
      case "kick": playKick(time, vel); break;
      case "hats": playHat(time, vel, ev.open); break;
      case "perc": ev.rim ? playRim(time, vel) : playClap(time, vel); break;
      case "bass": playBass(time, midi(ev.n), vel, (ev.l || 1) * SECONDS_PER_STEP); break;
      case "chords": playChord(time, ev.n.map(midi), vel); break;
      case "lead": playLead(time, midi(ev.n), vel, (ev.l || 2) * SECONDS_PER_STEP); break;
    }
  }

  /* ---------------- voices ---------------- */
  function out(role) { return roleBus[role].gain; }

  function playKick(t, vel) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    gain.gain.setValueAtTime(vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain);
    gain.connect(out("kick"));
    osc.start(t);
    osc.stop(t + 0.26);
    // click transient
    const click = noiseSource(t, 0.02);
    const cg = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1200;
    cg.gain.setValueAtTime(vel * 0.4, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    click.connect(hp); hp.connect(cg); cg.connect(out("kick"));
  }

  function playHat(t, vel, open) {
    const dur = open ? 0.22 : 0.05;
    const src = noiseSource(t, dur);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 8200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp); hp.connect(g); g.connect(out("hats"));
  }

  function playClap(t, vel) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.011;
      const src = noiseSource(tt, 0.14);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1700;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      const v = vel * (i === 2 ? 1 : 0.45);
      g.gain.setValueAtTime(v, tt);
      g.gain.exponentialRampToValueAtTime(0.001, tt + (i === 2 ? 0.16 : 0.03));
      src.connect(bp); bp.connect(g); g.connect(out("perc"));
    }
  }

  function playRim(t, vel) {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 820;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    osc.connect(bp); bp.connect(g); g.connect(out("perc"));
    osc.start(t); osc.stop(t + 0.05);
  }

  function playBass(t, freq, vel, len) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = freq / 2;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(90 + vel * 700, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.7, t);
    g.gain.setTargetAtTime(0, t + len * 0.75, 0.03);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(vel * 0.35, t);
    sg.gain.setTargetAtTime(0, t + len * 0.75, 0.03);
    osc.connect(lp); lp.connect(g); g.connect(out("bass"));
    sub.connect(sg); sg.connect(out("bass"));
    osc.start(t); osc.stop(t + len + 0.2);
    sub.start(t); sub.stop(t + len + 0.2);
  }

  function playChord(t, freqs, vel) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.32, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3600, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.4);
    g.connect(lp);
    lp.connect(out("chords"));
    lp.connect(delayNode);
    for (const f of freqs) {
      for (const det of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        osc.detune.value = det;
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.5);
      }
    }
  }

  function playLead(t, freq, vel, len) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(len, 0.15));
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    osc.connect(g);
    osc2.connect(g2); g2.connect(g);
    g.connect(out("lead"));
    g.connect(delayNode);
    osc.start(t); osc.stop(t + len + 0.1);
    osc2.start(t); osc2.stop(t + len + 0.1);
  }

  function playSnare(t, vel) {
    const src = noiseSource(t, 0.16);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1900;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    src.connect(bp); bp.connect(g); g.connect(out("perc"));
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vel * 0.3, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(og); og.connect(out("perc"));
    osc.start(t); osc.stop(t + 0.1);
  }

  function playCrash(t) {
    const src = noiseSource(t, 1.4);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 4200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    src.connect(hp); hp.connect(g); g.connect(compressor);
  }

  function startRiserAudio(t) {
    const dur = SECONDS_PER_STEP * 32;
    const src = noiseSource(t, dur);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(5200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.34, t + dur);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
    src.connect(bp); bp.connect(g); g.connect(compressor);
  }

  let noiseBuffer = null;
  function noiseSource(t, dur) {
    if (!noiseBuffer) {
      const len = ctx.sampleRate * 0.5;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.start(t);
    src.stop(t + dur + 0.02);
    return src;
  }

  /* ---------------- events out ---------------- */
  const listeners = {};
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, data) { (listeners[evt] || []).forEach((fn) => fn(data)); }

  /* ---------------- public API ---------------- */
  const levelBuf = new Uint8Array(128);
  function rms(analyser) {
    analyser.getByteTimeDomainData(levelBuf);
    let sum = 0;
    for (let i = 0; i < levelBuf.length; i++) {
      const v = (levelBuf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / levelBuf.length) * 2.6);
  }

  let freqBuf = null;
  function bands() {
    if (!ctx) return { low: 0, mid: 0, high: 0, master: 0 };
    if (!freqBuf) freqBuf = new Uint8Array(masterAnalyser.frequencyBinCount);
    masterAnalyser.getByteFrequencyData(freqBuf);
    const n = freqBuf.length;
    const avg = (from, to) => {
      let s = 0;
      for (let i = from; i < to; i++) s += freqBuf[i];
      return s / (to - from) / 255;
    };
    return {
      low: avg(1, Math.floor(n * 0.06)),
      mid: avg(Math.floor(n * 0.06), Math.floor(n * 0.35)),
      high: avg(Math.floor(n * 0.35), Math.floor(n * 0.8)),
      master: rms(masterAnalyser),
    };
  }

  return {
    get BPM() { return bpm; },
    ROLES,
    get ready() { return !!ctx; },
    init,

    toggleDeck(id) {
      init();
      if (ctx.state === "suspended") ctx.resume();
      const deck = decks[id];
      if (deck.playing || deck.pendingStart) {
        deck.playing = false;
        deck.pendingStart = false;
        emit("deckstate", { deck: id, playing: false });
      } else {
        const anyRunning = decks.a.playing || decks.b.playing || decks.a.pendingStart || decks.b.pendingStart;
        deck.pendingStart = true; // quantized to the next bar → always beatmatched
        if (!anyRunning) {
          // nothing else is running — restart the transport so sound is immediate,
          // instead of waiting up to a bar for the old grid to come around
          currentStep = 0;
          nextStepTime = ctx.currentTime + 0.03;
        }
      }
      return deck.playing || deck.pendingStart;
    },

    cueDeck(id) {
      const deck = decks[id];
      deck.playing = false;
      deck.pendingStart = false;
      if (riser && !decks.a.playing && !decks.b.playing) {
        // build with no music = pointless; cancel and give the filter back
        const saved = riser.savedFilter;
        riser = null;
        applyFilterValue(saved);
      }
      emit("deckstate", { deck: id, playing: false });
    },

    isPlaying(id) { return decks[id].playing || decks[id].pendingStart; },
    anyPlaying() { return decks.a.playing || decks.b.playing || decks.a.pendingStart || decks.b.pendingStart; },

    deckElapsed(id) {
      const deck = decks[id];
      if (!deck.playing || !ctx) return 0;
      return Math.max(0, ctx.currentTime - deck.startTime);
    },
    deckPhase(id) {
      const deck = decks[id];
      if (!deck.playing || !ctx) return 0;
      const elapsed = ctx.currentTime - deck.startTime;
      return (elapsed / (SECONDS_PER_STEP * LOOP_STEPS)) % 1;
    },

    setFader(role, v) {
      if (!roleBus[role]) return;
      roleBus[role].level = v;
      applyRoleGain(role);
    },
    toggleMute(role) {
      if (!roleBus[role]) return false;
      roleBus[role].muted = !roleBus[role].muted;
      applyRoleGain(role);
      return roleBus[role].muted;
    },
    setCrossfade(v) { crossfade = Math.min(1, Math.max(0, v)); },

    // low rumble under a lightning strike — bypasses the DJ filter on purpose
    thunder(intensity = 0.8) {
      if (!ctx) return;
      const t = ctx.currentTime + 0.02;
      const dur = 2.2 + Math.random() * 0.8;
      const src = ctx.createBufferSource();
      noiseSource(t, 0); // ensure the shared noise buffer exists
      src.buffer = noiseBuffer;
      src.loop = true;
      src.playbackRate.value = 0.3 + Math.random() * 0.12;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(340, t);
      lp.frequency.exponentialRampToValueAtTime(55, t + dur);

      const g = ctx.createGain();
      const peak = 0.3 * Math.min(1, intensity);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.05);
      g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.5);
      g.gain.exponentialRampToValueAtTime(peak * 0.6, t + 0.85); // rolling secondary swell
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      src.connect(lp);
      lp.connect(g);
      g.connect(compressor);
      src.start(t);
      src.stop(t + dur + 0.1);
    },

    setFilter(v) {
      applyFilterValue(v);
    },

    setBpm(v) {
      bpm = Math.min(134, Math.max(118, v));
      SECONDS_PER_STEP = 60 / bpm / 4;
      if (ctx && delayNode) delayNode.delayTime.setTargetAtTime(SECONDS_PER_STEP * 3, ctx.currentTime, 0.08);
      emit("tempo", { bpm });
      return bpm;
    },
    getBpm() { return bpm; },

    // 2-bar build (kick+bass stripped, snare roll, riser, auto HPF climb) → drop
    riseDrop() {
      init();
      if (ctx.state === "suspended") ctx.resume();
      if (!this.anyPlaying()) return false;
      if (riser) return true; // already armed or building
      riser = { state: "armed", startStep: 0, savedFilter: filterValue };
      emit("risearm", {});
      return true;
    },
    isRising() { return !!riser; },

    // vinyl spinback: descending screech, then the deck stops
    spinback(id) {
      if (!ctx || !decks[id].playing) return false;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.85);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.22, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(180, t + 0.85);
      osc.connect(lp); lp.connect(og); og.connect(compressor);
      osc.start(t); osc.stop(t + 0.95);
      const src = noiseSource(t, 0.9);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.12, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
      src.connect(ng); ng.connect(lp);
      setTimeout(() => this.cueDeck(id), 780);
      emit("spinback", { deck: id });
      return true;
    },
    getFilter() { return filterValue; },

    roleLevel(role) {
      const bus = roleBus[role];
      if (!bus || !ctx) return 0;
      return rms(bus.analyser);
    },
    bands,
    on,
  };
})();
