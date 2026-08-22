/**
 * Showcase cards: pointer-driven 3D tilt + magnetic lift. When the
 * Attention Engine detects the visitor fixating on one card (repeated
 * clicks/hover in a short window) it fires 'attention:evolve' with that
 * card's target key — instead of replaying the same hover animation, the
 * card advances to its next content variant. Reward curiosity, don't loop it.
 *
 * All cards share one animation loop. Per-card rAF loops would multiply the
 * per-frame cost by however many cards the page happens to have.
 */
(function (global) {
  'use strict';

  const { clamp, lerp, prefersReducedMotion, isTouchDevice } = global.AEUtils;

  function parseVariants(card) {
    try {
      const raw = card.getAttribute('data-variants');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function initCards(cardEls) {
    const reduced = prefersReducedMotion();
    const touch = isTouchDevice();
    const interactive = !reduced && !touch;

    const cards = [...cardEls].map((card, i) => {
      if (!card.hasAttribute('data-ae-target')) {
        card.setAttribute('data-ae-target', `card-${i}`);
      }

      const variants = parseVariants(card);
      const titleEl = card.querySelector('.card-title');
      const descEl = card.querySelector('.card-desc');
      const badgeEl = card.querySelector('.card-badge');

      const state = {
        el: card,
        key: card.getAttribute('data-ae-target'),
        variantIndex: 0,
        rx: 0,
        ry: 0,
        targetRx: 0,
        targetRy: 0,
        evolve,
      };

      if (interactive) {
        card.addEventListener('pointermove', (e) => {
          const rect = card.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width - 0.5;
          const py = (e.clientY - rect.top) / rect.height - 0.5;
          state.targetRy = clamp(px * 16, -16, 16);
          state.targetRx = clamp(-py * 16, -16, 16);
          card.style.setProperty('--card-glow-x', `${(px + 0.5) * 100}%`);
          card.style.setProperty('--card-glow-y', `${(py + 0.5) * 100}%`);
        });
        card.addEventListener('pointerleave', () => {
          state.targetRx = 0;
          state.targetRy = 0;
        });
      }

      function evolve() {
        card.classList.add('is-evolving');
        setTimeout(() => card.classList.remove('is-evolving'), 700);

        if (variants && variants.length) {
          state.variantIndex = (state.variantIndex + 1) % variants.length;
          const v = variants[state.variantIndex];
          if (titleEl && v.title) titleEl.textContent = v.title;
          if (descEl && v.desc) descEl.textContent = v.desc;
          if (badgeEl && v.badge) badgeEl.textContent = v.badge;
        } else {
          card.classList.add('is-evolved');
        }
      }

      return state;
    });

    if (interactive) {
      function frame() {
        for (const c of cards) {
          // Skip the DOM write entirely for any card already at rest — an
          // idle card grid should cost effectively nothing per frame.
          if (Math.abs(c.targetRx - c.rx) < 0.01 && Math.abs(c.targetRy - c.ry) < 0.01) continue;
          c.rx = lerp(c.rx, c.targetRx, 0.14);
          c.ry = lerp(c.ry, c.targetRy, 0.14);
          c.el.style.transform =
            `perspective(900px) rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg)`;
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    document.addEventListener('attention:evolve', (e) => {
      const match = cards.find((c) => c.key === e.detail.targetKey);
      match?.evolve();
    });

    return cards;
  }

  global.AECards = { initCards };
})(window);
