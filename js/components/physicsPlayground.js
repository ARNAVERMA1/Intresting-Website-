/**
 * A small physics-inspired playground: draggable objects that carry
 * momentum on release and bounce gently off the stage bounds. Liveliness
 * (drift, idle nudges) is subtly scaled by --ae-motion, but friction and
 * bounce stay predictable regardless of mode — physics should feel
 * trustworthy, not erratic.
 */
(function (global) {
  'use strict';

  const { clamp, prefersReducedMotion, now } = global.AEUtils;

  function initPhysicsPlayground(stage) {
    if (!stage) return null;
    const reduced = prefersReducedMotion();
    const items = [...stage.querySelectorAll('.physics-item')];
    if (!items.length) return null;

    let motion = 0.4;
    document.addEventListener('attention:tick', (e) => (motion = e.detail.vars.motion));

    let stageRect = stage.getBoundingClientRect();
    window.addEventListener('resize', () => (stageRect = stage.getBoundingClientRect()));
    document.fonts?.ready?.then(() => (stageRect = stage.getBoundingClientRect()));

    const bodies = items.map((el) => {
      const size = el.getBoundingClientRect();
      const startX = parseFloat(el.dataset.x || Math.random() * (stageRect.width - size.width));
      const startY = parseFloat(el.dataset.y || Math.random() * (stageRect.height - size.height));
      return {
        el,
        w: size.width,
        h: size.height,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        dragging: false,
        lastPointer: null,
      };
    });

    function place(body) {
      body.el.style.transform = `translate3d(${body.x.toFixed(1)}px, ${body.y.toFixed(1)}px, 0)`;
    }

    bodies.forEach((body) => {
      body.el.style.position = 'absolute';
      body.el.style.touchAction = 'none';
      place(body);

      body.el.addEventListener('pointerdown', (e) => {
        body.dragging = true;
        body.el.setPointerCapture(e.pointerId);
        body.el.classList.add('is-dragging');
        body.lastPointer = { x: e.clientX, y: e.clientY, t: now() };
      });

      body.el.addEventListener('pointermove', (e) => {
        if (!body.dragging) return;
        const t = now();
        const dt = Math.max(1, t - (body.lastPointer?.t ?? t));
        const dx = e.clientX - (body.lastPointer?.x ?? e.clientX);
        const dy = e.clientY - (body.lastPointer?.y ?? e.clientY);
        body.x += dx;
        body.y += dy;
        body.vx = (dx / dt) * 14;
        body.vy = (dy / dt) * 14;
        body.lastPointer = { x: e.clientX, y: e.clientY, t };
        place(body);
      });

      function release(e) {
        if (!body.dragging) return;
        body.dragging = false;
        body.el.classList.remove('is-dragging');
        try {
          body.el.releasePointerCapture(e.pointerId);
        } catch {
          /* pointer already released */
        }
      }
      body.el.addEventListener('pointerup', release);
      body.el.addEventListener('pointercancel', release);
    });

    if (reduced) return { bodies };

    function step() {
      const friction = 0.965;
      bodies.forEach((body) => {
        if (body.dragging) return;

        // Occasional tiny idle impulse so the stage stays alive at rest —
        // frequency scales with motion, magnitude never gets wild.
        if (Math.random() < 0.002 * (0.3 + motion)) {
          body.vx += (Math.random() - 0.5) * 1.2;
          body.vy += (Math.random() - 0.5) * 1.2;
        }

        body.x += body.vx;
        body.y += body.vy;
        body.vx *= friction;
        body.vy *= friction;

        const maxX = stageRect.width - body.w;
        const maxY = stageRect.height - body.h;
        if (body.x < 0) {
          body.x = 0;
          body.vx *= -0.55;
        } else if (body.x > maxX) {
          body.x = maxX;
          body.vx *= -0.55;
        }
        if (body.y < 0) {
          body.y = 0;
          body.vy *= -0.55;
        } else if (body.y > maxY) {
          body.y = maxY;
          body.vy *= -0.55;
        }

        place(body);
      });
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    return { bodies };
  }

  global.AEPhysicsPlayground = { initPhysicsPlayground };
})(window);
