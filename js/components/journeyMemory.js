/**
 * Journey memory: the one place on the page that looks *backward*. Every
 * other component reacts to the present moment; this one quietly keeps a
 * running summary of the visit (sections seen, how deep engagement got,
 * whether the engine ever had to invite the visitor back) and lets the
 * footer say something true about it instead of a generic closing line.
 *
 * This is what makes "sections subtly change depending on previous
 * interactions" true across the whole page, not just within one card.
 */
(function (global) {
  'use strict';

  const MODE_RANK = { dormant: 0, ambient: 1, curious: 2, fixated: 2, engaged: 3, flow: 4 };

  // Counted from the DOM rather than hardcoded, so adding a section to the
  // page can't silently make "explored all of it" unreachable.
  const countSections = () => document.querySelectorAll('[data-section]').length || 1;

  function initJourneyMemory(footerLineEl) {
    if (!footerLineEl) return null;

    const visited = new Set();
    let peakMode = 'dormant';
    let peakRank = 0;
    let inviteCount = 0;
    let rewardCount = 0;
    let evolveCount = 0;
    let settled = false;

    document.addEventListener('attention:section', (e) => visited.add(e.detail.id));
    document.addEventListener('attention:modechange', (e) => {
      const rank = MODE_RANK[e.detail.mode] ?? 0;
      if (rank > peakRank) {
        peakRank = rank;
        peakMode = e.detail.mode;
      }
    });
    document.addEventListener('attention:invite', () => inviteCount++);
    document.addEventListener('attention:reward', () => rewardCount++);
    document.addEventListener('attention:evolve', () => evolveCount++);

    function describeJourney() {
      // The footer is the section being rendered right now, so reaching every
      // other one already counts as having explored the whole page.
      const exploredAll = visited.size >= countSections() - 1;
      if (peakMode === 'flow') {
        return "You reached flow. That doesn't happen for everyone who visits.";
      }
      if (evolveCount > 0) {
        return 'You kept coming back to the same thing until it changed. That was the point.';
      }
      if (exploredAll) {
        return 'You explored all of it — every section, in your own order.';
      }
      if (rewardCount > 0) {
        return 'Something rewarded your curiosity along the way. Good instinct.';
      }
      if (inviteCount > 0) {
        return 'You went quiet for a moment. The page noticed, and gently kept the door open.';
      }
      if (visited.size <= 2) {
        return "You moved fast and landed here anyway. The engine noticed that too.";
      }
      return 'You made it to the end. Not everyone does.';
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !settled) {
            settled = true;
            footerLineEl.textContent = describeJourney();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.6 }
    );
    observer.observe(footerLineEl);

    return { describeJourney };
  }

  global.AEJourneyMemory = { initJourneyMemory };
})(window);
