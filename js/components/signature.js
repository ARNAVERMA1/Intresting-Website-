/**
 * ATTENTION SIGNATURE — a generative portrait of one visit.
 *
 * Everything the engine has quietly observed gets drawn as a single star-chart:
 * each ring is a section you reached (radius = arrival order, sweep = how long
 * you stayed), nodes are where you clicked, the ragged inner trace is your
 * scroll rhythm, and the palette comes from the deepest attention mode you hit.
 *
 * Two people cannot produce the same image, and the same person won't twice.
 * That's the point — it's the Attention Engine made visible, and the one thing
 * on the page you can actually take with you.
 */
(function (global) {
  'use strict';

  const { clamp, map } = global.AEUtils;

  const PALETTES = {
    dormant: ['#8ea3d6', '#6d7fb0', '#c3cde8'],
    ambient: ['#b9a4ff', '#8f6fff', '#ded4ff'],
    curious: ['#d68cf0', '#b062d6', '#f2d3ff'],
    engaged: ['#7cf0d2', '#3fbfa2', '#c9fff1'],
    flow: ['#ffcf7a', '#ff9f4a', '#ffe9c2'],
    fixated: ['#ffb37a', '#ff8a5c', '#ffddc4'],
  };

  const MODE_TITLE = {
    dormant: 'Still Water',
    ambient: 'Quiet Drift',
    curious: 'The Wanderer',
    engaged: 'Steady Signal',
    flow: 'Deep Current',
    fixated: 'The Returner',
  };

  const SIZE = 1000; // internal resolution; CSS scales it responsively

  // Small seeded PRNG so a given seed always redraws the identical piece —
  // "regenerate" changes the seed deliberately rather than drifting randomly.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFromRecord(record) {
    let seed = Math.floor(record.durationMs / 100) + record.clicks.length * 977;
    record.sectionOrder.forEach((id, i) => {
      for (let c = 0; c < id.length; c++) seed += id.charCodeAt(c) * (i + 3);
    });
    seed += Math.floor(record.peakScore * 10000);
    return seed || 1;
  }

  function initSignature(root, recorder) {
    if (!root || !recorder) return null;

    const canvas = root.querySelector('.signature-canvas');
    const regenBtn = root.querySelector('[data-signature-regen]');
    const saveBtn = root.querySelector('[data-signature-save]');
    const titleEl = root.querySelector('.signature-title');
    const statsEl = root.querySelector('.signature-stats');
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    canvas.width = SIZE;
    canvas.height = SIZE;

    let seedOffset = 0;

    function draw() {
      const record = recorder.getRecord();
      const rand = mulberry32(seedFromRecord(record) + seedOffset * 7919);
      const palette = PALETTES[record.peakMode] || PALETTES.ambient;
      const cx = SIZE / 2;
      const cy = SIZE / 2;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // --- ground ---------------------------------------------------------
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.72);
      bg.addColorStop(0, 'rgba(20, 16, 38, 0.95)');
      bg.addColorStop(1, 'rgba(7, 6, 13, 0.98)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // --- faint star dust, density follows how far the visit ranged -------
      const dust = 90 + Math.floor(record.scrollSamples.length * 1.6);
      for (let i = 0; i < dust; i++) {
        const x = rand() * SIZE;
        const y = rand() * SIZE;
        const r = rand() * 1.5 + 0.2;
        ctx.globalAlpha = 0.10 + rand() * 0.35;
        ctx.fillStyle = palette[2];
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // --- section rings ---------------------------------------------------
      const sections = record.sectionOrder;
      const totalDwell = [...record.sectionDwell.values()].reduce((a, b) => a + b, 0) || 1;
      const baseRadius = SIZE * 0.13;
      const ringStep = sections.length ? (SIZE * 0.33) / Math.max(sections.length, 1) : 0;

      sections.forEach((id, i) => {
        const dwell = record.sectionDwell.get(id) || 0;
        const share = dwell / totalDwell;
        const radius = baseRadius + ringStep * i;
        const sweep = clamp(share * Math.PI * 3.4, 0.35, Math.PI * 1.85);
        const startAngle = rand() * Math.PI * 2;

        ctx.strokeStyle = palette[i % 2 === 0 ? 0 : 1];
        ctx.globalAlpha = 0.28 + share * 0.6;
        ctx.lineWidth = 1.2 + share * 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + sweep);
        ctx.stroke();

        // a marker where each ring begins — the moment you arrived
        const mx = cx + Math.cos(startAngle) * radius;
        const my = cy + Math.sin(startAngle) * radius;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = palette[2];
        ctx.beginPath();
        ctx.arc(mx, my, 3.4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // --- scroll rhythm: a closed trace, radius modulated by momentum -----
      const samples = record.scrollSamples;
      if (samples.length > 2) {
        ctx.beginPath();
        samples.forEach((s, i) => {
          const angle = (i / samples.length) * Math.PI * 2;
          const r = SIZE * 0.075 + s.depth * SIZE * 0.055 + s.speed * SIZE * 0.03;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.strokeStyle = palette[1];
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // --- mode transitions: rays outward, one per shift in attention ------
      record.transitions.forEach((tr, i) => {
        const angle = (i / Math.max(record.transitions.length, 1)) * Math.PI * 2 + rand() * 0.25;
        const inner = SIZE * 0.40;
        const outer = inner + 20 + rand() * 70;
        ctx.strokeStyle = PALETTES[tr.mode]?.[0] || palette[0];
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // --- clicks: nodes placed by where they actually landed --------------
      record.clicks.forEach((c, i) => {
        const angle = c.x * Math.PI * 2;
        const r = SIZE * 0.16 + c.y * SIZE * 0.26;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const size = 2.4 + (i / Math.max(record.clicks.length, 1)) * 4.5;

        const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 4.5);
        halo.addColorStop(0, palette[2]);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, size * 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.95;
        ctx.fillStyle = palette[2];
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // --- core: brightness earned by peak engagement ----------------------
      const coreR = SIZE * (0.035 + record.peakScore * 0.05);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3.2);
      core.addColorStop(0, palette[2]);
      core.addColorStop(0.35, palette[0]);
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Rewards and secrets earn extra orbiting marks — proof of discovery.
      const bonus = record.rewardCount + record.secretCount + record.evolveCount;
      for (let i = 0; i < bonus; i++) {
        const angle = rand() * Math.PI * 2;
        const r = SIZE * 0.46 + rand() * SIZE * 0.03;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = palette[0];
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // --- caption ---------------------------------------------------------
      const seconds = Math.round(record.durationMs / 1000);
      const label = MODE_TITLE[record.peakMode] || 'Quiet Drift';
      ctx.font = '500 26px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(246,244,255,0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(label.toUpperCase(), cx, SIZE - 74);
      ctx.font = '400 17px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(167,159,196,0.7)';
      ctx.fillText(
        `${sections.length} sections · ${record.clicks.length} marks · ${seconds}s`,
        cx,
        SIZE - 44
      );

      if (titleEl) titleEl.textContent = label;
      if (statsEl) {
        statsEl.textContent =
          `Peak state: ${record.peakMode} · ${sections.length} sections reached · ` +
          `${record.clicks.length} interactions · ${seconds}s observed`;
      }

    }

    // Redraw on every entry into view, not just the first. The record keeps
    // growing as the visit goes on, so a signature rendered once at first
    // sight would permanently under-report anyone who explored afterwards
    // and scrolled back — exactly the visitors it should reward best.
    let wasVisible = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !wasVisible) {
            wasVisible = true;
            draw();
          } else if (!entry.isIntersecting) {
            wasVisible = false;
          }
        });
      },
      { threshold: 0.25 }
    );
    observer.observe(root);

    regenBtn?.addEventListener('click', () => {
      seedOffset++;
      root.classList.add('is-regenerating');
      setTimeout(() => root.classList.remove('is-regenerating'), 620);
      draw();
    });

    saveBtn?.addEventListener('click', () => {
      draw(); // capture the very latest state at the moment of saving
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attention-signature-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    });

    return { draw, redraw: draw };
  }

  global.AESignature = { initSignature };
})(window);
