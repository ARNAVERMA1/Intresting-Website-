/**
 * ATTENTION STATE — layer 3 of the Attention Engine.
 *
 * Responsibility: hold the *stable* current attention state (smoothed
 * score + hysteresis-guarded mode), and emit high-level moments the
 * visual layer can react to without re-deriving them:
 *
 *   - 'tick'        continuous smoothed {score, mode, meta}
 *   - 'modechange'  fired only when the committed mode actually changes
 *   - 'invite'      the visitor has gone quiet — offer a gentle nudge
 *   - 'evolve'      the visitor is fixated on one thing — change it, don't repeat it
 *   - 'reward'      sustained deep engagement — a rare, special payoff
 *
 * This module never touches the DOM. experienceAdapter.js is the only
 * consumer that's allowed to.
 *
 * Interaction Signals → Engagement Model → Attention State → Experience Adaptation
 *                                           ^^^^^^^^^^^^^^^ this file
 */
(function (global) {
  'use strict';

  const { createEmitter, now } = global.AEUtils;
  const { computeEngagement } = global.AEEngagementModel;

  const MODE_HOLD_MS = 1400; // a candidate mode must persist this long to commit
  const FLOW_REWARD_MS = 6500; // continuous 'flow' before a reward fires
  const REWARD_COOLDOWN_MS = 45000;
  const EVOLVE_COOLDOWN_MS = 5000;
  const INVITE_COOLDOWN_MS = 15000;
  const SCORE_SMOOTHING = 0.85; // higher = smoother/slower to react

  function createAttentionState() {
    const emitter = createEmitter();

    let smoothedScore = 0;
    let committedMode = 'ambient';
    let candidateMode = 'ambient';
    let candidateSince = now();
    let lastMeta = {};

    let flowSince = null;
    let lastRewardAt = -Infinity;
    let lastEvolveAt = -Infinity;
    let lastInviteAt = -Infinity;
    let hasInvitedThisIdle = false;

    function ingest(snapshot) {
      const t = now();
      const { score, mode, meta } = computeEngagement(snapshot, lastMeta);
      lastMeta = meta;

      smoothedScore = smoothedScore + (score - smoothedScore) * (1 - SCORE_SMOOTHING);

      if (mode !== candidateMode) {
        candidateMode = mode;
        candidateSince = t;
      }

      const heldLongEnough = t - candidateSince >= MODE_HOLD_MS;
      // Fixation and dormancy are meaningful the instant they're detected —
      // waiting out the usual hold would make them feel laggy/unresponsive.
      const isUrgent = mode === 'fixated' || mode === 'dormant';

      if (candidateMode !== committedMode && (heldLongEnough || isUrgent)) {
        const previous = committedMode;
        committedMode = candidateMode;
        emitter.emit('modechange', { mode: committedMode, previous, score: smoothedScore });
      }

      // --- idle invitation --------------------------------------------------
      if (meta.isIdle) {
        if (!hasInvitedThisIdle && t - lastInviteAt > INVITE_COOLDOWN_MS) {
          hasInvitedThisIdle = true;
          lastInviteAt = t;
          emitter.emit('invite', { depth: meta.idleDepth });
        }
      } else {
        hasInvitedThisIdle = false;
      }

      // --- fixation → evolve --------------------------------------------------
      if (committedMode === 'fixated' && meta.fixatedTargetKey && t - lastEvolveAt > EVOLVE_COOLDOWN_MS) {
        lastEvolveAt = t;
        emitter.emit('evolve', { targetKey: meta.fixatedTargetKey });
      }

      // --- sustained flow → reward --------------------------------------------
      if (committedMode === 'flow') {
        if (flowSince == null) flowSince = t;
        if (t - flowSince >= FLOW_REWARD_MS && t - lastRewardAt > REWARD_COOLDOWN_MS) {
          lastRewardAt = t;
          emitter.emit('reward', { score: smoothedScore });
        }
      } else {
        flowSince = null;
      }

      emitter.emit('tick', {
        score: smoothedScore,
        rawScore: score,
        mode: committedMode,
        candidateMode,
        meta,
      });
    }

    return {
      ingest,
      on: emitter.on,
      getSnapshot: () => ({ score: smoothedScore, mode: committedMode, meta: lastMeta }),
    };
  }

  global.AEAttentionState = { createAttentionState };
})(window);
