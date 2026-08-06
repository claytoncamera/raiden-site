# CLAUDE.md — RAIDEN site (agent-facing project brief)

<!-- last touched: 2026-08-06 -->


> This file is for whichever Claude Code session opens this repo next — most likely **Raiden's**.
> If you're a human reading this: it's written to brief an AI coding agent with zero prior context
> on what this project is, what already exists, what's still needed, and what the rules are. Read
> it before touching anything, same as you would for a project you're picking up mid-stream.

## What this is

A marketing + booking site for a house DJ named **Raiden**, built around his real rig (Pioneer
DJM-V10 mixer + 2 CDJs) and a "house music, struck by lightning" identity (雷電 — Japanese for
"thunder and lightning"). It's **live in production** at **https://raiden.biz**.

It was built by Clayton (a friend of Raiden's, handling the marketing/build side) across one
extended session — 10 build waves, going from a blank idea to a live, verified, deployed site.
Nothing here is a mockup or a draft; every feature described below is real, working code that has
been checked in an actual browser, not just written and assumed correct.

**Repo:** `github.com/claytoncamera/raiden-site` (public, standalone — not a fork, not nested in
anything else). **Live:** raiden.biz, HTTPS working. **Stack:** plain HTML/CSS/JS. **Zero build
step, zero dependencies, zero framework.** There is nothing to `npm install`. Open `index.html` in
a server and it runs.

## Run it locally

```bash
python3 -m http.server 4173
# → http://localhost:4173
```

Any static file server works — this is intentionally the simplest possible stack so it never rots
and anyone (technical or not) can pick it up years from now. If you add a `?static=1` query param
(`http://localhost:4173/?static=1`) the site renders with all animation/motion disabled — useful
for screenshots or quick visual diffing since it removes timing nondeterminism.

**Verify visually, not just by reading the diff.** Nearly every feature here is a canvas animation,
a Web Audio synth, or a CSS interaction — none of that is verifiable by eyeballing source. Actually
load the page in a browser (or headless Chrome + screenshot) and interact with the thing you
changed before calling it done. The whole site was built this way — every wave was screenshot- and
console-verified before being called finished, not just written and assumed correct.

## What already exists — read this before adding anything

The site is far more built-out than it might look from the file count. Full inventory:

| Feature | Files | What it does |
|---|---|---|
| **Playable booth** | `js/audio.js`, `js/booth.js` | A real Web Audio synth engine — two decks ("VOLTAGE" / "ION RAIN"), 6 mixer channels (kick/hats/perc/bass/chords/lead) with live faders, mutes, LED meters, an equal-power crossfader, an LPF/HPF filter knob, bar-quantized starts so it's always beatmatched. All synthesized in-browser — no audio files anywhere. |
| **⚡ RISE/DROP** | `js/audio.js`, `js/booth.js` | A button that runs a real 2-bar build (snare roll, riser, auto-filter climb, kick/bass drop out) then crashes into the drop with a lightning strike. |
| **Tempo slider** | `js/booth.js` | 118–134 BPM, whole engine follows live. |
| **Platter spinback** | `js/booth.js` | Drag a spinning platter and let go → vinyl screech, deck stops. |
| **Hero storm** | `js/visualizer.js` | Canvas: fractal lightning (leader → strike → afterglow, branches, impact ripples), storm clouds, sheet lightning, rain, crowd silhouettes, cursor sparks. Audio-reactive when the booth plays. Click empty sky to summon a bolt. |
| **Thunder** | `js/audio.js` | Synthesized rumble under strikes (post audio-unlock only). |
| **Lighting desk** | `css/style.css`, `js/main.js` | 4 presets (Violet Storm / Ember / Acid / Ice) re-theme the whole site via CSS vars. Plus a **5th secret one** — type "raiden" anywhere on the page to unlock gold **OVERDRIVE** lighting (Easter egg, don't remove it). |
| **Boiler-room stream frame** | `index.html`, CSS, `js/main.js` | The booth sits inside fake broadcast chrome — REC/LIVE clock, drifting viewer count, scanlines, camera tilt on pointer move. |
| **Crowd chat (sim)** | `js/chat.js` | Labeled "chat sim" — reacts live to real booth actions (cut the kick → "kick GONE 😭") plus ambient chatter. Has a rave-name generator ("[ join ]" button). |
| **Storm Visuals gallery** | `js/artworks.js` | 6 generative canvas art pieces the site paints itself, click any tile to re-roll it. This is the answer to "we don't have real photos yet" — generated art instead of stock/AI-slop images. |
| **Merch — DROP 001** | `index.html`, `assets/merch/*.jpg` | 4 product cards (tee/hoodie/cap/slipmat) with **real generated product photography** — blank garments were generated with a dark-warehouse/violet-rim-light look matching the site, then the actual bolt/kanji marks were composited on top (never AI-redrawn). No prices, no fake stock — honestly labeled "in the lab." |
| **Achievements** | `js/main.js` | 7 hidden achievements (localStorage), footer trophy row, unlock toasts. Part of the "make it fun" layer — don't strip this out casually, it's deliberate. |
| **Sections** | `index.html` | Hero → Booth → Mixes → Visuals → Dates → Merch → About → Press Kit → Booking → Footer. |

Everything above is already tuned for `prefers-reduced-motion` and mobile. **No strobe effects
anywhere, on purpose** (photosensitivity) — if you add flashing/rapid-motion effects, keep them
out of the reduced-motion path and avoid true strobe (rapid full-brightness flicker).

## What's still a placeholder — the real punch list

The site was built ahead of having Raiden's real details, so it ships with **honest placeholders**,
never fake data. These are the actual gaps, each marked `EDITME` in source:

1. **Booking email** — `js/main.js` → `BOOKING_EMAIL` constant (currently empty; the form falls
   back to copying the inquiry to clipboard until this is set).
2. **Social URLs** — `js/main.js` → `SOCIALS` object (soundcloud/instagram/tiktok/youtube/spotify).
3. **Real mixes** — `index.html` mixes section, 3 cards currently say "Dropping soon"; swap for
   real SoundCloud/Mixcloud embeds (snippet already in a comment right above each card).
4. **Real gigs** — `index.html` dates section; currently an honest "booking now" empty state, no
   fake shows. Sample row markup is in a comment.
5. **Real press photos** — `index.html` press section, 3 dashed placeholder tiles.
6. **Real bio** — `index.html` about section. Written honest and vague on purpose (no invented
   accolades, no made-up residencies) — needs Raiden's actual story.
7. **EPK PDF** — press section button currently routes to the booking form as a stopgap.
8. **Newsletter** — `js/main.js`, wire a real provider (Mailchimp/Buttondown/Resend).
9. **Gear/story accuracy check** — the whole identity assumes DJM-V10 + 2 CDJs, house genre,
   ~126 BPM range, deep→peak-time style. Confirm this is actually right, or it all needs a
   pass — the entire visual/audio identity is built around these specifics.

## Design rules — keep these if you extend the site

- **Catchy, not pushy.** One accent CTA per screen. No popups, no fake urgency, no countdown
  timers.
- **Never fake data.** No invented testimonials, fake follower counts, fake past gigs, or stock
  photography pretending to be Raiden. If real content isn't available yet, an honest "coming
  soon" beats a fabricated placeholder — this has been the rule the whole build.
- **The booth is the brand.** The signature move here — the thing that makes this different from a
  template DJ site — is that his actual rig is a working instrument in the browser. Any new
  feature should ideally deepen that idea rather than compete with it.
- **Identity:** 雷電 (thunder/lightning), bolt mark, storm vocabulary, dark theme with violet as
  the default accent (swappable via the lighting desk).
- **Fonts:** Unbounded (display/headings), Space Grotesk (body), JetBrains Mono (labels/timestamps).

## Deploy

This is **GitHub Pages**, deployed via a **GitHub Actions workflow**
(`.github/workflows/deploy-pages.yml`) rather than the older branch-build system — that's a
deliberate choice, not an accident. A `CNAME` file in the repo root points it at raiden.biz.
**Pushing to `main` deploys automatically**, usually live within a minute or two.

If a deploy ever seems stuck, check the **Actions tab** on GitHub
(`github.com/claytoncamera/raiden-site/actions`) rather than Settings → Pages — that's where the
real status and logs are now. If a run is sitting queued for an unusually long time (more than a
few minutes with zero progress), cancel it and re-run — that alone has resolved every stall seen
so far. **Don't chase the `repos/.../pages` API status field or curl the live site to judge deploy
health** — both have been observed lagging or reporting stale state; the Actions run's own
status/logs are the source of truth.

**Contributing changes back:** the repo is currently owned by Clayton (`claytoncamera/raiden-site`,
public). If you don't have direct push access to `main`, the normal flow is: fork it, make changes
on the fork, open a Pull Request — Clayton reviews and merges, which deploys automatically. If
you've been given direct collaborator access instead, you can push straight to `main`. Either way
works with this repo; ask Clayton which he'd prefer if it's not obvious.

HTTPS is live (`https://raiden.biz` serves a valid cert). The `www` subdomain redirects to the
apex. `robots.txt` / `sitemap.xml` / OG share image (`assets/og.png`) / apple-touch-icon are all
already wired for a real domain — nothing to configure there.

## A tooling note, so you don't get stuck

The merch product photos (`assets/merch/*.jpg`) and the OG share image (`assets/og.png`) were made
with an AI image-generation tool connected to the session that built this site — not anything
baked into the repo. The images themselves are just static JPEGs/PNGs now; they'll display fine
for anyone, no special access needed. But if you want to **generate new ones** (extend the merch
line, redo a photo, make new art), that depends on whatever image-generation tooling is available
in *your* Claude session — it may or may not be the same one. If you don't have an equivalent tool
connected, that's not a bug in this repo; it just means image generation isn't available to you
here, the same way it wouldn't be for any other AI coding session without that integration.
Everything else — HTML, CSS, JS, the whole interactive site — has zero such dependency.

## Out of scope for this repo — check with Clayton first

- **DNS / domain registrar** — raiden.biz is registered on GoDaddy under Clayton's account. Don't
  attempt DNS changes from here; if something needs to change at the domain level, that's a
  conversation with Clayton, not a code change.
- **GitHub Pages hosting configuration** (custom domain setting, HTTPS enforcement) — same story,
  low-risk to touch but coordinate first since it's shared infrastructure.
- **Turning the merch section into an actual store** (real prices, real checkout) — deliberately
  not built yet; Clayton and Raiden haven't decided on a platform (Fourthwall/Shopify/etc.) or
  whether it's even in scope. Don't wire payments in without that conversation happening first.

## If you're not sure what to do next

The punch list above (booking email → social URLs → real bio → real mixes → real gigs, roughly in
that order of "least effort, most impact") is the highest-leverage next work. Everything else on
the site already works end-to-end.
<!-- deploy trigger test 1786041483 -->
<!-- push-trigger retest 1786041583 -->
