/**
 * Showcase cards: pointer-driven 3D tilt + magnetic lift. When the
 * Attention Engine detects the visitor fixating on one card (repeated
 * clicks/hover in a short window) it fires 'attention:evolve' with that
 * card's target key — instead of replaying the same hover animation, the
 * card advances to its next content variant. Reward curiosity, don't loop it.
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

    const cards = [...cardEls].map((card, i) => {
      if (!card.hasAttribute('data-ae-target')) {
        card.setAttribute('data-ae-target', `card-${i}`);
      }
      const variants = parseVariants(card);
      const titleEl = card.querySelector('.card-title');
      const descEl = card.querySelector('.card-desc');
      const badgeEl = card.querySelector('.card-badge');

      let variantIndex = 0;
      let rx = 0;
      let ry = 0;
      let targetRx = 0;
      let targetRy = 0;

      if (!reduced && !touch) {
        card.addEventListener('pointermove', (e) => {
          const rect = card.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width - 0.5;
          const py = (e.clientY - rect.top) / rect.height - 0.5;
          targetRy = clamp(px * 16, -16, 16);
          targetRx = clamp(-py * 16, -16, 16);
          card.style.setProperty('--card-glow-x', `${(px + 0.5) * 100}%`);
          card.style.setProperty('--card-glow-y', `${(py + 0.5) * 100}%`);
        });
        card.addEventListener('pointerleave', () => {
          targetRx = 0;
          targetRy = 0;
        });
      }

      function frame() {
        if (!reduced && !touch) {
          rx = lerp(rx, targetRx, 0.14);
          ry = lerp(ry, targetRy, 0.14);
          card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      function evolve() {
        card.classList.add('is-evolving');
        setTimeout(() => card.classList.remove('is-evolving'), 700);

        if (variants && variants.length) {
          variantIndex = (variantIndex + 1) % variants.length;
          const v = variants[variantIndex];
          if (titleEl && v.title) titleEl.textContent = v.title;
          if (descEl && v.desc) descEl.textContent = v.desc;
          if (badgeEl && v.badge) badgeEl.textContent = v.badge;
        } else {
          card.classList.add('is-evolved');
        }
      }

      return { el: card, key: card.getAttribute('data-ae-target'), evolve };
    });

    document.addEventListener('attention:evolve', (e) => {
      const match = cards.find((c) => c.key === e.detail.targetKey);
      match?.evolve();
    });

    return cards;
  }

  global.AECards = { initCards };
})(window);
