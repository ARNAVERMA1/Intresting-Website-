/**
 * The Attention Mode indicator — a small, elegant live readout of the
 * engine's current state. Not a dev dashboard: a breathing mark whose
 * color/motion IS the current mode, with a one-line poetic explanation
 * that only appears when asked for (click/tap or keyboard focus).
 */
(function (global) {
  'use strict';

  const COPY = {
    dormant: {
      label: 'Dormant',
      line: 'Resting. The page is holding still, waiting for you.',
    },
    ambient: {
      label: 'Ambient',
      line: 'Gently aware — casual scrolling, calm motion.',
    },
    curious: {
      label: 'Curious',
      line: "You're exploring. The field is opening up for you.",
    },
    engaged: {
      label: 'Engaged',
      line: 'Focused attention. The world is holding steady.',
    },
    flow: {
      label: 'Flow',
      line: 'Deep engagement — something rare just unlocked.',
    },
    fixated: {
      label: 'Evolving',
      line: "Noticed a pattern. Let's try something new.",
    },
  };

  function initAttentionIndicator(root) {
    if (!root) return null;
    const progress = root.querySelector('.ae-indicator-progress');
    const label = root.querySelector('.ae-indicator-mode-label');
    const line = root.querySelector('.ae-indicator-copy');
    const panel = document.getElementById(root.getAttribute('aria-controls'));

    const radius = progress ? progress.r.baseVal.value : 0;
    const circumference = 2 * Math.PI * radius;
    if (progress) {
      progress.style.strokeDasharray = `${circumference}`;
      progress.style.strokeDashoffset = `${circumference}`;
    }

    let open = false;
    function setOpen(next) {
      open = next;
      root.setAttribute('aria-expanded', String(open));
      panel?.classList.toggle('is-open', open);
      panel?.setAttribute('aria-hidden', String(!open));
    }

    root.addEventListener('click', () => setOpen(!open));
    document.addEventListener('click', (e) => {
      if (open && !root.contains(e.target) && !panel?.contains(e.target)) setOpen(false);
    });

    document.addEventListener('attention:tick', (e) => {
      const { score, mode } = e.detail;
      if (progress) {
        const offset = circumference * (1 - score);
        progress.style.strokeDashoffset = `${offset}`;
      }
      root.dataset.mode = mode;
    });

    document.addEventListener('attention:modechange', (e) => {
      const info = COPY[e.detail.mode] || COPY.ambient;
      if (label) label.textContent = info.label;
      if (line) line.textContent = info.line;
      root.classList.remove('is-pulsing');
      // Force reflow so the pulse animation can restart on rapid changes.
      void root.offsetWidth;
      root.classList.add('is-pulsing');
    });

    document.addEventListener('attention:reward', () => {
      root.classList.add('is-rewarded');
      setTimeout(() => root.classList.remove('is-rewarded'), 2200);
    });

    const initialInfo = COPY.ambient;
    if (label) label.textContent = initialInfo.label;
    if (line) line.textContent = initialInfo.line;

    return { setOpen };
  }

  global.AEIndicator = { initAttentionIndicator };
})(window);
