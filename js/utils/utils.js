/**
 * Shared low-level helpers used across the Attention Engine and the
 * visual layer. Kept dependency-free and framework-free on purpose.
 */
(function (global) {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const lerp = (a, b, t) => a + (b - a) * t;

  // Exponential smoothing toward a target — frame-rate independent.
  const damp = (current, target, smoothing, dt) =>
    lerp(current, target, 1 - Math.pow(smoothing, dt));

  const map = (value, inMin, inMax, outMin, outMax) => {
    if (inMax - inMin === 0) return outMin;
    const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
    return outMin + t * (outMax - outMin);
  };

  function throttle(fn, waitMs) {
    let last = 0;
    let scheduled = null;
    return function throttled(...args) {
      const now = performance.now();
      const remaining = waitMs - (now - last);
      if (remaining <= 0) {
        last = now;
        fn.apply(this, args);
      } else if (!scheduled) {
        scheduled = setTimeout(() => {
          last = performance.now();
          scheduled = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  function debounce(fn, waitMs) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), waitMs);
    };
  }

  // Small pub/sub used by the engine's internal wiring.
  function createEmitter() {
    const listeners = new Map();
    return {
      on(event, cb) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(cb);
        return () => listeners.get(event)?.delete(cb);
      },
      emit(event, payload) {
        listeners.get(event)?.forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            console.error(`[emitter] listener for "${event}" threw`, err);
          }
        });
      },
    };
  }

  function prefersReducedMotion() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  // Rough, conservative device-capability tier. Never assume the best.
  function detectDeviceTier() {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4; // GB, Chromium-only, absent elsewhere
    const conn = navigator.connection || {};
    const saveData = !!conn.saveData;
    const slowNet = ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
    const coarsePointer =
      window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    let score = 0;
    score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
    score += mem >= 8 ? 2 : mem >= 4 ? 1 : 0;
    score -= saveData ? 2 : 0;
    score -= slowNet ? 1 : 0;
    score -= coarsePointer ? 0 : 0; // coarse pointer alone isn't a weakness signal

    if (score >= 3) return 'high';
    if (score >= 1) return 'mid';
    return 'low';
  }

  function isTouchDevice() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    );
  }

  const now = () => performance.now();

  global.AEUtils = {
    clamp,
    lerp,
    damp,
    map,
    throttle,
    debounce,
    createEmitter,
    prefersReducedMotion,
    detectDeviceTier,
    isTouchDevice,
    now,
  };
})(window);
