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

  /**
   * Every visual component is independent and optional. Running each behind
   * this guard means one throwing at startup — an unsupported API, a missing
   * element after a markup change — degrades that one feature instead of
   * aborting the rest of the bootstrap and leaving a dead page.
   */
  function safeInit(name, fn) {
    try {
      return fn();
    } catch (err) {
      console.warn(`[main] "${name}" failed to initialize; continuing without it.`, err);
      return null;
    }
  }

  ready(() => {
    // --- 1. Attention Engine -------------------------------------------------
    const signals = window.AESignals.createSignals();
    const attentionState = window.AEAttentionState.createAttentionState();
    signals.on('tick', attentionState.ingest);

    const sections = [...document.querySelectorAll('[data-section]')];
    signals.observeSections(sections);
    signals.on('section', (id) => document.dispatchEvent(new CustomEvent('attention:section', { detail: { id } })));

    const governor = safeInit('performanceGovernor', () =>
      window.AEPerformanceGovernor.createPerformanceGovernor()
    );
    window.AEExperienceAdapter.createExperienceAdapter(attentionState, document.documentElement, {
      governor,
    });
    const recorder = window.AESessionRecorder.createSessionRecorder();
    signals.start();

    // Expose a minimal read-only hook for future analytics/ML swap-in,
    // without leaking the engine's internals onto window.
    window.AttentionEngine = {
      getState: attentionState.getSnapshot,
      on: attentionState.on,
      getSessionRecord: () => recorder.getRecord(),
      getPerformance: () => ({ fps: governor?.getFps() ?? null, scale: governor?.getScale() ?? 1 }),
    };

    // --- 2. Visual layer -------------------------------------------------------
    // The shader field is the deepest layer and is allowed to fail: on low-tier
    // devices, reduced-motion, or without WebGL it simply never starts, and
    // the 2D particle field below carries the environment by itself.
    safeInit('shaderBackground', () =>
      window.AEShaderBackground.initShaderBackground(document.getElementById('ae-shader-canvas'))
    );

    safeInit('particles', () => {
      const canvas = document.getElementById('ae-bg-canvas');
      if (canvas) window.AEParticles.initParticles(canvas);
    });

    safeInit('cursor', () => window.AECursor.initCursor());

    safeInit('heroType', () => {
      document.querySelectorAll('[data-hero-title]').forEach((el) => {
        window.AEHeroType.initHeroType(el);
      });
    });

    safeInit('attentionIndicator', () => {
      const indicator = document.getElementById('attention-indicator');
      if (indicator) window.AEIndicator.initAttentionIndicator(indicator);
    });

    safeInit('cards', () => {
      const cardEls = document.querySelectorAll('.card');
      if (cardEls.length) window.AECards.initCards(cardEls);
    });

    safeInit('scrollStory', () => {
      window.AEScrollStory.initReveals();
      window.AEScrollStory.initParallax();
      document.querySelectorAll('[data-story-wrapper]').forEach((el) => {
        window.AEScrollStory.initPinnedStory(el);
      });
    });

    safeInit('physicsPlayground', () => {
      const stage = document.querySelector('.physics-stage');
      if (stage) window.AEPhysicsPlayground.initPhysicsPlayground(stage);
    });

    safeInit('soundEngine', () =>
      window.AESoundEngine.initSoundEngine(document.getElementById('sound-toggle'))
    );

    safeInit('easterEggs', () =>
      window.AEEasterEggs.initEasterEggs({ logoEl: document.querySelector('.site-logo') })
    );

    safeInit('journeyMemory', () => {
      const footerLine = document.querySelector('.footer-line');
      if (footerLine) window.AEJourneyMemory.initJourneyMemory(footerLine);
    });

    safeInit('sayHello', () => initSayHello(document.getElementById('say-hello')));

    // --- 3. Session-aware features ------------------------------------------
    safeInit('signature', () =>
      window.AESignature.initSignature(document.getElementById('signature'), recorder)
    );

    const tilt =
      safeInit('deviceTilt', () => window.AEDeviceTilt.initDeviceTilt()) ||
      { supported: false, needsPermission: false, request: async () => false };
    safeInit('haptics', () => window.AEDeviceTilt.initHaptics());

    const visitor =
      safeInit('returningVisitor', () =>
        window.AEReturningVisitor.initReturningVisitor({
          eyebrowEl: document.querySelector('.hero .eyebrow'),
          recorder,
          onGreet: (line) => setTimeout(() => showToast(line), 1600),
        })
      ) || { isReturning: false, forget: () => false };

    // --- 4. Command palette --------------------------------------------------
    const jump = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

    const commands = [
      { label: 'Go to top', icon: '↑', keywords: 'hero home start', run: jump('hero') },
      { label: 'The Engine', icon: '◎', keywords: 'attention model how it works', run: jump('engine') },
      { label: 'Fragments', icon: '◈', keywords: 'cards showcase', run: jump('showcase') },
      { label: 'The Story', icon: '❯', keywords: 'scroll narrative', run: jump('story') },
      { label: 'Playground', icon: '◍', keywords: 'physics drag toy', run: jump('playground') },
      { label: 'Your Signature', icon: '✦', keywords: 'art generative image', run: jump('signature') },
      {
        label: 'Toggle ambient sound',
        icon: '♪',
        keywords: 'audio music mute volume',
        run: () => document.getElementById('sound-toggle')?.click(),
      },
      {
        label: 'Reimagine my signature',
        icon: '↻',
        keywords: 'regenerate art redraw',
        run: () => {
          jump('signature')();
          setTimeout(() => document.querySelector('[data-signature-regen]')?.click(), 700);
        },
      },
      {
        label: 'Save my signature',
        icon: '⇩',
        keywords: 'download png export image',
        run: () => document.querySelector('[data-signature-save]')?.click(),
      },
    ];

    if (tilt.supported && tilt.needsPermission) {
      commands.push({
        label: 'Enable motion tilt',
        icon: '⟡',
        keywords: 'gyroscope parallax phone sensor',
        run: async () => {
          const ok = await tilt.request();
          showToast(ok ? 'Tilt enabled — move your phone.' : 'Motion access was declined.');
        },
      });
    }

    if (visitor.isReturning) {
      commands.push({
        label: 'Forget me',
        icon: '⌫',
        keywords: 'clear reset privacy history memory',
        run: () => {
          visitor.forget();
          showToast('Forgotten. Next visit starts fresh.');
        },
      });
    }

    safeInit('commandPalette', () => {
      const palette = window.AECommandPalette.initCommandPalette(commands);
      // Touch devices have no nav links and no keyboard shortcut, so this
      // button is their only route between sections.
      document.getElementById('palette-trigger')?.addEventListener('click', () => palette.open());
      return palette;
    });

    // First paint is done — release the loading veil.
    requestAnimationFrame(() => {
      document.body.classList.add('is-ready');
    });
  });
})();
