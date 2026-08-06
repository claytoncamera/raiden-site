/* ============================================================
   RAIDEN — site behavior
   Nav, lighting desk, spotlight, reveals, beat veil, forms.
   ============================================================ */

(() => {
  // EDITME: wire the real booking inbox + socials here
  const BOOKING_EMAIL = ""; // e.g. "bookings@raiden.com" — empty shows a friendly notice
  const SOCIALS = {
    soundcloud: "", // e.g. "https://soundcloud.com/raiden"
    instagram: "",
    tiktok: "",
    youtube: "",
    spotify: "",
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- preloader: one bolt flash per session ---------- */
  const preloader = document.getElementById("preloader");
  if (preloader && preloader.style.display !== "none") {
    setTimeout(() => {
      preloader.classList.add("done");
      try { sessionStorage.setItem("raiden-seen", "1"); } catch (_) {}
    }, reduceMotion ? 0 : 750);
  }

  // ?static=1 — deterministic no-animation render (screenshots, SEO audits, perf tests)
  if (new URLSearchParams(location.search).has("static")) {
    document.documentElement.classList.add("static-mode");
  }

  /* ---------- nav ---------- */
  const nav = document.getElementById("nav");
  const burger = document.getElementById("navBurger");
  const links = document.getElementById("navLinks");

  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 30);
  }, { passive: true });

  burger.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    nav.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("open");
      nav.classList.remove("menu-open");
      burger.setAttribute("aria-expanded", "false");
    })
  );

  /* ---------- lighting desk ---------- */
  const dots = document.querySelectorAll(".light-dot");
  function setLight(name, save = true) {
    document.documentElement.setAttribute("data-light", name);
    dots.forEach((d) => d.classList.toggle("active", d.dataset.light === name));
    if (save) try { localStorage.setItem("raiden-light", name); } catch (_) {}
  }
  dots.forEach((d) => d.addEventListener("click", () => {
    setLight(d.dataset.light);
    if (window.RaidenStrike && !reduceMotion) RaidenStrike(); // new lights, new strike
  }));
  let savedLight = "storm";
  try { savedLight = localStorage.getItem("raiden-light") || "storm"; } catch (_) {}
  setLight(savedLight, false);

  /* ---------- cursor spotlight (desktop, fine pointers only) ---------- */
  const spotlight = document.getElementById("spotlight");
  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    let raf = null;
    window.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        spotlight.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        raf = null;
      });
      document.body.classList.add("spotlight-on");
    }, { passive: true });
  }

  /* ---------- scroll reveals ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add("visible");
          io.unobserve(en.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- beat veil + nav VU (pulse with the music) ---------- */
  const veil = document.getElementById("beatVeil");
  const navVu = document.getElementById("navVu");
  const vuBars = navVu ? Array.from(navVu.children) : [];
  const titleGlowEl = document.querySelector(".hero-title");
  if (!reduceMotion) {
    let smooth = 0;
    (function pulse() {
      const playing = window.RaidenAudio && RaidenAudio.ready && RaidenAudio.anyPlaying();
      if (playing) {
        const b = RaidenAudio.bands();
        smooth += (b.low - smooth) * 0.25;
        veil.style.opacity = (smooth * 0.14).toFixed(3);
        if (navVu) {
          navVu.classList.add("on");
          vuBars[0].style.height = `${3 + b.low * 10}px`;
          vuBars[1].style.height = `${3 + b.mid * 10}px`;
          vuBars[2].style.height = `${3 + b.high * 10}px`;
        }
        if (titleGlowEl) titleGlowEl.style.setProperty("--tg", `${Math.round(55 + b.low * 90)}px`);
      } else {
        if (smooth > 0.001) {
          smooth *= 0.94;
          veil.style.opacity = (smooth * 0.14).toFixed(3);
        }
        if (navVu) navVu.classList.remove("on");
      }
      requestAnimationFrame(pulse);
    })();
  }

  /* ---------- stream bar: REC clock + viewers ---------- */
  const recPill = document.getElementById("streamRec");
  const recLabel = document.getElementById("streamRecLabel");
  const clock = document.getElementById("streamClock");
  const viewersEl = document.getElementById("streamViewers");
  let viewers = 0;
  if (recPill) {
    setInterval(() => {
      const playing = window.RaidenAudio && RaidenAudio.ready && RaidenAudio.anyPlaying();
      recPill.classList.toggle("live", !!playing);
      recLabel.textContent = playing ? "LIVE" : "STANDBY";
      if (playing) {
        const s = Math.max(RaidenAudio.deckElapsed("a"), RaidenAudio.deckElapsed("b"));
        const m = Math.floor(s / 60);
        clock.textContent = `${String(m).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
        if (!viewers) viewers = 84 + Math.floor(Math.random() * 70);
        viewers = Math.max(60, viewers + Math.floor(Math.random() * 7) - 2);
        viewersEl.textContent = `${viewers.toLocaleString()} watching`;
      } else {
        clock.textContent = "00:00";
        if (viewers) { viewers = 0; viewersEl.textContent = "— watching"; }
      }
    }, 1000);
  }

  /* ---------- storm ↔ page coupling ---------- */
  const heroTitle = document.querySelector(".hero-title");
  const heroInner = document.querySelector(".hero-inner");

  // lightning jolt on the title when the storm targets it
  let joltTimer = null;
  window.addEventListener("raiden:strike", (e) => {
    if (!heroTitle || reduceMotion) return;
    if (e.detail && e.detail.title) {
      heroTitle.classList.add("jolt");
      clearTimeout(joltTimer);
      joltTimer = setTimeout(() => heroTitle.classList.remove("jolt"), 240);
    }
  });

  // gentle hero parallax + fade on scroll
  if (heroInner && !reduceMotion) {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < window.innerHeight) {
          heroInner.style.transform = `translateY(${y * 0.28}px)`;
          heroInner.style.opacity = String(Math.max(0.3, 1 - y / 900));
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- camera tilt on the rig (fine pointers only) ---------- */
  const streamStage = document.getElementById("streamStage");
  const boothRig = document.getElementById("boothRig");
  if (streamStage && boothRig && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    streamStage.addEventListener("pointermove", (e) => {
      const r = streamStage.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      boothRig.style.transform = `perspective(1400px) rotateY(${nx * 2.4}deg) rotateX(${-ny * 1.6}deg)`;
    });
    streamStage.addEventListener("pointerleave", () => {
      boothRig.style.transform = "";
    });
  }

  /* ---------- hero CTA ---------- */
  // some environments silently drop smooth scrolls — verify movement, fall back to instant
  function scrollToEl(el) {
    const startY = window.scrollY;
    el.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth" });
    setTimeout(() => {
      if (Math.abs(window.scrollY - startY) < 5) el.scrollIntoView({ behavior: "instant" });
    }, 400);
  }
  document.getElementById("dropBeatBtn").addEventListener("click", () => {
    if (window.RaidenBooth) RaidenBooth.dropTheBeat();
    scrollToEl(document.getElementById("booth"));
  });

  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute("href");
    if (href === "#") return; // placeholder links handle themselves
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    history.pushState(null, "", href);
    scrollToEl(target);
  });

  /* ---------- toast ---------- */
  const toast = document.getElementById("toast");
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
  }

  /* ---------- booking form ---------- */
  document.getElementById("bookForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const note = document.getElementById("formNote");
    const body = [
      `Name: ${data.get("name")}`,
      `Email: ${data.get("email")}`,
      `Date: ${data.get("date") || "TBD"}`,
      `Venue/City: ${data.get("venue") || "TBD"}`,
      "",
      data.get("message") || "",
    ].join("\n");

    if (BOOKING_EMAIL) {
      const subject = encodeURIComponent(`Booking inquiry — ${data.get("venue") || "event"}`);
      window.location.href = `mailto:${BOOKING_EMAIL}?subject=${subject}&body=${encodeURIComponent(body)}`;
      note.textContent = "Opening your email app…";
    } else {
      // booking inbox not wired yet — don't lose the lead's effort
      navigator.clipboard?.writeText(body).catch(() => {});
      note.textContent = "Booking inbox is being set up — your message was copied to your clipboard. DM it on socials for now.";
      showToast("⚡ Copied your inquiry — booking inbox coming online soon.");
    }
  });

  /* ---------- newsletter (all .newsletter forms share the handler) ---------- */
  document.querySelectorAll(".newsletter").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // EDITME: connect Mailchimp/Buttondown/Resend here (see README)
      showToast("⚡ List opens soon — the first drop goes out to it.");
      e.target.reset();
    });
  });

  /* ---------- socials ---------- */
  document.querySelectorAll(".footer-socials a").forEach((a) => {
    const url = SOCIALS[a.dataset.social];
    if (url) {
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        showToast("⚡ Profiles connecting soon.");
      });
    }
  });

  /* ---------- scroll-spy: highlight the section you're in ---------- */
  const spyLinks = new Map();
  document.querySelectorAll('.nav-links > a[href^="#"]').forEach((a) => {
    const id = a.getAttribute("href").slice(1);
    if (document.getElementById(id)) spyLinks.set(id, a);
  });
  const spy = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        spyLinks.forEach((a, id) => a.classList.toggle("active", id === en.target.id));
      }
    },
    { rootMargin: "-35% 0px -55% 0px" }
  );
  spyLinks.forEach((_, id) => spy.observe(document.getElementById(id)));

  /* ---------- scroll progress + back-to-top + kanji drift ---------- */
  const progressBar = document.getElementById("scrollProgress");
  const backTop = document.getElementById("backTop");
  const kanjiL = document.querySelector(".hero-kanji-l");
  const kanjiR = document.querySelector(".hero-kanji-r");
  let scrollTick = false;
  window.addEventListener("scroll", () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressBar) progressBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      if (backTop) backTop.classList.toggle("show", y > 700);
      if (!reduceMotion && y < window.innerHeight) {
        if (kanjiL) kanjiL.style.transform = `translateY(${y * 0.12}px)`;
        if (kanjiR) kanjiR.style.transform = `translateY(${-y * 0.08}px)`;
      }
      scrollTick = false;
    });
  }, { passive: true });
  if (backTop) {
    backTop.addEventListener("click", () => {
      reduceMotion ? window.scrollTo(0, 0) : window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => { if (window.scrollY > 50) window.scrollTo(0, 0); }, 450);
    });
  }

  /* ---------- hero "now playing" chip ---------- */
  const npChip = document.getElementById("heroNowPlaying");
  const npText = document.getElementById("heroNowPlayingText");
  if (npChip) {
    setInterval(() => {
      const ready = window.RaidenAudio && RaidenAudio.ready;
      const a = ready && RaidenAudio.isPlaying("a");
      const b = ready && RaidenAudio.isPlaying("b");
      npChip.classList.toggle("on", !!(a || b));
      if (a || b) {
        npText.textContent = `LIVE — ${a && b ? "VOLTAGE + ION RAIN" : a ? "VOLTAGE" : "ION RAIN"} · 126`;
      }
    }, 800);
  }

  /* ---------- GOD MODE: type the name, wake the god ---------- */
  const godDot = document.querySelector('.light-dot[data-light="overdrive"]');
  function unlockGod(activate) {
    if (godDot) godDot.classList.add("unlocked");
    try { localStorage.setItem("raiden-god", "1"); } catch (_) {}
    if (activate) {
      setLight("overdrive");
      showToast("⚡⚡ GOD MODE — 雷神 awakened. OVERDRIVE lighting unlocked.");
      if (window.RaidenStrike && !reduceMotion) {
        RaidenStrike();
        setTimeout(() => RaidenStrike(), 200);
        setTimeout(() => RaidenStrike(), 430);
      }
      window.dispatchEvent(new CustomEvent("raiden:godmode"));
    }
  }
  try { if (localStorage.getItem("raiden-god")) unlockGod(false); } catch (_) {}
  let typed = "";
  document.addEventListener("keydown", (e) => {
    if (e.target && e.target.matches && e.target.matches("input, textarea, select")) return;
    if (!e.key || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === "raiden") { typed = ""; unlockGod(true); }
  });

  /* ---------- achievements ---------- */
  const ACHV = [
    { id: "first_drop", icon: "⚡", name: "FIRST CONTACT", hint: "drop the beat" },
    { id: "two_decks", icon: "🌀", name: "DOUBLE STORM", hint: "run both decks at once" },
    { id: "sweeper", icon: "🎛", name: "FILTER SURGEON", hint: "sweep the filter both ways" },
    { id: "summoner", icon: "🌩", name: "STORM SUMMONER", hint: "summon 5 bolts by hand" },
    { id: "lights", icon: "💡", name: "LIGHTING TECH", hint: "run every lighting preset" },
    { id: "drop_lord", icon: "🔥", name: "DROP COMMANDER", hint: "ride a RISE to the drop" },
    { id: "god", icon: "⛩", name: "雷神", hint: "speak the name" },
  ];
  let achState = {};
  try { achState = JSON.parse(localStorage.getItem("raiden-achv") || "{}"); } catch (_) {}
  const achRow = document.getElementById("footerAchv");
  function renderAchv() {
    if (!achRow) return;
    achRow.innerHTML = "";
    for (const a of ACHV) {
      const s = document.createElement("span");
      s.className = "achv" + (achState[a.id] ? " got" : "");
      s.textContent = a.icon;
      s.title = achState[a.id] ? `${a.name} — unlocked` : `??? — ${a.hint}`;
      achRow.appendChild(s);
    }
  }
  function award(id) {
    if (achState[id]) return;
    achState[id] = true;
    try { localStorage.setItem("raiden-achv", JSON.stringify(achState)); } catch (_) {}
    const a = ACHV.find((x) => x.id === id);
    showToast(`🏆 ${a.icon} ${a.name} — unlocked`);
    window.dispatchEvent(new CustomEvent("raiden:achievement", { detail: { name: a.name } }));
    renderAchv();
  }
  renderAchv();

  // achievement triggers
  let sweepLow = false, sweepHigh = false, manualBolts = 0;
  const lightsSeen = new Set();
  window.addEventListener("raiden:action", (e) => {
    const d = e.detail || {};
    if (d.type === "play" && d.on) {
      award("first_drop");
      if (window.RaidenAudio && RaidenAudio.isPlaying("a") && RaidenAudio.isPlaying("b")) award("two_decks");
    }
    if (d.type === "filter") {
      if (d.v < -0.6) sweepLow = true;
      if (d.v > 0.6) sweepHigh = true;
      if (sweepLow && sweepHigh) award("sweeper");
    }
    if (d.type === "drop") award("drop_lord");
  });
  window.addEventListener("raiden:strike", (e) => {
    if (e.detail && e.detail.manual) {
      manualBolts++;
      if (manualBolts >= 5) award("summoner");
    }
  });
  dots.forEach((d) => d.addEventListener("click", () => {
    lightsSeen.add(d.dataset.light);
    if (["storm", "ember", "acid", "ice"].every((l) => lightsSeen.has(l))) award("lights");
  }));
  window.addEventListener("raiden:godmode", () => award("god"));

  /* ---------- footer year ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
})();
