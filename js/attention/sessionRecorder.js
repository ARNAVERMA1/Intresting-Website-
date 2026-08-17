/**
 * SESSION RECORDER — an optional observer bolted onto the Attention Engine.
 *
 * Everything else in the engine cares only about *now*. This module keeps a
 * compact, bounded record of the whole visit so downstream features can look
 * backward: which sections were seen and for how long, where clicks landed,
 * how scroll velocity rose and fell, and every mode the engine passed through.
 *
 * It stays in the attention layer (not components/) because it produces data,
 * never pixels — the generative "signature" artwork is just one consumer of it.
 * All buffers are hard-capped so a long visit can't grow memory without bound.
 */
(function (global) {
  'use strict';

  const MAX_CLICKS = 120;
  const MAX_SCROLL_SAMPLES = 240;
  const MAX_TRANSITIONS = 80;
  const SCROLL_SAMPLE_MS = 400;

  const MODE_RANK = { dormant: 0, ambient: 1, curious: 2, fixated: 2, engaged: 3, flow: 4 };

  function createSessionRecorder() {
    const startedAt = Date.now();

    const clicks = []; // { x, y, t } normalized to viewport 0..1
    const scrollSamples = []; // { t, depth, speed }
    const transitions = []; // { t, mode }
    const sectionOrder = []; // ids, first-visit order
    const sectionDwell = new Map(); // id -> ms

    let peakMode = 'dormant';
    let peakRank = 0;
    let peakScore = 0;
    let rewardCount = 0;
    let evolveCount = 0;
    let inviteCount = 0;
    let secretCount = 0;

    let currentSection = null;
    let currentSectionSince = 0;
    let lastScrollSampleAt = 0;

    function push(buffer, item, cap) {
      buffer.push(item);
      if (buffer.length > cap) buffer.shift();
    }

    document.addEventListener('attention:tick', (e) => {
      const { score, vars } = e.detail;
      if (score > peakScore) peakScore = score;

      const now = performance.now();
      if (now - lastScrollSampleAt >= SCROLL_SAMPLE_MS) {
        lastScrollSampleAt = now;
        const doc = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        push(
          scrollSamples,
          {
            t: Date.now() - startedAt,
            depth: Math.min(1, (window.scrollY || 0) / doc),
            speed: vars.motion,
          },
          MAX_SCROLL_SAMPLES
        );
      }
    });

    document.addEventListener('attention:modechange', (e) => {
      const rank = MODE_RANK[e.detail.mode] ?? 0;
      if (rank > peakRank) {
        peakRank = rank;
        peakMode = e.detail.mode;
      }
      push(transitions, { t: Date.now() - startedAt, mode: e.detail.mode }, MAX_TRANSITIONS);
    });

    document.addEventListener('attention:section', (e) => {
      const id = e.detail.id;
      const now = performance.now();
      if (currentSection && currentSection !== id) {
        sectionDwell.set(currentSection, (sectionDwell.get(currentSection) || 0) + (now - currentSectionSince));
      }
      if (currentSection !== id) {
        currentSection = id;
        currentSectionSince = now;
        if (!sectionOrder.includes(id)) sectionOrder.push(id);
      }
    });

    document.addEventListener('attention:reward', () => rewardCount++);
    document.addEventListener('attention:evolve', () => evolveCount++);
    document.addEventListener('attention:invite', () => inviteCount++);
    document.addEventListener('ae:secret-found', () => secretCount++);

    window.addEventListener(
      'click',
      (e) => {
        push(
          clicks,
          {
            x: e.clientX / Math.max(1, window.innerWidth),
            y: e.clientY / Math.max(1, window.innerHeight),
            t: Date.now() - startedAt,
          },
          MAX_CLICKS
        );
      },
      { passive: true }
    );

    // Snapshot is a deep-enough copy that consumers can't mutate the record.
    function getRecord() {
      const dwell = new Map(sectionDwell);
      if (currentSection) {
        dwell.set(
          currentSection,
          (dwell.get(currentSection) || 0) + (performance.now() - currentSectionSince)
        );
      }
      return {
        startedAt,
        durationMs: Date.now() - startedAt,
        clicks: clicks.slice(),
        scrollSamples: scrollSamples.slice(),
        transitions: transitions.slice(),
        sectionOrder: sectionOrder.slice(),
        sectionDwell: dwell,
        peakMode,
        peakScore,
        rewardCount,
        evolveCount,
        inviteCount,
        secretCount,
      };
    }

    return { getRecord };
  }

  global.AESessionRecorder = { createSessionRecorder, MODE_RANK };
})(window);
