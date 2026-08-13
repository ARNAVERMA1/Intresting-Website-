/**
 * ENGAGEMENT MODEL — layer 2 of the Attention Engine.
 *
 * Responsibility: turn a raw signal snapshot into a single engagement
 * score (0..1) plus a qualitative mode label. This is a pure, stateless
 * heuristic on purpose: swap `computeEngagement` for a trained model or a
 * remote analytics call later without touching signals.js or the rest of
 * the site — the function's shape (snapshot in, {score, mode, meta} out)
 * is the entire contract.
 *
 * Interaction Signals → Engagement Model → Attention State → Experience Adaptation
 *                        ^^^^^^^^^^^^^^^^ this file
 */
(function (global) {
  'use strict';

  const { clamp, map } = global.AEUtils;

  // Tunable weights & thresholds. Kept as plain, editable data so a future
  // developer (or a trained model) can replace the numbers without
  // touching logic.
  const CONFIG = {
    weights: {
      pointerActivity: 0.22,
      scrollActivity: 0.18,
      interactionRate: 0.2,
      focusDwell: 0.2,
      exploration: 0.2,
    },
    normalization: {
      pointerSpeedMax: 1.4, // px/ms considered "very active"
      scrollSpeedMax: 2.2, // px/ms
      interactionsPerWindowMax: 14,
      focusDwellMsMax: 9000, // dwell beyond this doesn't add more "focus"
    },
    idle: {
      gentleMs: 7000, // first invitation cue
      deepMs: 24000, // stronger invitation / ambient shift
    },
    fixation: {
      scoreThreshold: 0.55, // repeatedActionScore above this => "fixated"
    },
    modes: [
      // Evaluated in order; first match wins. `min` is inclusive score floor.
      { id: 'dormant', min: 0 },
      { id: 'ambient', min: 0.18 },
      { id: 'curious', min: 0.4 },
      { id: 'engaged', min: 0.62 },
      { id: 'flow', min: 0.83 },
    ],
  };

  function computeEngagement(snapshot, prevMeta, config = CONFIG) {
    const { weights, normalization, idle, fixation } = config;

    if (snapshot.idleMs >= idle.gentleMs) {
      // Idle overrides everything else — activity terms decay toward 0 the
      // longer the visitor has been still, but focus/exploration built up
      // beforehand still colors *how* idle they read (resting vs. gone).
      const idleFactor = clamp(1 - snapshot.idleMs / (idle.deepMs * 1.4), 0, 1);
      const priorFocus = prevMeta?.focusScore || 0;
      const score = clamp(idleFactor * 0.15 + priorFocus * 0.08, 0, 1);
      const mode = pickMode(score, config);
      return {
        score,
        mode: snapshot.idleMs >= idle.deepMs ? 'dormant' : mode,
        meta: {
          focusScore: priorFocus,
          isIdle: true,
          idleDepth: snapshot.idleMs >= idle.deepMs ? 'deep' : 'gentle',
        },
      };
    }

    const pointerActivity = map(snapshot.pointerSpeed, 0, normalization.pointerSpeedMax, 0, 1);
    const scrollActivity = map(snapshot.scrollSpeed, 0, normalization.scrollSpeedMax, 0, 1);
    const interactionRate = map(
      snapshot.interactionsPerWindow,
      0,
      normalization.interactionsPerWindowMax,
      0,
      1
    );
    const focusScore = map(snapshot.currentSectionDwellMs, 0, normalization.focusDwellMsMax, 0, 1);

    // Exploration rewards visitors who move through the page with intent
    // rather than thrash in one spot — "reward curiosity".
    const explorationRaw = snapshot.scrollDepth * 0.6 + Math.min(snapshot.sectionsVisited / 6, 1) * 0.4;
    const exploration = clamp(explorationRaw, 0, 1);

    let score =
      pointerActivity * weights.pointerActivity +
      scrollActivity * weights.scrollActivity +
      interactionRate * weights.interactionRate +
      focusScore * weights.focusDwell +
      exploration * weights.exploration;

    score = clamp(score, 0, 1);

    const fixated = snapshot.repeatedActionScore >= fixation.scoreThreshold;
    let mode = pickMode(score, config);
    if (fixated) mode = 'fixated';

    return {
      score,
      mode,
      meta: {
        focusScore,
        exploration,
        pointerActivity,
        scrollActivity,
        interactionRate,
        isIdle: false,
        fixatedTargetKey: fixated ? snapshot.fixatedTargetKey : null,
      },
    };
  }

  function pickMode(score, config) {
    let best = config.modes[0].id;
    for (const m of config.modes) {
      if (score >= m.min) best = m.id;
    }
    return best;
  }

  global.AEEngagementModel = { computeEngagement, CONFIG };
})(window);
