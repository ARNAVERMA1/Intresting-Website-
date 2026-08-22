/**
 * PERFORMANCE GOVERNOR — the honest half of "graceful degradation".
 *
 * detectDeviceTier() guesses once at load from core count and memory. That
 * guess can be wrong in both directions: a capable phone throttling on heat,
 * a laptop on battery saver, or a modest device that actually copes fine.
 * This measures the frame rate the visitor is *really* getting and scales the
 * whole effect budget to match.
 *
 * Rules it plays by:
 *   - Judge over multi-second windows, never a single dropped frame.
 *   - Downgrade readily, upgrade reluctantly (and only back toward the
 *     original ceiling, never past it).
 *   - Hold a cooldown between changes so quality never oscillates visibly.
 *   - Ignore time spent in a hidden tab, where rAF is throttled by design.
 */
(function (global) {
  'use strict';

  const WINDOW_MS = 2000;
  const DOWNGRADE_FPS = 42;
  const UPGRADE_FPS = 57;
  const COOLDOWN_MS = 6000;
  const STEPS = [1, 0.72, 0.48, 0.28];

  function createPerformanceGovernor() {
    let stepIndex = 0;
    let frames = 0;
    let windowStart = performance.now();
    let lastChangeAt = -Infinity;
    let lastFps = 60;
    let running = true;

    function apply(nextIndex, reason) {
      if (nextIndex === stepIndex) return;
      stepIndex = nextIndex;
      lastChangeAt = performance.now();
      document.documentElement.style.setProperty('--ae-quality', STEPS[stepIndex].toFixed(2));
      document.documentElement.dataset.quality = String(stepIndex);
      document.dispatchEvent(
        new CustomEvent('ae:quality', {
          detail: { scale: STEPS[stepIndex], step: stepIndex, fps: Math.round(lastFps), reason },
        })
      );
    }

    function tick(now) {
      if (!running) return;
      frames++;
      const elapsed = now - windowStart;

      if (elapsed >= WINDOW_MS) {
        lastFps = (frames * 1000) / elapsed;
        frames = 0;
        windowStart = now;

        const cooled = now - lastChangeAt > COOLDOWN_MS;
        if (cooled) {
          if (lastFps < DOWNGRADE_FPS && stepIndex < STEPS.length - 1) {
            apply(stepIndex + 1, 'low-fps');
          } else if (lastFps > UPGRADE_FPS && stepIndex > 0) {
            apply(stepIndex - 1, 'recovered');
          }
        }
      }
      requestAnimationFrame(tick);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        running = false;
      } else {
        // Restart the window rather than counting throttled background time
        // as a performance problem.
        running = true;
        frames = 0;
        windowStart = performance.now();
        requestAnimationFrame(tick);
      }
    });

    document.documentElement.style.setProperty('--ae-quality', '1');
    requestAnimationFrame(tick);

    return {
      getScale: () => STEPS[stepIndex],
      getFps: () => Math.round(lastFps),
      getStep: () => stepIndex,
    };
  }

  global.AEPerformanceGovernor = { createPerformanceGovernor, STEPS };
})(window);
