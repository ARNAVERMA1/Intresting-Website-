/**
 * Interactive kinetic typography for the hero headline. Splits text into
 * per-letter spans that lean away from the pointer, and answers an idle
 * "invite" moment from the Attention Engine with a brief scramble/settle
 * — a small proof that the page is watching, not decoration for its own
 * sake.
 */
(function (global) {
  'use strict';

  const { clamp, lerp, prefersReducedMotion } = global.AEUtils;
  const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ*+#%$&';

  function splitIntoLetters(el) {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const letters = [];
    // Letters are grouped per word (in a nowrap wrapper) so a line can only
    // break between words, never inside one. Plain adjacent inline-block
    // letter spans would otherwise offer the browser a wrap point anywhere.
    const words = text.split(' ');
    words.forEach((word, wi) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'ae-word';
      [...word].forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'ae-letter';
        span.textContent = ch;
        span.dataset.char = ch;
        span.setAttribute('aria-hidden', 'true');
        wordSpan.appendChild(span);
        letters.push(span);
      });
      el.appendChild(wordSpan);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return letters;
  }

  function initHeroType(el) {
    if (!el) return null;
    const reduced = prefersReducedMotion();
    const letters = splitIntoLetters(el);
    const state = letters.map(() => ({ x: 0, y: 0, cx: 0, cy: 0, tx: 0, ty: 0 }));

    function measure() {
      letters.forEach((span, i) => {
        const rect = span.getBoundingClientRect();
        state[i].cx = rect.left + rect.width / 2;
        state[i].cy = rect.top + rect.height / 2;
      });
    }
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready?.then(measure);

    let pointer = { x: -9999, y: -9999 };
    if (!reduced) {
      window.addEventListener(
        'pointermove',
        (e) => {
          pointer.x = e.clientX;
          pointer.y = e.clientY;
        },
        { passive: true }
      );
    }

    function frame() {
      if (!reduced) {
        const radius = 150;
        const maxPush = 16;
        letters.forEach((span, i) => {
          const s = state[i];
          const dx = s.cx - pointer.x;
          const dy = s.cy - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < radius && dist > 0.01) {
            const force = (1 - dist / radius) * maxPush;
            s.tx = (dx / dist) * force;
            s.ty = (dy / dist) * force;
          } else {
            s.tx = 0;
            s.ty = 0;
          }
          s.x = lerp(s.x, s.tx, 0.18);
          s.y = lerp(s.y, s.ty, 0.18);
          const rot = clamp(s.x * 0.6, -14, 14);
          span.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        });
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    let scrambling = false;
    function scramble() {
      if (scrambling || reduced) return;
      scrambling = true;
      letters.forEach((span, i) => {
        const original = span.dataset.char;
        const delay = Math.random() * 220;
        const duration = 380 + Math.random() * 260;
        const start = performance.now() + delay;
        function step(t) {
          if (t < start) {
            requestAnimationFrame(step);
            return;
          }
          const elapsed = t - start;
          if (elapsed < duration) {
            span.textContent = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
            requestAnimationFrame(step);
          } else {
            span.textContent = original;
            if (i === letters.length - 1) scrambling = false;
          }
        }
        requestAnimationFrame(step);
      });
    }

    document.addEventListener('attention:invite', () => scramble());

    return { measure, scramble };
  }

  global.AEHeroType = { initHeroType };
})(window);
