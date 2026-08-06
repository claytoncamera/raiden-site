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
  dots.forEach((d) => d.addEventListener("click", () => setLight(d.dataset.light)));
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

  /* ---------- beat veil (glow pulses with the low end) ---------- */
  const veil = document.getElementById("beatVeil");
  if (!reduceMotion) {
    let smooth = 0;
    (function pulse() {
      if (window.RaidenAudio && RaidenAudio.ready && RaidenAudio.anyPlaying()) {
        const b = RaidenAudio.bands();
        smooth += (b.low - smooth) * 0.25;
        veil.style.opacity = (smooth * 0.14).toFixed(3);
      } else if (smooth > 0.001) {
        smooth *= 0.94;
        veil.style.opacity = (smooth * 0.14).toFixed(3);
      }
      requestAnimationFrame(pulse);
    })();
  }

  /* ---------- hero CTA ---------- */
  document.getElementById("dropBeatBtn").addEventListener("click", () => {
    if (window.RaidenBooth) RaidenBooth.dropTheBeat();
    document.getElementById("booth").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
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

  /* ---------- newsletter ---------- */
  document.getElementById("newsletterForm").addEventListener("submit", (e) => {
    e.preventDefault();
    // EDITME: connect Mailchimp/Buttondown/Resend here (see README)
    showToast("⚡ List opens soon — the first drop goes out to it.");
    e.target.reset();
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

  /* ---------- footer year ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
})();
