# Attention Engine

An evolving, cinematic single-page website built around a client-side **Attention Engine** — a
lightweight system that watches how you move, scroll, click and linger, then subtly reshapes the
page's motion, pacing and novelty in real time.

No build step, no framework, no dependencies beyond two Google Fonts. Just semantic HTML, modular
vanilla JS, and CSS driven by the engine's own custom properties.

## Run it locally

Because the JS is loaded as classic (non-module) scripts, you can open `index.html` directly, but
serving it avoids any browser file:// quirks:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Tests

```bash
node tests/run.js
```

Zero dependencies. The engagement model is a pure function by design, so these tests pin down its
contract — score always in `0..1`, modes always ones the adapter can render, purity, monotonicity
(rising engagement never moves the mode backwards). Anyone swapping the heuristic for a trained
model should be able to run these unchanged.

## Architecture

The engine is split into four isolated layers, wired together only in `js/main.js`:

```
Interaction Signals  →  Engagement Model  →  Attention State  →  Experience Adaptation
   js/attention/          js/attention/         js/attention/         js/attention/
   signals.js            engagementModel.js    attentionState.js    experienceAdapter.js
```

- **signals.js** — observes raw browser events (pointer, scroll, clicks, dwell, idle time) and
  reduces them into a snapshot on a fixed tick. Knows nothing about "attention."
- **engagementModel.js** — a pure, stateless heuristic (`computeEngagement(snapshot) → {score, mode}`)
  with editable weights/thresholds. Swap this for a trained model later without touching anything else.
- **attentionState.js** — smooths the score and applies hysteresis to the mode, and emits the
  engine's meaningful moments: `tick`, `modechange`, `invite` (gentle idle nudge), `evolve`
  (fixation → change, don't repeat), `reward` (sustained flow → rare payoff).
- **experienceAdapter.js** — the only module allowed to touch the DOM. Sets `--ae-*` CSS custom
  properties and `attn-*` body classes, and rebroadcasts engine moments as `attention:*` DOM
  CustomEvents for any component to listen to.

`sessionRecorder.js` sits alongside them as an optional observer: it keeps a bounded record of the
whole visit (sections, dwell, clicks, scroll rhythm, mode transitions) so features can look
backward. It produces data only — never pixels.

Visual components (`js/components/*.js`) — WebGL aurora field, particle field, cursor, kinetic hero
typography, the Attention Mode indicator, tilting cards, scroll-driven story, physics playground,
sound engine, easter eggs, journey memory — all consume `attention:*` events and `--ae-*` variables
without ever importing the engine directly.

## Things worth finding

- **Your Attention Signature** — a generative artwork drawn from your actual visit. Rings are the
  sections you reached (sweep = dwell time), nodes are where you clicked, the inner trace is your
  scroll rhythm, and the palette comes from the deepest attention mode you hit. Save it as a PNG.
- **Command palette** — `⌘K` / `Ctrl+K`, or just press `/`.
- **The footer** rewrites itself based on how you actually moved through the page.
- **It remembers you.** A tiny local-only summary (visit count, deepest mode) means a second visit
  opens differently. "Forget me" is in the command palette.
- **Motion tilt + haptics on phones** — gyroscope stands in for a cursor; short pulses mark real
  moments only.
- Two hidden easter eggs. No hints here.

## Graceful degradation

Respects `prefers-reduced-motion`, keeps the custom cursor off touch devices, and catches
`localStorage` / Clipboard / Web Audio failures rather than letting them surface.

Effect budget is decided in two stages. `detectDeviceTier()` makes a static guess at load from core
count and memory; `performanceGovernor.js` then measures the frame rate actually being delivered
and scales the whole budget to match — downgrading readily, upgrading reluctantly, never
oscillating. If the frame rate stays poor, the WebGL aurora retires itself first, since it's the
most expensive thing on the page. Read the live numbers with `AttentionEngine.getPerformance()`.

The WebGL layer is optional at every step: low-tier device, reduced-motion, missing WebGL, lost
context, or a sustained frame-rate drop all end with the 2D particle field carrying the environment
alone. Each component is also initialized behind a guard in `main.js`, so one failing at startup
degrades that feature instead of aborting the page.

## Known trade-offs

Several components run their own `requestAnimationFrame` loop rather than sharing one scheduler.
Each loop is cheap and skips work when idle, and the governor measures the real-world result — but
consolidating them behind a single scheduler is the obvious next optimization if the component
count grows.
