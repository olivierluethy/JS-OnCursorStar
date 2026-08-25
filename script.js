/**
 * BinaryParticles — a dependency-free binary-particle physics animation.
 *
 * Fills a target element with a grid of `0`s and `1`s rendered on a <canvas>.
 * Moving the cursor near them shoves them away; each disturbed glyph falls and
 * bounces under gravity, then eases back to its home grid position.
 *
 * Browser:  window.BinaryParticles.init(element, options)
 * Node:     require('./script.js') exposes the pure helpers for testing.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api; // Node: pure helpers + init
  }
  if (typeof window !== 'undefined') {
    window.BinaryParticles = api; // Browser: global
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------

  const DEFAULTS = {
    chars: ['0', '1'],
    spacing: 28,
    fontSize: 20,
    fontFamily: 'monospace',
    color: '#111',
    background: '#ccc',
    gravity: 1400,
    stiffness: 120,
    damping: 0.86,
    restitution: 0.5,
    pushRadius: 90,
    pushStrength: 2600,
    velocityInfluence: 0.7,
    maxParticles: 4000,
  };

  function mergeConfig(partial) {
    const cfg = Object.assign({}, DEFAULTS, partial || {});
    // Copy the array so callers can't mutate DEFAULTS.chars by reference.
    cfg.chars = (partial && partial.chars)
      ? partial.chars.slice()
      : DEFAULTS.chars.slice();
    return cfg;
  }

  // -------------------------------------------------------------------------
  // Grid construction
  // -------------------------------------------------------------------------

  function buildGrid(width, height, config) {
    const particles = [];
    const step = config.spacing;
    const cols = Math.floor(width / step);
    const rows = Math.floor(height / step);
    const offsetX = (width - cols * step) / 2 + step / 2;
    const offsetY = (height - rows * step) / 2 + step / 2;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (particles.length >= config.maxParticles) return particles;
        const x = offsetX + c * step;
        const y = offsetY + r * step;
        particles.push({
          home: { x, y },
          pos: { x, y },
          vel: { x: 0, y: 0 },
          char: config.chars[i % config.chars.length],
          activity: 0,
        });
        i++;
      }
    }
    return particles;
  }

  // -------------------------------------------------------------------------
  // Physics
  // -------------------------------------------------------------------------

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /**
   * Apply the cursor's repulsion force to a particle within its influence
   * radius, for one time slice `dt`. `pushStrength` is an acceleration (px/s²)
   * so the effect is frame-rate independent. The force blends a radial push
   * (away from the cursor) with the cursor's own velocity, so a fast sweep
   * throws glyphs in the drag direction.
   */
  function applyPush(p, input, config, dt) {
    if (!input || !input.active) return;
    const dx = p.pos.x - input.x;
    const dy = p.pos.y - input.y;
    const dist = Math.hypot(dx, dy);
    if (dist > config.pushRadius) return;
    const falloff = 1 - dist / config.pushRadius; // 1 at center, 0 at edge
    let dirX, dirY;
    if (dist < 1e-3) { dirX = 1; dirY = 0; } // arbitrary outward dir at center
    else { dirX = dx / dist; dirY = dy / dist; }
    const mag = config.pushStrength * falloff;
    const accX = dirX * mag + input.vx * config.velocityInfluence * falloff;
    const accY = dirY * mag + input.vy * config.velocityInfluence * falloff;
    p.vel.x += accX * dt;
    p.vel.y += accY * dt;
    p.activity = 1;
  }

  /** Reflect a particle off the container walls with restitution. */
  function collide(p, config, bounds) {
    if (!bounds) return;
    if (p.pos.x < 0) { p.pos.x = 0; p.vel.x = -p.vel.x * config.restitution; }
    else if (p.pos.x > bounds.width) { p.pos.x = bounds.width; p.vel.x = -p.vel.x * config.restitution; }
    if (p.pos.y < 0) { p.pos.y = 0; p.vel.y = -p.vel.y * config.restitution; }
    else if (p.pos.y > bounds.height) { p.pos.y = bounds.height; p.vel.y = -p.vel.y * config.restitution; }
  }

  /**
   * Advance the whole particle system by `dt` seconds (mutates in place).
   *
   * @param {Array}  particles
   * @param {number} dt      seconds (caller clamps)
   * @param {?Object} input  { x, y, vx, vy, active } or null
   * @param {Object} config
   * @param {?Object} bounds { width, height } or undefined (no collision)
   */
  function step(particles, dt, input, config, bounds) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      applyPush(p, input, config, dt);

      // Spring pulls the particle back to its home grid position.
      let ax = (p.home.x - p.pos.x) * config.stiffness;
      let ay = (p.home.y - p.pos.y) * config.stiffness;
      // Gravity acts only while the particle is "active" (recently disturbed),
      // so a settled particle rests exactly on its home spot.
      ay += config.gravity * p.activity;

      p.vel.x += ax * dt;
      p.vel.y += ay * dt;

      // Frame-rate independent damping.
      const damp = Math.pow(config.damping, dt * 60);
      p.vel.x *= damp;
      p.vel.y *= damp;

      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;

      collide(p, config, bounds);

      // Activity stays high while displaced or moving fast, decays otherwise.
      const dx = p.pos.x - p.home.x;
      const dy = p.pos.y - p.home.y;
      const distToHome = Math.hypot(dx, dy);
      const speed = Math.hypot(p.vel.x, p.vel.y);
      const disturbance = clamp(distToHome / config.pushRadius + speed / 400, 0, 1);
      p.activity = Math.max(p.activity * 0.94, disturbance);
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  function render(ctx, particles, config, dpr) {
    const w = ctx.canvas.width / dpr;
    const h = ctx.canvas.height / dpr;
    if (config.background === 'transparent') ctx.clearRect(0, 0, w, h);
    else { ctx.fillStyle = config.background; ctx.fillRect(0, 0, w, h); }
    ctx.fillStyle = config.color;
    ctx.font = config.fontSize + 'px ' + config.fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.fillText(p.char, p.pos.x, p.pos.y);
    }
  }

  // -------------------------------------------------------------------------
  // Runtime — canvas, input, loop, ResizeObserver
  // -------------------------------------------------------------------------

  function init(element, options) {
    if (!element) throw new Error('BinaryParticles.init: element is required');
    let config = mergeConfig(options);

    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (getComputedStyle(element).position === 'static') {
      element.style.position = 'relative';
    }

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    element.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let dpr = 1;
    let bounds = { width: 0, height: 0 };
    let particles = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = element.getBoundingClientRect();
      bounds = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = buildGrid(rect.width, rect.height, config);
    }

    // Input tracking → cursor position + velocity (px/s).
    const input = { x: 0, y: 0, vx: 0, vy: 0, active: false };
    let lastX = 0, lastY = 0, lastT = 0;

    function onMove(e) {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = e.timeStamp || performance.now();
      const dt = lastT ? (now - lastT) / 1000 : 0;
      if (dt > 0) {
        input.vx = (x - lastX) / dt;
        input.vy = (y - lastY) / dt;
      }
      input.x = x; input.y = y; input.active = true;
      lastX = x; lastY = y; lastT = now;
    }
    function onLeave() {
      input.active = false; input.vx = 0; input.vy = 0; lastT = 0;
    }

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    element.addEventListener('pointercancel', onLeave);

    const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(element);

    resize();

    let rafId = null;
    let prevT = 0;
    function frame(t) {
      const dt = prevT ? Math.min((t - prevT) / 1000, 1 / 30) : 1 / 60;
      prevT = t;
      step(particles, dt, input, config, bounds);
      render(ctx, particles, config, dpr);
      rafId = requestAnimationFrame(frame);
    }

    if (reduceMotion) {
      render(ctx, particles, config, dpr); // static field, no loop
    } else {
      rafId = requestAnimationFrame(frame);
    }

    return {
      updateOptions(partial) {
        const rebuild = partial && (
          'spacing' in partial || 'chars' in partial || 'maxParticles' in partial
        );
        config = mergeConfig(Object.assign({}, config, partial));
        if (rebuild) resize();
      },
      destroy() {
        if (rafId) cancelAnimationFrame(rafId);
        if (ro) ro.disconnect();
        element.removeEventListener('pointermove', onMove);
        element.removeEventListener('pointerleave', onLeave);
        element.removeEventListener('pointercancel', onLeave);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      },
    };
  }

  return { DEFAULTS, mergeConfig, buildGrid, step, render, init };
});
