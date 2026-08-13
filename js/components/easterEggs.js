/**
 * Hidden interactions. None of these are required to enjoy the site —
 * they reward people who poke at it. Kept isolated from the Attention
 * Engine's core loop; they only *listen* to its 'invite' moments to time
 * a hint, never to drive the heuristics themselves.
 */
(function (global) {
  'use strict';

  const KONAMI = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
  ];

  function logConsoleArt() {
    console.log(
      '%c◆ ATTENTION ENGINE ONLINE',
      'font-size:14px;font-weight:700;color:#b9a4ff;letter-spacing:2px;'
    );
    console.log(
      '%cYou found the console. Curious ones do.\nTry the Konami code, or click the mark in the corner five times.',
      'color:#7d7599;font-style:italic;'
    );
  }

  function burstAt(x, y, count = 22) {
    const container = document.createElement('div');
    container.className = 'ae-burst';
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    document.body.appendChild(container);

    for (let i = 0; i < count; i++) {
      const shard = document.createElement('span');
      shard.className = 'ae-burst-shard';
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 80 + Math.random() * 140;
      shard.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      shard.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      shard.style.setProperty('--hue', `${250 + Math.random() * 60}`);
      shard.style.animationDelay = `${Math.random() * 80}ms`;
      container.appendChild(shard);
    }
    setTimeout(() => container.remove(), 1400);
  }

  function initKonami() {
    let cursor = 0;
    window.addEventListener('keydown', (e) => {
      const expected = KONAMI[cursor];
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === expected) {
        cursor++;
        if (cursor === KONAMI.length) {
          cursor = 0;
          document.body.classList.add('ae-secret-mode');
          burstAt(window.innerWidth / 2, window.innerHeight / 2, 36);
          document.dispatchEvent(new CustomEvent('attention:reward', { detail: { source: 'konami' } }));
          setTimeout(() => document.body.classList.remove('ae-secret-mode'), 5000);
        }
      } else {
        cursor = key === KONAMI[0] ? 1 : 0;
      }
    });
  }

  function initLogoSecret(logoEl) {
    if (!logoEl) return;
    let clicks = 0;
    let resetTimer = null;
    logoEl.addEventListener('click', (e) => {
      clicks++;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => (clicks = 0), 1800);
      if (clicks >= 5) {
        clicks = 0;
        const rect = logoEl.getBoundingClientRect();
        burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 26);
        document.dispatchEvent(new CustomEvent('ae:secret-found', { detail: { via: 'logo' } }));
        revealSecretNote();
      }
    });
  }

  function revealSecretNote() {
    let note = document.getElementById('ae-secret-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'ae-secret-note';
      note.className = 'ae-secret-note';
      note.setAttribute('role', 'status');
      note.textContent = 'You clicked five times. Most people scroll past. Nice.';
      document.body.appendChild(note);
    }
    note.classList.add('is-visible');
    clearTimeout(revealSecretNote._t);
    revealSecretNote._t = setTimeout(() => note.classList.remove('is-visible'), 4200);
  }

  function initIdleHint() {
    let hintEl = null;
    document.addEventListener('attention:invite', (e) => {
      if (e.detail.depth !== 'deep') return;
      if (!hintEl) {
        hintEl = document.createElement('div');
        hintEl.className = 'ae-idle-hint';
        hintEl.setAttribute('role', 'status');
        hintEl.innerHTML = 'Still there? <span>Scroll on — the page keeps unfolding.</span>';
        document.body.appendChild(hintEl);
      }
      hintEl.classList.add('is-visible');
      clearTimeout(initIdleHint._t);
      initIdleHint._t = setTimeout(() => hintEl.classList.remove('is-visible'), 5000);
    });
  }

  function initEasterEggs({ logoEl } = {}) {
    logConsoleArt();
    initKonami();
    initLogoSecret(logoEl);
    initIdleHint();
  }

  global.AEEasterEggs = { initEasterEggs, burstAt };
})(window);
