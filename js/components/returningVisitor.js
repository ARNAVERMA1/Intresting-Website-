/**
 * Returning-visitor memory — the engine's only long-term recall.
 *
 * The Attention Engine is otherwise strictly per-session. This stores a tiny
 * summary (visit count, deepest mode reached, when) in localStorage so the
 * page can acknowledge someone who has been here before, and so the hero can
 * greet a third-time visitor differently from a first-time one.
 *
 * Deliberately minimal and local-only: a handful of numbers, no identifiers,
 * no network, and a "forget me" path exposed through the command palette.
 */
(function (global) {
  'use strict';

  const KEY = 'ae-visitor-memory';
  const MODE_RANK = { dormant: 0, ambient: 1, curious: 2, fixated: 2, engaged: 3, flow: 4 };

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed == null) return null;
      return parsed;
    } catch {
      return null; // private mode, disabled storage, or corrupt entry
    }
  }

  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function forget() {
    try {
      localStorage.removeItem(KEY);
      return true;
    } catch {
      return false;
    }
  }

  function describeGap(ms) {
    const mins = ms / 60000;
    if (mins < 60) return 'a little while ago';
    const hours = mins / 60;
    if (hours < 24) return 'earlier today';
    const days = hours / 24;
    if (days < 2) return 'yesterday';
    if (days < 14) return `${Math.round(days)} days ago`;
    return 'a while back';
  }

  function initReturningVisitor({ eyebrowEl, recorder, onGreet } = {}) {
    const previous = read();
    const isReturning = !!previous && previous.visits > 0;

    if (isReturning) {
      document.documentElement.classList.add('ae-returning');

      const gap = describeGap(Date.now() - (previous.lastVisit || Date.now()));
      const peak = previous.peakMode || 'ambient';
      const line =
        previous.visits >= 3
          ? `Welcome back — visit ${previous.visits + 1}. You keep coming back.`
          : `Welcome back. Last time, ${gap}, you reached ${peak}.`;

      if (eyebrowEl) eyebrowEl.textContent = 'YOU HAVE BEEN HERE BEFORE';
      onGreet?.(line);
    }

    // Persist on the way out. visibilitychange is the reliable moment on
    // mobile — 'unload' is not fired in several modern mobile browsers.
    function persist() {
      const record = recorder?.getRecord?.();
      const currentRank = MODE_RANK[record?.peakMode] ?? 0;
      const previousRank = MODE_RANK[previous?.peakMode] ?? 0;

      write({
        visits: (previous?.visits || 0) + 1,
        // Keep the best state ever reached, not merely the latest.
        peakMode: currentRank >= previousRank ? record?.peakMode || 'ambient' : previous.peakMode,
        lastVisit: Date.now(),
        totalSeconds: Math.round((previous?.totalSeconds || 0) + (record?.durationMs || 0) / 1000),
      });
    }

    let saved = false;
    function persistOnce() {
      if (saved) return;
      saved = true;
      persist();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistOnce();
    });
    window.addEventListener('pagehide', persistOnce);

    return {
      isReturning,
      previous,
      forget,
      // Allow re-arming after a manual save, so a long visit still records.
      resetSaveLatch: () => {
        saved = false;
      },
    };
  }

  global.AEReturningVisitor = { initReturningVisitor, forget, read };
})(window);
