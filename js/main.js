/**
 * Bootstrap. Wires the Attention Engine's four layers together, then
 * hands every visual component the DOM elements and events it needs.
 * This is the only file that knows about *both* the engine and the DOM
 * structure of index.html — everything else stays isolated on one side
 * of that line.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(() => {
    // --- 1. Attention Engine -------------------------------------------------
    const signals = window.AESignals.createSignals();
    const attentionState = window.AEAttentionState.createAttentionState();
    signals.on('tick', attentionState.ingest);

    const sections = [...document.querySelectorAll('[data-section]')];
    signals.observeSections(sections);
    signals.on('section', (id) => document.dispatchEvent(new CustomEvent('attention:section', { detail: { id } })));

    window.AEExperienceAdapter.createExperienceAdapter(attentionState);
    signals.start();

    // Expose a minimal read-only hook for future analytics/ML swap-in,
    // without leaking the engine's internals onto window.
    window.AttentionEngine = {
      getState: attentionState.getSnapshot,
      on: attentionState.on,
    };

    // --- 2. Visual layer -------------------------------------------------------
    const canvas = document.getElementById('ae-bg-canvas');
    if (canvas) window.AEParticles.initParticles(canvas);

    window.AECursor.initCursor();

    document.querySelectorAll('[data-hero-title]').forEach((el) => {
      window.AEHeroType.initHeroType(el);
    });

    const indicator = document.getElementById('attention-indicator');
    if (indicator) window.AEIndicator.initAttentionIndicator(indicator);

    const cardEls = document.querySelectorAll('.card');
    if (cardEls.length) window.AECards.initCards(cardEls);

    window.AEScrollStory.initReveals();
    window.AEScrollStory.initParallax();
    document.querySelectorAll('[data-story-wrapper]').forEach((el) => {
      window.AEScrollStory.initPinnedStory(el);
    });

    const stage = document.querySelector('.physics-stage');
    if (stage) window.AEPhysicsPlayground.initPhysicsPlayground(stage);

    const soundToggle = document.getElementById('sound-toggle');
    window.AESoundEngine.initSoundEngine(soundToggle);

    window.AEEasterEggs.initEasterEggs({ logoEl: document.querySelector('.site-logo') });

    const footerLine = document.querySelector('.footer-line');
    if (footerLine) window.AEJourneyMemory.initJourneyMemory(footerLine);

    // First paint is done — release the loading veil.
    requestAnimationFrame(() => {
      document.body.classList.add('is-ready');
    });
  });
})();
