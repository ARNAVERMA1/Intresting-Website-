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

Visual components (`js/components/*.js`) — cursor, particle field, kinetic hero typography, the
Attention Mode indicator, tilting cards, scroll-driven story, physics playground, sound engine,
easter eggs — all consume `attention:*` events and `--ae-*` variables without ever importing the
engine directly.

Respects `prefers-reduced-motion`, scales particle/motion density down on lower-end devices, and
keeps custom cursor / heavy effects off touch devices.
