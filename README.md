# RAIDEN — Official Site

Marketing + booking site for house DJ **Raiden** (雷電 — "thunder and lightning").
Static, zero build step, vanilla HTML/CSS/JS. Built 2026-08-05 as the foundation to grow on.

## Run it

```bash
python3 -m http.server 4173 -d .
# → http://localhost:4173
```

Any static host works (GitHub Pages, Vercel, Railway static, Hostinger).

## What's in the box

| Piece | File(s) | Notes |
|---|---|---|
| **Playable booth** | `js/audio.js`, `js/booth.js` | Web Audio engine — two decks ("VOLTAGE" deep groove / "ION RAIN" peak-time), six V10-style channel strips (kick/hats/perc/bass/chords/lead) with live faders, mutes, LED meters, crossfader with equal-power curve, LPF/HPF filter knob, bar-quantized deck starts (always beatmatched at 126 BPM). All synthesized — no audio files. |
| **Hero storm** | `js/visualizer.js` | Canvas particle storm + procedural lightning. Audio-reactive when the booth plays (strikes on kick energy), ambient when idle. |
| **Lighting desk** | `css/style.css`, `js/main.js` | 4 club lighting presets (Violet Storm / Ember / Acid / Ice) swap the whole site palette via `html[data-light]` CSS vars; persisted in localStorage. |
| **Sections** | `index.html` | Hero → Booth → Mixes → Dates → About → Press Kit → Booking → Footer. Modeled on what works across top DJ sites (bold hero, one signature interactive element, clear booking CTA). |
| Cursor spotlight, beat-synced glow, ticker, scroll reveals | `js/main.js` | All honor `prefers-reduced-motion`. No strobe anywhere by design (photosensitivity). |
| **Boiler-room stream frame** | `index.html`, `css/style.css`, `js/main.js` | The booth sits inside a live-stream chrome: ● REC/LIVE pill + elapsed clock, drifting viewer count, scanlines + camera vignette, subtle handheld tilt on pointer. |
| **Crowd chat (sim)** | `js/chat.js` | Labeled "chat sim". Reacts to real booth actions via `raiden:action` events (cut the kick → "kick GONE 😭", filter sweep → "sweep it loooow") + ambient chatter while playing. |
| **Stage scene** | `js/scene.js` | Moving-head light beams + floor haze behind the rig (colored by the active lighting preset), crowd silhouettes in front — heads bob to the low end, arms and glowing phones go up on sustained energy. Sleeps when off-screen. |
| **Hero crowd + film grain** | `js/visualizer.js`, `css/style.css` | Silhouette skyline along the hero bottom (audio-reactive), sitewide animated film grain, chromatic aberration on the title, mono/stencil label typography (`[ 01 ]`), outlined ticker words, nav VU meter while live. |
| **Storm system** | `js/visualizer.js` (rewrite) | Fractal lightning: stepped-leader preview → double-flash strike → ember afterglow, recursive branches, impact ripples. Storm clouds (pre-rendered sprites), sheet lightning, angled rain — rain intensifies while the ION RAIN deck plays. A storm-level meter (driven by the low band) escalates everything as the set heats up. Click empty sky to summon a bolt (`RaidenStrike(x, y)` is public). ~28% of strikes aim at the title, which jolts. |
| **Thunder** | `js/audio.js` | Synthesized rumble (looped noise → sweeping lowpass → swell envelope) under strikes, deliberately bypassing the DJ filter. Only fires after audio is gesture-unlocked; cooldown 3.2s. |
| **Title & type extras** | `css/style.css`, `js/main.js` | Beat-reactive title glow, neon flicker on the E, 雷/電 kanji watermarks, hero parallax + fade on scroll, giant outlined footer wordmark, lighthouse-beam sweep on mix-card hover. |

## Placeholders to fill (all marked `EDITME` in source)

1. **Booking email** — `js/main.js` → `BOOKING_EMAIL`. Until set, the form copies the inquiry to clipboard with a friendly notice. Later: swap mailto for Formspree/own endpoint.
2. **Social URLs** — `js/main.js` → `SOCIALS`.
3. **Mixes** — `index.html` mixes section: replace cards' status with real SoundCloud/Mixcloud embeds (snippet in comment).
4. **Dates** — `index.html` dates board: sample row markup is in a comment; the honest "booking now" empty state ships by default (no fake gigs).
5. **Press photos** — replace the three dashed placeholder tiles with real hi-res shots.
6. **Bio** — `index.html` about section; kept honest (no invented accolades). Add city/residency when ready.
7. **EPK PDF** — press section button currently routes to booking; point at a real file when it exists.
8. **Newsletter** — wire Mailchimp/Buttondown/Resend in `js/main.js`.
9. **Domain + OG image** — add `og:image` + canonical once the domain is picked.

## Design notes

- **Identity**: Raiden = Japanese thunder god → lightning bolt mark, 雷/電 platter labels, storm vocabulary. Catchy, not pushy: one accent CTA per screen, quiet copy.
- **Type**: Unbounded (display) + Space Grotesk (body), Google Fonts with system fallbacks.
- **The booth is the brand**: his real rig (DJM-V10 + 2 CDJs) rendered as a playable instrument — the "signature interactive element" pattern that the memorable DJ sites (Deadmau5, Porter Robinson, Eric Prydz) all share.
- Fully responsive; booth stacks vertically on mobile; spotlight disabled on touch.

## Roadmap ideas

- Real mixes + waveform rendering from actual audio files
- MIDI mapping (Web MIDI) so a real controller can drive the booth
- Recording/export of visitor mixes (MediaRecorder on the master bus)
- Gig map, photo gallery lightbox, /epk route with downloadables
- Analytics + booking pipeline (form → email + sheet)
