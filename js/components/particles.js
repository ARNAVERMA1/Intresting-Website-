/**
 * Ambient particle field. A single fixed canvas behind the whole page.
 * Density, drift speed and connective "constellation" behaviour are all
 * driven by the Attention Engine's CSS vars — never hand-tuned timers.
 * Cursor proximity gently deflects nearby particles; a 'reward' moment
 * fires a brief, one-time bloom.
 */
(function (global) {
  'use strict';

  const { clamp, map } = global.AEUtils;

  const MAX_PARTICLES = 140;
  const MIN_PARTICLES = 18;

  function initParticles(canvas) {
    const ctx = canvas.getContext('2d', { alpha: true });
    let width = 0;
    let height = 0;
    let dpr = clamp(window.devicePixelRatio || 1, 1, 2);

    let particles = [];
    let pointer = { x: -9999, y: -9999, active: false };
    let density = 0.4;
    let motion = 0.4;
    let novelty = 0.4;
    let mode = 'ambient';
    let bloom = 0; // transient reward energy, decays to 0

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      const targetCount = Math.round(map(density, 0, 1, MIN_PARTICLES, MAX_PARTICLES));
      particles = new Array(targetCount).fill(0).map(() => makeParticle());
    }

    function makeParticle() {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: Math.random() * 1.6 + 0.6,
        depth: Math.random() * 0.7 + 0.3,
        hueShift: Math.random() * 40 - 20,
      };
    }

    window.addEventListener('resize', () => {
      resize();
    });

    window.addEventListener(
      'pointermove',
      (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.active = true;
      },
      { passive: true }
    );
    window.addEventListener('pointerleave', () => (pointer.active = false));

    document.addEventListener('attention:tick', (e) => {
      density = e.detail.vars.particleDensity;
      motion = e.detail.vars.motion;
      novelty = e.detail.vars.novelty;
      mode = e.detail.mode;
    });

    document.addEventListener('attention:reward', () => {
      bloom = 1;
    });

    let lastCount = -1;
    function maybeReseed() {
      const targetCount = Math.round(map(density, 0, 1, MIN_PARTICLES, MAX_PARTICLES));
      if (Math.abs(targetCount - particles.length) > 8) {
        if (targetCount > particles.length) {
          while (particles.length < targetCount) particles.push(makeParticle());
        } else {
          particles.length = targetCount;
        }
      }
    }

    const baseHue = 258; // violet-blue, matches the brand palette

    function draw() {
      ctx.clearRect(0, 0, width, height);
      maybeReseed();

      bloom = Math.max(0, bloom - 0.012);
      const speed = 0.15 + motion * 0.55 + bloom * 0.8;
      const linkDistance = 90 + novelty * 60;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * (0.6 + speed) * p.depth;
        p.y += p.vy * (0.6 + speed) * p.depth;

        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          const influenceRadius = 140;
          if (dist < influenceRadius && dist > 0.001) {
            const force = (1 - dist / influenceRadius) * 0.04;
            // curious/engaged/flow gently attract (constellation feel);
            // dormant/ambient gently repel (gives the field room to breathe).
            const attract = mode === 'curious' || mode === 'engaged' || mode === 'flow' ? -1 : 1;
            p.vx += (dx / dist) * force * attract;
            p.vy += (dy / dist) * force * attract;
          }
        }

        p.vx *= 0.98;
        p.vy *= 0.98;

        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        const alpha = clamp(0.25 + p.depth * 0.35 + bloom * 0.3, 0, 0.85);
        ctx.beginPath();
        ctx.fillStyle = `hsla(${baseHue + p.hueShift}, 85%, ${68 + bloom * 15}%, ${alpha})`;
        ctx.arc(p.x, p.y, p.r * (1 + bloom * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }

      if (novelty > 0.35 || bloom > 0.05) {
        ctx.lineWidth = 0.6;
        const maxLinks = mode === 'flow' ? particles.length : Math.min(particles.length, 70);
        for (let i = 0; i < maxLinks; i++) {
          for (let j = i + 1; j < maxLinks; j++) {
            const a = particles[i];
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.hypot(dx, dy);
            if (dist < linkDistance) {
              const alpha = (1 - dist / linkDistance) * (0.12 + novelty * 0.18 + bloom * 0.25);
              ctx.strokeStyle = `hsla(${baseHue}, 80%, 72%, ${alpha})`;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }

      requestAnimationFrame(draw);
    }

    resize();
    requestAnimationFrame(draw);

    return { resize };
  }

  global.AEParticles = { initParticles };
})(window);
