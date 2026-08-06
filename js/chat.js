/* ============================================================
   RAIDEN — crowd chat (simulated, and labeled as such)
   Reacts to what the visitor actually does in the booth via
   `raiden:action` events, plus ambient chatter while playing.
   ============================================================ */

(() => {
  const log = document.getElementById("chatLog");
  if (!log) return;

  const NAMES = [
    ["warehousewax", "#c084fc"], ["303addict", "#67e8f9"], ["deep_dan", "#86efac"],
    ["hi_hat_harriet", "#fca5a5"], ["lowend_theory", "#fcd34d"], ["acid_annie", "#a3e635"],
    ["groovekeeper", "#93c5fd"], ["nofacecam", "#f9a8d4"], ["bpm_police", "#fdba74"],
    ["basement_bee", "#5eead4"], ["midnight_marta", "#e9d5ff"], ["sub_hz", "#a5b4fc"],
    ["fog_machine_fan", "#d4d4d8"], ["strobe_sober", "#bef264"],
  ];

  const AMBIENT = [
    "CHOON", "ID? ID? ID?", "126 and cruising 🚀", "this bassline is illegal",
    "warehouse air tonight", "the 雷 platter goes hard", "need this on soundcloud NOW",
    "🔥🔥🔥", "crowd cam when", "hands UP", "sub hitting different",
    "signal strong 📡", "certified storm hours", "my neighbors hate me rn",
    "left speaker crew", "groove check ✅", "oi the groove on this",
    "phone torches UP 🔦", "who's recording this", "haze machine earning its keep",
  ];

  const REACT = {
    playA: ["OI OI here we go", "VOLTAGE ⚡", "set time. lock in.", "here. we. go."],
    playB: ["second deck in 👀", "two grooves incoming", "ION RAIN loading…"],
    playBoth: ["both decks spinning 🌀", "this blend about to be nasty"],
    cue: ["rewind lol", "hold up hold up", "pull it back!!"],
    muteKick: ["kick GONE 😭", "where's the kick", "floor check…"],
    unmuteKick: ["THERE'S the kick", "kick back = life back", "OK. OK. OK."],
    muteOther: ["stripping it back", "surgical.", "less is more innit"],
    filterLow: ["sweep it loooow", "underwater mode 🌊", "muffle city"],
    filterHigh: ["airy!! send it back", "tops only, brave", "thin ice mode"],
    filterReset: ["clean reset", "and we're back", "full spectrum restored"],
    xfade: ["blend is butter", "seamless wow", "crossfader work 👌"],
    fader: ["riding the faders", "mixer workout", "V10 getting touched properly"],
  };

  const MAX_MSGS = 42;
  let lastAmbient = [];
  const lastReactAt = {};

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function post(text, name) {
    const [user, color] = name || pick(NAMES);
    const el = document.createElement("div");
    el.className = "chat-msg";
    const b = document.createElement("b");
    b.style.color = color;
    b.textContent = user;
    const span = document.createElement("span");
    span.textContent = text;
    el.append(b, span);
    log.appendChild(el);
    while (log.children.length > MAX_MSGS) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  function react(kind, minGapMs = 5000) {
    const now = Date.now();
    if (now - (lastReactAt[kind] || 0) < minGapMs) return;
    lastReactAt[kind] = now;
    post(pick(REACT[kind]));
  }

  /* ---------- booth action reactions ---------- */
  let filterZone = "mid";
  window.addEventListener("raiden:action", (e) => {
    const d = e.detail || {};
    switch (d.type) {
      case "play":
        if (!d.on) break;
        if (window.RaidenAudio && RaidenAudio.isPlaying("a") && RaidenAudio.isPlaying("b")) react("playBoth", 12000);
        else if (d.deck === "a") react("playA", 10000);
        else react("playB", 10000);
        break;
      case "cue":
        react("cue", 9000);
        break;
      case "mute":
        if (d.role === "kick") react(d.muted ? "muteKick" : "unmuteKick", 6000);
        else if (d.muted) react("muteOther", 9000);
        break;
      case "filter": {
        const zone = d.v < -0.35 ? "low" : d.v > 0.35 ? "high" : "mid";
        if (zone !== filterZone) {
          if (zone === "low") react("filterLow", 6000);
          else if (zone === "high") react("filterHigh", 6000);
          else react("filterReset", 6000);
          filterZone = zone;
        }
        break;
      }
      case "xfade":
        react("xfade", 11000);
        break;
      case "fader":
        react("fader", 14000);
        break;
    }
  });

  /* ---------- lightning reactions (rare) ---------- */
  const STRIKE_LINES = ["did anyone else see that bolt ⚡", "the SKY is mixing too", "lightning on beat??", "storm synced. unreal."];
  let lastStrikeMsg = 0;
  window.addEventListener("raiden:strike", () => {
    const playing = window.RaidenAudio && RaidenAudio.ready && RaidenAudio.anyPlaying();
    if (!playing) return;
    if (Date.now() - lastStrikeMsg < 50000) return;
    lastStrikeMsg = Date.now();
    post(pick(STRIKE_LINES));
  });

  /* ---------- ambient chatter ---------- */
  function ambientTick() {
    const playing = window.RaidenAudio && RaidenAudio.ready && RaidenAudio.anyPlaying();
    if (playing) {
      let msg = pick(AMBIENT);
      let guard = 0;
      while (lastAmbient.includes(msg) && guard++ < 10) msg = pick(AMBIENT);
      lastAmbient.push(msg);
      if (lastAmbient.length > 6) lastAmbient.shift();
      post(msg);
    }
    setTimeout(ambientTick, 5500 + Math.random() * 8500);
  }
  setTimeout(ambientTick, 4000);

  /* ---------- opening state ---------- */
  post("standing by… press play on deck A", ["bpm_police", "#fdba74"]);
  setTimeout(() => {
    if (!(window.RaidenAudio && RaidenAudio.ready && RaidenAudio.anyPlaying())) {
      post("soundcheck when", ["nofacecam", "#f9a8d4"]);
    }
  }, 25000);
})();
