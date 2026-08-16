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

  // `anchorEl`, when given, positions the toast just above that element
  // instead of the page-bottom default — needed for triggers that live in
  // the footer, where a fixed bottom-of-viewport toast would otherwise
  // land right on top of the content that triggered it.
  function showToast(message, anchorEl) {
    let toast = document.getElementById('ae-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ae-toast';
      toast.className = 'ae-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }

    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      toast.style.left = `${rect.left + rect.width / 2}px`;
      toast.style.bottom = `${window.innerHeight - rect.top + 16}px`;
    } else {
      toast.style.left = '';
      toast.style.bottom = '';
    }

    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('is-visible'), 3400);
  }

  // Stay on the page instead of yanking the visitor into their OS mail
  // client: copy the address in place and confirm it, the way the rest of
  // the site prefers to answer in-place rather than navigate away. Falls
  // back to a real mailto: navigation if the Clipboard API is unavailable.
  function initSayHello(link) {
    if (!link) return;
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = link.getAttribute('href').replace('mailto:', '').split('?')[0];

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(email);
          showToast(`Copied — ${email}`, link);
          const rect = link.getBoundingClientRect();
          window.AEEasterEggs?.burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 14);
          return;
        } catch {
          /* clipboard denied — fall through to a real mailto: navigation */
        }
      }
      window.location.href = link.href;
    });
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

    initSayHello(document.getElementById('say-hello'));

    // First paint is done — release the loading veil.
    requestAnimationFrame(() => {
      document.body.classList.add('is-ready');
    });
  });
})();
