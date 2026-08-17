/**
 * WebGL aurora field — the deepest layer of the environment.
 *
 * A single fullscreen quad running an fbm-domain-warped fragment shader.
 * Flow speed, color and the glow that follows the pointer are all driven by
 * the Attention Engine, so the atmosphere itself breathes with engagement
 * rather than looping on a fixed timer.
 *
 * Degrades in three stages, deliberately: low-end devices and reduced-motion
 * users never initialize it at all, a missing/failed WebGL context returns
 * null, and a lost context tears down cleanly. In every one of those cases
 * the existing 2D particle field still carries the visual on its own.
 */
(function (global) {
  'use strict';

  const { clamp, prefersReducedMotion, detectDeviceTier } = global.AEUtils;

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision mediump float;

    uniform vec2  uRes;
    uniform float uTime;
    uniform float uMotion;
    uniform float uNovelty;
    uniform vec2  uPointer;
    uniform vec3  uColorA;
    uniform vec3  uColorB;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.02;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes.xy;
      vec2 p = uv;
      p.x *= uRes.x / uRes.y;

      float t = uTime * 0.05 * (0.35 + uMotion);

      // Domain warp: noise sampling noise, which is what gives the field its
      // slow curling, aurora-like structure instead of flat cloud blobs.
      vec2 q = vec2(fbm(p * 1.5 + t), fbm(p * 1.5 + vec2(5.2, 1.3) - t));
      float f = fbm(p * 2.0 + q * 1.5 + t * 0.4);

      float d = distance(uv, uPointer);
      float glow = smoothstep(0.42, 0.0, d) * (0.10 + uNovelty * 0.22);

      vec3 col = mix(uColorA, uColorB, clamp(f * 1.45, 0.0, 1.0));
      col += glow * uColorB;

      float vig = smoothstep(1.25, 0.15, length(uv - 0.5));
      col *= 0.30 + 0.70 * vig;

      float alpha = clamp(f * 0.62 + glow, 0.0, 1.0) * 0.5;
      gl_FragColor = vec4(col, alpha);
    }
  `;

  // Mirrors the --mode-color palette in variables.css, in linear 0..1 triples.
  const MODE_COLORS = {
    dormant: [0.56, 0.64, 0.84],
    ambient: [0.73, 0.64, 1.0],
    curious: [0.84, 0.55, 0.94],
    engaged: [0.49, 0.94, 0.82],
    flow: [1.0, 0.81, 0.48],
    fixated: [1.0, 0.70, 0.48],
  };

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[shaderBackground] shader compile failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function initShaderBackground(canvas) {
    if (!canvas) return null;
    if (prefersReducedMotion()) return null;
    if (detectDeviceTier() === 'low') return null;

    const gl =
      canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, powerPreference: 'low-power' }) ||
      canvas.getContext('experimental-webgl', { alpha: true, antialias: false, depth: false });
    if (!gl) return null;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[shaderBackground] program link failed:', gl.getProgramInfoLog(program));
      return null;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      motion: gl.getUniformLocation(program, 'uMotion'),
      novelty: gl.getUniformLocation(program, 'uNovelty'),
      pointer: gl.getUniformLocation(program, 'uPointer'),
      colorA: gl.getUniformLocation(program, 'uColorA'),
      colorB: gl.getUniformLocation(program, 'uColorB'),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Render below native resolution and let CSS upscale — the field is all
    // low-frequency gradients, so the cost drops sharply and nobody can tell.
    const RENDER_SCALE = detectDeviceTier() === 'high' ? 0.7 : 0.5;

    function resize() {
      const w = Math.max(1, Math.floor(window.innerWidth * RENDER_SCALE));
      const h = Math.max(1, Math.floor(window.innerHeight * RENDER_SCALE));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    resize();
    window.addEventListener('resize', resize);

    let motion = 0.4;
    let novelty = 0.45;
    let targetColor = MODE_COLORS.ambient;
    const colorA = [0.05, 0.04, 0.10];
    const colorB = MODE_COLORS.ambient.slice();
    let pointer = { x: 0.5, y: 0.5 };

    document.addEventListener('attention:tick', (e) => {
      motion = e.detail.vars.motion;
      novelty = e.detail.vars.novelty;
      targetColor = MODE_COLORS[e.detail.mode] || MODE_COLORS.ambient;
    });

    window.addEventListener(
      'pointermove',
      (e) => {
        pointer.x = e.clientX / Math.max(1, window.innerWidth);
        // GL's origin is bottom-left; the DOM's is top-left.
        pointer.y = 1 - e.clientY / Math.max(1, window.innerHeight);
      },
      { passive: true }
    );

    // Device tilt doubles as a pointer on phones, so the glow still tracks
    // something meaningful when there's no cursor at all.
    document.addEventListener('ae:tilt', (e) => {
      pointer.x = clamp(0.5 + e.detail.x * 0.5, 0, 1);
      pointer.y = clamp(0.5 - e.detail.y * 0.5, 0, 1);
    });

    let running = true;
    let raf = null;
    const startTime = performance.now();

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      running = false;
      if (raf) cancelAnimationFrame(raf);
      canvas.classList.add('is-hidden');
    });

    function frame() {
      if (!running) return;
      const t = (performance.now() - startTime) / 1000;

      for (let i = 0; i < 3; i++) {
        colorB[i] += (targetColor[i] - colorB[i]) * 0.02;
      }

      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, t);
      gl.uniform1f(u.motion, motion);
      gl.uniform1f(u.novelty, novelty);
      gl.uniform2f(u.pointer, pointer.x, pointer.y);
      gl.uniform3f(u.colorA, colorA[0], colorA[1], colorA[2]);
      gl.uniform3f(u.colorB, colorB[0], colorB[1], colorB[2]);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }

    // Don't burn GPU on a tab nobody is looking at.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    });

    canvas.classList.add('is-active');
    raf = requestAnimationFrame(frame);

    return { canvas, resize };
  }

  global.AEShaderBackground = { initShaderBackground };
})(window);
