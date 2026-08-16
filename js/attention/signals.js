/**
 * SIGNALS — layer 1 of the Attention Engine.
 *
 * Responsibility: observe raw browser interaction events and reduce them
 * into a small, normalized snapshot on a fixed tick. This module knows
 * nothing about "engagement" or "attention" — it only measures. That
 * interpretation happens one layer up, in engagementModel.js.
 *
 * Interaction Signals → Engagement Model → Attention State → Experience Adaptation
 * ^^^^^^^^^^^^^^^^^^^ this file
 */
(function (global) {
  'use strict';

  const { clamp, throttle, createEmitter, now } = global.AEUtils;

  const TICK_MS = 220;
  const RATE_WINDOW_MS = 12000; // sliding window for click/interaction rates
  const REPEAT_WINDOW_MS = 6000; // window used to detect fixation on one target

  function createSignals() {
    const emitter = createEmitter();

    let lastPointer = null; // { x, y, t }
    let pointerSpeed = 0; // px/ms, smoothed
    let lastScrollY = window.scrollY || 0;
    let lastScrollT = now();
    let scrollSpeed = 0; // px/ms, smoothed
    let scrollDirection = 0; // -1, 0, 1

    let lastInteractionAt = now();
    const clickTimestamps = [];
    const interactionTimestamps = [];
    const recentTargets = []; // { key, t }

    let currentSection = null;
    const sectionEnteredAt = new Map(); // sectionId -> timestamp
    const sectionDwell = new Map(); // sectionId -> accumulated ms (previous visits)

    let visitedSectionIds = new Set();
    let maxScrollDepth = 0; // 0..1 fraction of document explored

    function markInteraction() {
      const t = now();
      lastInteractionAt = t;
      interactionTimestamps.push(t);
      trimWindow(interactionTimestamps, t, RATE_WINDOW_MS);
    }

    function trimWindow(arr, t, windowMs) {
      while (arr.length && t - arr[0] > windowMs) arr.shift();
    }

    function targetKey(el) {
      if (!el || !el.getAttribute) return 'unknown';
      return (
        el.getAttribute('data-ae-target') ||
        el.id ||
        el.className?.toString().slice(0, 40) ||
        el.tagName
      );
    }

    // --- pointer movement -----------------------------------------------
    const onPointerMove = throttle((e) => {
      const point = e.touches ? e.touches[0] : e;
      if (point == null) return;
      const t = now();
      if (lastPointer) {
        const dt = Math.max(1, t - lastPointer.t);
        const dist = Math.hypot(point.clientX - lastPointer.x, point.clientY - lastPointer.y);
        const instSpeed = dist / dt;
        pointerSpeed = pointerSpeed * 0.7 + instSpeed * 0.3;
      }
      lastPointer = { x: point.clientX, y: point.clientY, t };
      markInteraction();
      emitter.emit('pointer', { x: point.clientX, y: point.clientY });
    }, 40);

    // --- scroll -----------------------------------------------------------
    const onScroll = throttle(() => {
      const t = now();
      const y = window.scrollY || window.pageYOffset || 0;
      const dt = Math.max(1, t - lastScrollT);
      const dy = y - lastScrollY;
      const instSpeed = Math.abs(dy) / dt;
      scrollSpeed = scrollSpeed * 0.6 + instSpeed * 0.4;
      scrollDirection = dy > 0.5 ? 1 : dy < -0.5 ? -1 : scrollDirection;

      const docHeight = Math.max(
        1,
        (document.documentElement.scrollHeight || 0) - window.innerHeight
      );
      maxScrollDepth = Math.max(maxScrollDepth, clamp(y / docHeight, 0, 1));

      lastScrollY = y;
      lastScrollT = t;
      markInteraction();
    }, 60);

    // --- clicks / taps -----------------------------------------------------
    function onClick(e) {
      const t = now();
      clickTimestamps.push(t);
      trimWindow(clickTimestamps, t, RATE_WINDOW_MS);

      const key = targetKey(e.target.closest?.('[data-ae-target], button, a, .card') || e.target);
      recentTargets.push({ key, t });
      trimWindow2(recentTargets, t, REPEAT_WINDOW_MS);

      markInteraction();
      emitter.emit('click', { target: e.target, key });
    }

    function trimWindow2(arr, t, windowMs) {
      while (arr.length && t - arr[0].t > windowMs) arr.shift();
    }

    function onKeydown(e) {
      markInteraction();
      emitter.emit('keydown', e);
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        lastInteractionAt = now();
      }
      emitter.emit('visibility', document.visibilityState);
    }

    // --- section dwell tracking via IntersectionObserver -------------------
    // "Prominence" is measured against whichever is smaller, the section or
    // the viewport — a plain intersectionRatio (visible-area ÷ target-area)
    // would never cross 0.4 for a section taller than the viewport (like
    // the pinned story section), silently erasing it from dwell/exploration
    // tracking. Fine-grained thresholds keep callbacks frequent enough for
    // that custom metric to react promptly regardless of section size.
    const SECTION_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);
    let sectionObserver = null;
    function observeSections(sectionEls) {
      if (sectionObserver) sectionObserver.disconnect();
      sectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const id = entry.target.id || targetKey(entry.target);
            const viewportHeight = entry.rootBounds?.height || window.innerHeight;
            const targetHeight = entry.target.getBoundingClientRect().height || 1;
            const prominence = entry.intersectionRect.height / Math.min(targetHeight, viewportHeight);

            if (entry.isIntersecting && prominence > 0.4) {
              if (currentSection && currentSection !== id) {
                closeSection(currentSection);
              }
              if (currentSection !== id) {
                currentSection = id;
                sectionEnteredAt.set(id, now());
                visitedSectionIds.add(id);
                emitter.emit('section', id);
              }
            } else if (currentSection === id && prominence < 0.15) {
              closeSection(id);
              currentSection = null;
            }
          });
        },
        { threshold: SECTION_THRESHOLDS }
      );
      sectionEls.forEach((el) => sectionObserver.observe(el));
    }

    function closeSection(id) {
      const enteredAt = sectionEnteredAt.get(id);
      if (enteredAt == null) return;
      const dwell = now() - enteredAt;
      sectionDwell.set(id, (sectionDwell.get(id) || 0) + dwell);
      sectionEnteredAt.delete(id);
    }

    function currentSectionDwell() {
      if (!currentSection) return 0;
      const enteredAt = sectionEnteredAt.get(currentSection);
      const base = sectionDwell.get(currentSection) || 0;
      return enteredAt == null ? base : base + (now() - enteredAt);
    }

    function repeatedActionScore() {
      if (recentTargets.length < 2) return 0;
      const counts = new Map();
      recentTargets.forEach(({ key }) => counts.set(key, (counts.get(key) || 0) + 1));
      const maxCount = Math.max(...counts.values());
      // 1 hit = no repetition; 4+ hits on the same target inside the window = full fixation
      return clamp((maxCount - 1) / 3, 0, 1);
    }

    function fixatedTargetKey() {
      if (recentTargets.length < 3) return null;
      const counts = new Map();
      recentTargets.forEach(({ key }) => counts.set(key, (counts.get(key) || 0) + 1));
      let best = null;
      counts.forEach((count, key) => {
        if (count >= 3 && (!best || count > best.count)) best = { key, count };
      });
      return best ? best.key : null;
    }

    let rateLimitedAt = 0;
    function snapshot() {
      const t = now();
      trimWindow(clickTimestamps, t, RATE_WINDOW_MS);
      trimWindow(interactionTimestamps, t, RATE_WINDOW_MS);

      const idleMs = t - lastInteractionAt;
      // Decay speeds toward zero once movement actually stops, so a single
      // burst of motion doesn't read as "moving" for seconds afterward.
      if (lastPointer && t - lastPointer.t > 250) pointerSpeed *= 0.85;
      if (t - lastScrollT > 250) scrollSpeed *= 0.85;

      return {
        t,
        idleMs,
        pointerSpeed, // px/ms
        scrollSpeed, // px/ms
        scrollDirection,
        clicksPerWindow: clickTimestamps.length,
        interactionsPerWindow: interactionTimestamps.length,
        currentSection,
        currentSectionDwellMs: currentSectionDwell(),
        sectionsVisited: visitedSectionIds.size,
        scrollDepth: maxScrollDepth,
        repeatedActionScore: repeatedActionScore(),
        fixatedTargetKey: fixatedTargetKey(),
        rateWindowMs: RATE_WINDOW_MS,
      };
    }

    function start() {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('click', onClick, { passive: true });
      window.addEventListener('touchstart', markInteraction, { passive: true });
      window.addEventListener('keydown', onKeydown);
      document.addEventListener('visibilitychange', onVisibility);

      const tickTimer = setInterval(() => {
        emitter.emit('tick', snapshot());
      }, TICK_MS);

      return function stop() {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('click', onClick);
        window.removeEventListener('touchstart', markInteraction);
        window.removeEventListener('keydown', onKeydown);
        document.removeEventListener('visibilitychange', onVisibility);
        clearInterval(tickTimer);
        sectionObserver?.disconnect();
      };
    }

    return {
      start,
      observeSections,
      snapshot,
      on: emitter.on,
    };
  }

  global.AESignals = { createSignals };
})(window);
