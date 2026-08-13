/**
 * Sound-ready architecture: a tiny procedural Web Audio layer. Off by
 * default (never autoplays, never surprises someone with headphones in),
 * toggled explicitly, and only wired to the Attention Engine's *moments*
 * (mode changes, rewards, evolves) rather than every tick — sound should
 * punctuate, not narrate.
 */
(function (global) {
  'use strict';

  function initSoundEngine(toggleEl) {
    let ctx = null;
    let master = null;
    let ambientOsc = null;
    let ambientGain = null;
    let ambientFilter = null;
    let enabled = false;
    try {
      enabled = localStorage.getItem('ae-sound') === 'on';
    } catch {
      /* localStorage unavailable (private mode / disabled) — default off */
    }

    function updateToggleUI() {
      if (!toggleEl) return;
      toggleEl.setAttribute('aria-pressed', String(enabled));
      toggleEl.classList.toggle('is-on', enabled);
      toggleEl.setAttribute('aria-label', enabled ? 'Mute ambient sound' : 'Enable ambient sound');
    }
    updateToggleUI();

    function ensureContext() {
      if (!ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        ctx = new Ctx();
        master = ctx.createGain();
        master.gain.value = 0.0001;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }

    function rampMaster(value) {
      if (!master) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(value, t, 0.4);
    }

    function startAmbient() {
      if (ambientOsc || !ctx) return;
      ambientOsc = ctx.createOscillator();
      ambientOsc.type = 'triangle';
      ambientOsc.frequency.value = 110;
      ambientFilter = ctx.createBiquadFilter();
      ambientFilter.type = 'lowpass';
      ambientFilter.frequency.value = 400;
      ambientGain = ctx.createGain();
      ambientGain.gain.value = 0.02;
      ambientOsc.connect(ambientFilter).connect(ambientGain).connect(master);
      ambientOsc.start();
    }

    function stopAmbient() {
      if (!ambientOsc) return;
      try {
        ambientOsc.stop();
      } catch {
        /* already stopped */
      }
      ambientOsc.disconnect();
      ambientFilter.disconnect();
      ambientGain.disconnect();
      ambientOsc = null;
      ambientFilter = null;
      ambientGain = null;
    }

    function setEnabled(next) {
      enabled = next;
      try {
        localStorage.setItem('ae-sound', enabled ? 'on' : 'off');
      } catch {
        /* ignore persistence failures */
      }
      updateToggleUI();
      if (enabled) {
        if (!ensureContext()) return;
        rampMaster(0.05);
        startAmbient();
      } else if (ctx) {
        rampMaster(0.0001);
        setTimeout(stopAmbient, 500);
      }
    }

    toggleEl?.addEventListener('click', () => setEnabled(!enabled));

    function tone({ freq = 440, duration = 0.12, type = 'sine', gain = 0.16 } = {}) {
      if (!enabled || !ctx) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = 0;
      osc.connect(g).connect(master);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    }

    document.addEventListener('attention:tick', (e) => {
      if (!enabled || !ambientFilter || !ctx) return;
      const target = 300 + e.detail.vars.motion * 900;
      ambientFilter.frequency.setTargetAtTime(target, ctx.currentTime, 0.6);
    });

    document.addEventListener('attention:modechange', (e) => {
      if (e.detail.mode === 'flow') tone({ freq: 660, duration: 0.4, gain: 0.12 });
    });

    document.addEventListener('attention:reward', () => {
      tone({ freq: 880, duration: 0.5, gain: 0.14 });
      setTimeout(() => tone({ freq: 1320, duration: 0.6, gain: 0.1 }), 120);
    });

    document.addEventListener('attention:evolve', () => {
      tone({ freq: 520, duration: 0.18, type: 'triangle', gain: 0.1 });
    });

    document.querySelectorAll('[data-sound="hover"]').forEach((el) => {
      el.addEventListener('pointerenter', () =>
        tone({ freq: 380 + Math.random() * 80, duration: 0.09, gain: 0.06 })
      );
    });
    document.querySelectorAll('[data-sound="click"]').forEach((el) => {
      el.addEventListener('click', () => tone({ freq: 220, duration: 0.14, type: 'square', gain: 0.08 }));
    });

    if (enabled) {
      // Deferred until the first user gesture anywhere on the page, to
      // respect autoplay policies even when sound was left on previously.
      const resumeOnce = () => {
        ensureContext();
        rampMaster(0.05);
        startAmbient();
        window.removeEventListener('pointerdown', resumeOnce);
        window.removeEventListener('keydown', resumeOnce);
      };
      window.addEventListener('pointerdown', resumeOnce, { once: true });
      window.addEventListener('keydown', resumeOnce, { once: true });
    }

    return { setEnabled, tone, get enabled() { return enabled; } };
  }

  global.AESoundEngine = { initSoundEngine };
})(window);
