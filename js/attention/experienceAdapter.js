/**
 * EXPERIENCE ADAPTER — layer 4 of the Attention Engine.
 *
 * Responsibility: the *only* bridge between attention state and the DOM.
 * It translates {score, mode} into CSS custom properties and body
 * classes, and rebroadcasts the engine's high-level moments as plain
 * DOM CustomEvents so any component can listen without importing the
 * engine directly:
 *
 *   attention:tick        { score, mode, vars }
 *   attention:modechange  { mode, previous }
 *   attention:invite      { depth }
 *   attention:evolve      { targetKey }
 *   attention:reward      { score }
 *
 * Deliberately NOT "faster when bored" — each mode gets its own small
 * target profile (see MODE_PROFILES) so idling and boredom read as calm
 * and inviting, while exploration reads as rewarded, not sped-up.
 *
 * Interaction Signals → Engagement Model → Attention State → Experience Adaptation
 *                                                              ^^^^^^^^^^^^^^^^^^^^ this file
 */
(function (global) {
  'use strict';

  const { clamp, damp, prefersReducedMotion, detectDeviceTier, now } = global.AEUtils;

  // Target profile per mode: motion (ambient animation intensity),
  // particleDensity, novelty (how often morphs/surprises are allowed to
  // fire), transitionSpeed (kept in a narrow band — this is *tone*, not a
  // "make it faster" dial).
  const MODE_PROFILES = {
    dormant: { motion: 0.18, particleDensity: 0.22, novelty: 0.35, transitionSpeed: 0.92 },
    ambient: { motion: 0.38, particleDensity: 0.4, novelty: 0.45, transitionSpeed: 1.0 },
    curious: { motion: 0.6, particleDensity: 0.62, novelty: 0.72, transitionSpeed: 1.05 },
    engaged: { motion: 0.7, particleDensity: 0.7, novelty: 0.6, transitionSpeed: 1.0 },
    flow: { motion: 0.82, particleDensity: 0.85, novelty: 0.9, transitionSpeed: 1.08 },
    fixated: { motion: 0.55, particleDensity: 0.55, novelty: 0.95, transitionSpeed: 1.0 },
  };

  const DEVICE_CAPS = {
    high: 1,
    mid: 0.72,
    low: 0.42,
  };

  function createExperienceAdapter(attentionState, root = document.documentElement, options = {}) {
    // Optional: a live frame-rate governor whose scale multiplies the static
    // device cap, so a struggling device sheds effects instead of stuttering.
    const governor = options.governor || null;
    const reduced = prefersReducedMotion();
    const deviceTier = detectDeviceTier();
    const deviceCap = DEVICE_CAPS[deviceTier] ?? 0.72;

    const current = { motion: 0.3, particleDensity: 0.3, novelty: 0.4, transitionSpeed: 1 };
    let lastFrame = now();
    let currentMode = 'ambient';

    root.dataset.deviceTier = deviceTier;
    root.dataset.reducedMotion = String(reduced);

    function applyVars() {
      root.style.setProperty('--ae-motion', current.motion.toFixed(3));
      root.style.setProperty('--ae-particle-density', current.particleDensity.toFixed(3));
      root.style.setProperty('--ae-novelty', current.novelty.toFixed(3));
      root.style.setProperty('--ae-transition-speed', current.transitionSpeed.toFixed(3));
    }

    function frame() {
      const t = now();
      const dt = Math.min(64, t - lastFrame) / 16.67; // normalized to ~60fps steps
      lastFrame = t;

      const profile = MODE_PROFILES[currentMode] || MODE_PROFILES.ambient;
      const baseCap = reduced ? Math.min(deviceCap, 0.3) : deviceCap;
      const cap = baseCap * (governor ? governor.getScale() : 1);

      const targetMotion = (reduced ? profile.motion * 0.25 : profile.motion) * cap;
      const targetParticles = (reduced ? 0 : profile.particleDensity) * cap;
      const targetNovelty = reduced ? profile.novelty * 0.5 : profile.novelty;
      const targetSpeed = profile.transitionSpeed;

      current.motion = damp(current.motion, targetMotion, 0.86, dt);
      current.particleDensity = damp(current.particleDensity, targetParticles, 0.86, dt);
      current.novelty = damp(current.novelty, targetNovelty, 0.9, dt);
      current.transitionSpeed = damp(current.transitionSpeed, targetSpeed, 0.9, dt);

      applyVars();
      requestAnimationFrame(frame);
    }

    function setModeClass(mode) {
      Object.keys(MODE_PROFILES).forEach((m) => root.classList.remove(`attn-${m}`));
      root.classList.add(`attn-${mode}`);
    }

    attentionState.on('tick', ({ score, mode }) => {
      currentMode = mode;
      document.dispatchEvent(
        new CustomEvent('attention:tick', { detail: { score, mode, vars: { ...current } } })
      );
    });

    attentionState.on('modechange', ({ mode, previous }) => {
      setModeClass(mode);
      document.dispatchEvent(new CustomEvent('attention:modechange', { detail: { mode, previous } }));
    });

    attentionState.on('invite', (detail) => {
      document.dispatchEvent(new CustomEvent('attention:invite', { detail }));
    });

    attentionState.on('evolve', (detail) => {
      document.dispatchEvent(new CustomEvent('attention:evolve', { detail }));
    });

    attentionState.on('reward', (detail) => {
      document.dispatchEvent(new CustomEvent('attention:reward', { detail }));
    });

    setModeClass(currentMode);
    applyVars();
    requestAnimationFrame(frame);

    return {
      get deviceTier() {
        return deviceTier;
      },
      get reducedMotion() {
        return reduced;
      },
    };
  }

  global.AEExperienceAdapter = { createExperienceAdapter, MODE_PROFILES };
})(window);
