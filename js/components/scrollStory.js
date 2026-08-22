/**
 * Scroll-driven storytelling: progressive reveals, parallax depth layers,
 * and a pinned "story" section whose steps advance with scroll progress.
 * Everything reads scroll position through a single rAF loop rather than
 * per-element scroll listeners, so cost stays flat regardless of how many
 * elements opt in.
 */
(function (global) {
  'use strict';

  const { clamp, map, prefersReducedMotion } = global.AEUtils;

  function initReveals(root = document) {
    const els = [...root.querySelectorAll('[data-reveal]')];
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = entry.target.dataset.revealDelay || 0;
            entry.target.style.setProperty('--reveal-delay', `${delay}ms`);
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
    );
    els.forEach((el) => observer.observe(el));

    // Auto-stagger direct children of any [data-reveal-group].
    root.querySelectorAll('[data-reveal-group]').forEach((group) => {
      [...group.children].forEach((child, i) => {
        child.setAttribute('data-reveal', '');
        child.dataset.revealDelay = i * 90;
        observer.observe(child);
      });
    });
  }

  function initParallax(root = document) {
    const reduced = prefersReducedMotion();
    if (reduced) return;
    const layers = [...root.querySelectorAll('[data-parallax]')].map((el) => ({
      el,
      speed: parseFloat(el.dataset.parallax) || 0.2,
      inView: false,
    }));
    if (!layers.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const layer = layers.find((l) => l.el === entry.target);
          if (layer) layer.inView = entry.isIntersecting;
        });
      },
      { rootMargin: '20% 0px 20% 0px' }
    );
    layers.forEach((l) => observer.observe(l.el));

    function frame() {
      const vh = window.innerHeight;
      layers.forEach((layer) => {
        if (!layer.inView) return;
        const rect = layer.el.getBoundingClientRect();
        const centerOffset = rect.top + rect.height / 2 - vh / 2;
        const y = centerOffset * -layer.speed;
        layer.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function getProgress(el) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = rect.height - vh;
    if (total <= 0) return clamp((vh - rect.top) / rect.height, 0, 1);
    return clamp((-rect.top) / total, 0, 1);
  }

  function initPinnedStory(wrapper) {
    if (!wrapper) return null;
    const steps = [...wrapper.querySelectorAll('[data-story-step]')];
    if (!steps.length) return null;

    function frame() {
      const progress = getProgress(wrapper);
      const stepIndex = clamp(Math.floor(progress * steps.length), 0, steps.length - 1);
      wrapper.style.setProperty('--story-progress', progress.toFixed(4));
      steps.forEach((step, i) => {
        const active = i === stepIndex;
        step.classList.toggle('is-active', active);
        // Inactive steps are stacked invisibly on top of each other; without
        // this a screen reader would announce all four at once as one blob.
        if (step.getAttribute('aria-hidden') !== String(!active)) {
          step.setAttribute('aria-hidden', String(!active));
        }
        const localProgress = clamp(map(progress * steps.length, i, i + 1, 0, 1), 0, 1);
        step.style.setProperty('--step-progress', localProgress.toFixed(3));
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { getProgress: () => getProgress(wrapper) };
  }

  global.AEScrollStory = { initReveals, initParallax, initPinnedStory, getProgress };
})(window);
