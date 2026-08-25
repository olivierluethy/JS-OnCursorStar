# Binary Particle Physics Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the cursor effect into a Canvas-2D binary-particle physics animation, packaged as a dependency-free `BinaryParticles.init(el, options)` plugin.

**Architecture:** One file (`script.js`) exposes a browser global and Node exports. Pure physics helpers (`buildGrid`, `step`) are unit-tested with `node --test`. A thin runtime layer (canvas, input, rAF loop, ResizeObserver) wires them to the DOM. `index.html` is a live demo.

**Tech Stack:** Vanilla JavaScript (ES2018+), Canvas 2D, Pointer Events, `node:test` (built-in). No external dependencies.

## Global Constraints

- Zero external runtime and test dependencies (`node --test` only; no npm install required to run tests).
- `script.js` must work as a browser `<script>` (global `window.BinaryParticles`) AND expose pure helpers via `module.exports` when `module` exists (Node).
- Canvas 2D only — no WebGL, no per-particle DOM nodes.
- Programmatic `init()` only — no data-attribute auto-init.
- Physics core `step()` and `buildGrid()` must be pure (no DOM/canvas/global access), receiving all state as arguments.
- Honor `prefers-reduced-motion: reduce` (static field, no loop).
- Pointer Events for mouse + touch.
- Default options exactly as in the spec's config table.

---

### Task 1: Pure physics core — `buildGrid` and vector helpers

**Files:**
- Create: `script.js`
- Test: `test/physics.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DEFAULTS` — object with all config keys from the spec table.
  - `mergeConfig(partial)` → full config object (DEFAULTS merged with partial; partial may be undefined).
  - `buildGrid(width, height, config)` → `Array<Particle>` where
    `Particle = { home: {x,y}, pos: {x,y}, vel: {x,y}, char: string, activity: number }`.
    Particles are laid out on a grid of `config.spacing`, centered with half-spacing
    inset, capped at `config.maxParticles`. `char` is chosen from `config.chars` by
    index parity so the field is deterministic and testable. `pos` starts equal to
    `home`; `vel` is `{0,0}`; `activity` is `0`.

- [ ] **Step 1: Write the failing test**

Create `test/physics.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULTS, mergeConfig, buildGrid } = require('../script.js');

test('DEFAULTS has all documented keys', () => {
  for (const key of [
    'chars','spacing','fontSize','fontFamily','color','background',
    'gravity','stiffness','damping','restitution','pushRadius',
    'pushStrength','velocityInfluence','maxParticles',
  ]) {
    assert.ok(key in DEFAULTS, `missing ${key}`);
  }
});

test('mergeConfig overlays partial onto defaults', () => {
  const c = mergeConfig({ gravity: 5, spacing: 40 });
  assert.equal(c.gravity, 5);
  assert.equal(c.spacing, 40);
  assert.equal(c.damping, DEFAULTS.damping);
});

test('mergeConfig handles undefined', () => {
  assert.deepEqual(mergeConfig(), DEFAULTS);
});

test('buildGrid places particles within bounds and respects spacing', () => {
  const config = mergeConfig({ spacing: 50, maxParticles: 1000 });
  const particles = buildGrid(200, 100, config);
  assert.ok(particles.length > 0);
  for (const p of particles) {
    assert.ok(p.home.x >= 0 && p.home.x <= 200, `x in bounds: ${p.home.x}`);
    assert.ok(p.home.y >= 0 && p.home.y <= 100, `y in bounds: ${p.home.y}`);
    assert.deepEqual(p.pos, p.home);
    assert.deepEqual(p.vel, { x: 0, y: 0 });
    assert.equal(p.activity, 0);
    assert.ok(config.chars.includes(p.char));
  }
  // 200/50 = 4 cols, 100/50 = 2 rows => 8 particles
  assert.equal(particles.length, 8);
});

test('buildGrid caps at maxParticles', () => {
  const config = mergeConfig({ spacing: 10, maxParticles: 12 });
  const particles = buildGrid(1000, 1000, config);
  assert.equal(particles.length, 12);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module '../script.js'` or `mergeConfig is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `script.js` (start of file — the runtime layer is added in later tasks):

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;            // Node: expose pure helpers + init
  }
  if (typeof window !== 'undefined') {
    window.BinaryParticles = api;    // Browser: global
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

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
    // copy array so callers can't mutate DEFAULTS.chars
    cfg.chars = (partial && partial.chars) ? partial.chars.slice() : DEFAULTS.chars.slice();
    return cfg;
  }

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

  return { DEFAULTS, mergeConfig, buildGrid };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add script.js test/physics.test.js
git commit -m "feat: add config + buildGrid physics helpers (#1)"
```

---

### Task 2: Physics step — spring, gravity/activity, damping, integration

**Files:**
- Modify: `script.js` (add `step` to the factory return; keep existing helpers)
- Test: `test/physics.test.js` (add cases)

**Interfaces:**
- Consumes: `mergeConfig`, `buildGrid` from Task 1.
- Produces:
  - `step(particles, dt, input, config)` — mutates each particle in place for one
    time slice. `dt` is seconds (caller clamps). `input` is
    `{ x, y, vx, vy, active }` (cursor position, velocity px/s, and whether the
    cursor is over the element). `input` may be `null` (no cursor). Order per
    particle: apply mouse push (Task 3) → spring-to-home accel → gravity×activity
    accel → `vel += accel*dt` → damping → `pos += vel*dt` → wall collision (Task 4)
    → decay `activity`. Returns nothing.
  - Activity: any push sets `activity = 1`. Each step, after integration,
    `activity` is recomputed as `max(activityDecayed, disturbance)` where
    `disturbance = clamp(distToHome / pushRadius + speed / 400, 0, 1)` and
    `activityDecayed = activity * 0.94`. This keeps gravity on while displaced/fast
    and turns it off (→0) once settled at home.

This task implements spring + gravity + damping + integration + activity decay.
Mouse push is Task 3; wall collision is Task 4. Write the push/collision hooks as
no-ops now so signatures are stable.

- [ ] **Step 1: Write the failing test**

Add to `test/physics.test.js`:

```js
const { step } = require('../script.js');

function len(v) { return Math.hypot(v.x, v.y); }

test('displaced particle springs back toward home over time', () => {
  const config = mergeConfig({ gravity: 0 }); // isolate spring from gravity
  const p = {
    home: { x: 100, y: 100 },
    pos: { x: 160, y: 100 },
    vel: { x: 0, y: 0 },
    char: '0',
    activity: 1,
  };
  const startDist = Math.abs(p.pos.x - p.home.x);
  for (let i = 0; i < 200; i++) step([p], 1 / 60, null, config);
  const endDist = Math.abs(p.pos.x - p.home.x);
  assert.ok(endDist < startDist * 0.2, `expected settle: ${startDist} -> ${endDist}`);
});

test('gravity pulls an active particle downward', () => {
  const config = mergeConfig({ stiffness: 0, damping: 1 }); // isolate gravity
  const p = {
    home: { x: 100, y: 100 },
    pos: { x: 100, y: 100 },
    vel: { x: 0, y: 0 },
    char: '0',
    activity: 1,
  };
  step([p], 1 / 60, null, config);
  assert.ok(p.vel.y > 0, `vy should be positive, got ${p.vel.y}`);
});

test('a resting particle at home stays put (activity decays to ~0)', () => {
  const config = mergeConfig();
  const p = {
    home: { x: 100, y: 100 },
    pos: { x: 100, y: 100 },
    vel: { x: 0, y: 0 },
    char: '0',
    activity: 0,
  };
  for (let i = 0; i < 120; i++) step([p], 1 / 60, null, config);
  assert.ok(Math.abs(p.pos.x - 100) < 0.5, `x drift ${p.pos.x}`);
  assert.ok(Math.abs(p.pos.y - 100) < 0.5, `y drift ${p.pos.y}`);
  assert.ok(p.activity < 0.05, `activity ${p.activity}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `step is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `script.js`, inside the factory (before `return`), add helpers and `step`.
Add `applyPush` and `collide` as stubs to be filled in Tasks 3 and 4:

```js
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Filled in Task 3.
  function applyPush(p, input, config) { /* no-op until Task 3 */ }

  // Filled in Task 4. Needs bounds; bounds passed via config._bounds (Task 4).
  function collide(p, config) { /* no-op until Task 4 */ }

  function step(particles, dt, input, config) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      applyPush(p, input, config);

      let ax = (p.home.x - p.pos.x) * config.stiffness;
      let ay = (p.home.y - p.pos.y) * config.stiffness;
      ay += config.gravity * p.activity;

      p.vel.x += ax * dt;
      p.vel.y += ay * dt;

      const damp = Math.pow(config.damping, dt * 60);
      p.vel.x *= damp;
      p.vel.y *= damp;

      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;

      collide(p, config);

      const dx = p.pos.x - p.home.x;
      const dy = p.pos.y - p.home.y;
      const distToHome = Math.hypot(dx, dy);
      const speed = Math.hypot(p.vel.x, p.vel.y);
      const disturbance = clamp(distToHome / config.pushRadius + speed / 400, 0, 1);
      p.activity = Math.max(p.activity * 0.94, disturbance);
    }
  }
```

Add `step` to the return object: change
`return { DEFAULTS, mergeConfig, buildGrid };` to
`return { DEFAULTS, mergeConfig, buildGrid, step };`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Commit**

```bash
git add script.js test/physics.test.js
git commit -m "feat: add physics step with spring, gravity, activity (#1)"
```

---

### Task 3: Mouse push — proximity + velocity-biased impulse

**Files:**
- Modify: `script.js` (implement `applyPush`)
- Test: `test/physics.test.js` (add cases)

**Interfaces:**
- Consumes: `step`, `mergeConfig` from earlier tasks.
- Produces: `applyPush(p, input, config)` now imparts velocity. When `input` is
  falsy or `input.active` is false, it does nothing. For a particle within
  `config.pushRadius` of `(input.x, input.y)`: compute `falloff = 1 - dist/radius`
  (0 at edge, 1 at center; `dist===0` treated as a tiny epsilon with an arbitrary
  outward direction). Radial impulse magnitude = `config.pushStrength * falloff`.
  Direction = normalized (particle − cursor). Blend in cursor velocity:
  `impulse = radialDir * mag + {vx,vy} * config.velocityInfluence * falloff`.
  Add `impulse * dt`? No — push is applied as a velocity delta scaled to feel like
  an impulse: `p.vel.x += impulse.x * PUSH_DT; p.vel.y += impulse.y * PUSH_DT` with
  `PUSH_DT = 1/60` (a fixed impulse tick, so push strength is frame-rate stable).
  Set `p.activity = 1`.

- [ ] **Step 1: Write the failing test**

Add to `test/physics.test.js`:

```js
test('push imparts outward velocity to a nearby particle', () => {
  const config = mergeConfig();
  const p = {
    home: { x: 100, y: 100 },
    pos: { x: 120, y: 100 }, // 20px to the right of cursor
    vel: { x: 0, y: 0 },
    char: '0',
    activity: 0,
  };
  const input = { x: 100, y: 100, vx: 0, vy: 0, active: true };
  step([p], 1 / 60, input, config);
  assert.ok(p.vel.x > 0, `pushed right (+x), got ${p.vel.x}`);
  assert.ok(p.activity > 0.9, `activity set, got ${p.activity}`);
});

test('push ignores particles beyond radius', () => {
  const config = mergeConfig({ pushRadius: 50 });
  const p = {
    home: { x: 400, y: 100 },
    pos: { x: 400, y: 100 },
    vel: { x: 0, y: 0 },
    char: '0',
    activity: 0,
  };
  const input = { x: 100, y: 100, vx: 0, vy: 0, active: true };
  step([p], 1 / 60, input, config);
  // Only spring (at home => 0) acts; velocity stays ~0.
  assert.ok(Math.abs(p.vel.x) < 1e-6, `no push, got ${p.vel.x}`);
});

test('cursor velocity biases the push direction', () => {
  const config = mergeConfig({ velocityInfluence: 1 });
  const p = {
    home: { x: 100, y: 100 },
    pos: { x: 100, y: 100 }, // exactly on cursor => velocity bias dominates
    vel: { x: 0, y: 0 },
    char: '0',
    activity: 0,
  };
  const input = { x: 100, y: 100, vx: 500, vy: 0, active: true };
  step([p], 1 / 60, input, config);
  assert.ok(p.vel.x > 0, `biased along +vx, got ${p.vel.x}`);
});

test('inactive cursor imparts no push', () => {
  const config = mergeConfig();
  const p = {
    home: { x: 100, y: 100 }, pos: { x: 110, y: 100 },
    vel: { x: 0, y: 0 }, char: '0', activity: 0,
  };
  const input = { x: 100, y: 100, vx: 0, vy: 0, active: false };
  step([p], 1 / 60, input, config);
  // spring pulls back toward home (−x), never a push outward
  assert.ok(p.vel.x <= 0, `no outward push, got ${p.vel.x}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — push tests fail (velocity stays 0 with the no-op stub).

- [ ] **Step 3: Write minimal implementation**

Replace the `applyPush` stub in `script.js`:

```js
  const PUSH_DT = 1 / 60;

  function applyPush(p, input, config) {
    if (!input || !input.active) return;
    const dx = p.pos.x - input.x;
    const dy = p.pos.y - input.y;
    const dist = Math.hypot(dx, dy);
    if (dist > config.pushRadius) return;
    const falloff = 1 - dist / config.pushRadius;
    let dirX, dirY;
    if (dist < 1e-3) { dirX = 1; dirY = 0; } // arbitrary outward dir at center
    else { dirX = dx / dist; dirY = dy / dist; }
    const mag = config.pushStrength * falloff;
    const impX = dirX * mag + input.vx * config.velocityInfluence * falloff;
    const impY = dirY * mag + input.vy * config.velocityInfluence * falloff;
    p.vel.x += impX * PUSH_DT;
    p.vel.y += impY * PUSH_DT;
    p.activity = 1;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add script.js test/physics.test.js
git commit -m "feat: add velocity-biased mouse push (#1)"
```

---

### Task 4: Wall/floor collision with restitution

**Files:**
- Modify: `script.js` (implement `collide`, thread bounds through `step`)
- Test: `test/physics.test.js` (add cases)

**Interfaces:**
- Consumes: `step`, `mergeConfig`.
- Produces: `step(particles, dt, input, config, bounds)` gains an optional 5th arg
  `bounds = { width, height }`. When `bounds` is provided, after integration each
  particle is clamped to `[0,width] × [0,height]`; a component that hits a wall has
  its velocity reflected and scaled by `config.restitution`. When `bounds` is
  omitted (pure unit tests without a container), no collision occurs. `collide`
  signature becomes `collide(p, config, bounds)`.

- [ ] **Step 1: Write the failing test**

Add to `test/physics.test.js`:

```js
test('particle bounces off the floor with restitution', () => {
  const config = mergeConfig({ restitution: 0.5, stiffness: 0, gravity: 0, damping: 1 });
  const bounds = { width: 200, height: 100 };
  const p = {
    home: { x: 100, y: 90 },
    pos: { x: 100, y: 99 },
    vel: { x: 0, y: 300 }, // moving down fast, will cross floor at y=100
    char: '0', activity: 1,
  };
  step([p], 1 / 60, null, config, bounds);
  assert.ok(p.pos.y <= 100, `clamped to floor, got ${p.pos.y}`);
  assert.ok(p.vel.y < 0, `vy reflected upward, got ${p.vel.y}`);
  assert.ok(Math.abs(p.vel.y) < 300, `vy scaled by restitution, got ${p.vel.y}`);
});

test('particle bounces off the left wall', () => {
  const config = mergeConfig({ restitution: 0.5, stiffness: 0, gravity: 0, damping: 1 });
  const bounds = { width: 200, height: 100 };
  const p = {
    home: { x: 5, y: 50 }, pos: { x: 1, y: 50 },
    vel: { x: -300, y: 0 }, char: '0', activity: 1,
  };
  step([p], 1 / 60, null, config, bounds);
  assert.ok(p.pos.x >= 0, `clamped, got ${p.pos.x}`);
  assert.ok(p.vel.x > 0, `vx reflected, got ${p.vel.x}`);
});

test('no bounds arg means no collision', () => {
  const config = mergeConfig({ stiffness: 0, gravity: 0, damping: 1 });
  const p = {
    home: { x: 100, y: 100 }, pos: { x: 100, y: 100 },
    vel: { x: 0, y: 300 }, char: '0', activity: 1,
  };
  step([p], 1 / 60, null, config); // no bounds
  assert.ok(p.pos.y > 100, `moved past 'floor' freely, got ${p.pos.y}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — floor/wall tests fail (no-op `collide`).

- [ ] **Step 3: Write minimal implementation**

Replace the `collide` stub and thread `bounds` through `step`:

```js
  function collide(p, config, bounds) {
    if (!bounds) return;
    if (p.pos.x < 0) { p.pos.x = 0; p.vel.x = -p.vel.x * config.restitution; }
    else if (p.pos.x > bounds.width) { p.pos.x = bounds.width; p.vel.x = -p.vel.x * config.restitution; }
    if (p.pos.y < 0) { p.pos.y = 0; p.vel.y = -p.vel.y * config.restitution; }
    else if (p.pos.y > bounds.height) { p.pos.y = bounds.height; p.vel.y = -p.vel.y * config.restitution; }
  }
```

Change the `step` signature to
`function step(particles, dt, input, config, bounds) {` and the collide call to
`collide(p, config, bounds);`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add script.js test/physics.test.js
git commit -m "feat: add wall collision with restitution (#1)"
```

---

### Task 5: Runtime layer — canvas, input, rAF loop, ResizeObserver, `init`

**Files:**
- Modify: `script.js` (add `render`, input tracking, loop, `init`; add to return)

**Interfaces:**
- Consumes: `mergeConfig`, `buildGrid`, `step`.
- Produces:
  - `render(ctx, particles, config, dpr)` — clears to `config.background`
    (or leaves transparent when `'transparent'`), sets font/fill, draws each
    `p.char` centered at `p.pos`.
  - `init(element, options)` → instance `{ updateOptions(partial), destroy() }`.
    Creates a `<canvas>` appended to `element` (element set `position:relative` if
    static), DPR-aware sizing, builds the grid from element size, tracks pointer,
    runs a clamped-`dt` rAF loop calling `step` then `render`. `ResizeObserver`
    rebuilds the grid + resizes canvas. `prefers-reduced-motion: reduce` → one
    static render, no loop. `destroy` cancels the loop, disconnects observers, and
    removes the canvas + listeners.

This is a DOM/browser task; it is exercised via the demo (Task 6), not `node --test`
(jsdom/canvas would add a dependency, which the global constraints forbid). Keep all
physics in the already-tested pure functions so this layer stays thin.

- [ ] **Step 1: Add the runtime code**

In `script.js`, inside the factory before `return`, add:

```js
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

  function init(element, options) {
    if (!element) throw new Error('BinaryParticles.init: element is required');
    let config = mergeConfig(options);

    const reduceMotion = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    // Input tracking → cursor pos + velocity (px/s).
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
    function onLeave() { input.active = false; input.vx = 0; input.vy = 0; lastT = 0; }

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
      render(ctx, particles, config, dpr); // static field
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
```

Update the return to include the new members:
`return { DEFAULTS, mergeConfig, buildGrid, step, render, init };`

- [ ] **Step 2: Verify pure tests still pass**

Run: `node --test`
Expected: PASS (adding runtime code must not break the pure helpers; `init`/`render`
are not imported by the tests).

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: add canvas runtime, input, loop, and init API (#1)"
```

---

### Task 6: Demo page + styles

**Files:**
- Modify: `index.html`
- Modify: `style.scss`
- Modify: `style.css`
- Delete: `style.css.map` (stale source map for removed rules)

**Interfaces:**
- Consumes: `window.BinaryParticles.init` from Task 5.

- [ ] **Step 1: Rewrite `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="style.css">
    <title>OnCursorStar — Binary Particle Physics</title>
</head>
<body>
    <main>
        <h1>Binary Particle Physics</h1>
        <p>Move your cursor across the field below.</p>
        <div class="cursorInfoAnimate" id="field"></div>
    </main>
    <script src="script.js"></script>
    <script>
      BinaryParticles.init(document.getElementById('field'), {
        background: '#ccc',
        color: '#111',
      });
    </script>
</body>
</html>
```

- [ ] **Step 2: Rewrite `style.scss`** (source; remove old `.number` rules)

```scss
body {
  user-select: none;
  margin: 0;
  font-family: system-ui, sans-serif;
}

main {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}

.cursorInfoAnimate {
  width: 100%;
  height: 500px;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
}
```

- [ ] **Step 3: Write `style.css`** (compiled equivalent — no SCSS toolchain needed)

```css
body {
  user-select: none;
  margin: 0;
  font-family: system-ui, sans-serif;
}

main {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}

.cursorInfoAnimate {
  width: 100%;
  height: 500px;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
}
```

- [ ] **Step 4: Delete stale source map**

```bash
git rm style.css.map
```

- [ ] **Step 5: Commit**

```bash
git add index.html style.scss style.css
git commit -m "feat: rebuild demo page and styles for particle field (#1)"
```

---

### Task 7: README documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite `README.md`**

````markdown
# Binary Particle Physics

A dependency-free plugin that fills an element with a field of `0`s and `1`s
rendered on a `<canvas>`. Moving the cursor shoves nearby glyphs away; they fall
and bounce under gravity, then spring back to their home positions.

## Usage

```html
<div id="field" style="width:100%;height:500px;position:relative"></div>
<script src="script.js"></script>
<script>
  const instance = BinaryParticles.init(document.getElementById('field'), {
    gravity: 1400,
    spacing: 28,
  });
  // instance.updateOptions({ gravity: 800 });
  // instance.destroy();
</script>
```

## Options

| Option              | Default     | Meaning                                   |
| ------------------- | ----------- | ----------------------------------------- |
| `chars`             | `['0','1']` | Glyphs used for particles.                |
| `spacing`           | `28`        | Grid cell size in px (density).           |
| `fontSize`          | `20`        | Glyph font size in px.                     |
| `fontFamily`        | `monospace` | Glyph font family.                        |
| `color`             | `'#111'`    | Glyph color.                              |
| `background`        | `'#ccc'`    | Canvas background (`'transparent'` ok).   |
| `gravity`           | `1400`      | Downward accel (px/s²) when active.       |
| `stiffness`         | `120`       | Spring constant pulling particles home.   |
| `damping`           | `0.86`      | Velocity retention per frame-second.      |
| `restitution`       | `0.5`       | Bounce energy retained on collision.      |
| `pushRadius`        | `90`        | Cursor influence radius in px.            |
| `pushStrength`      | `2600`      | Base radial impulse strength.             |
| `velocityInfluence` | `0.7`       | How much cursor velocity biases the push. |
| `maxParticles`      | `4000`      | Safety cap on particle count.             |

## API

- `BinaryParticles.init(element, options)` → `{ updateOptions(partial), destroy() }`
- `updateOptions(partial)` — merge new options; rebuilds grid if `spacing`,
  `chars`, or `maxParticles` change.
- `destroy()` — stop the loop and remove the canvas + listeners.

## Accessibility & responsiveness

- DPR-aware canvas for crisp text on high-density displays.
- Rebuilds on element resize via `ResizeObserver`.
- Mouse, pen, and touch via Pointer Events.
- Respects `prefers-reduced-motion: reduce` (renders a static field).

## Tests

```bash
node --test
```

No external dependencies.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document plugin usage, options, and API (#1)"
```

---

### Task 8: Manual verification + final check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `node --test`
Expected: PASS, all tests across Tasks 1–4.

- [ ] **Step 2: Smoke-test the demo in a browser**

Open `index.html` (e.g. `python3 -m http.server` then browse to it, or open the
file directly). Verify: the field of 0/1 renders; moving the cursor shoves glyphs
outward in the drag direction; they fall/bounce and spring back; no console errors;
resizing the window reflows the field.

- [ ] **Step 3: Confirm reduced-motion**

In devtools, emulate `prefers-reduced-motion: reduce`, reload, confirm a static
field renders with no animation.

- [ ] **Step 4: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "chore: final verification tweaks for particle physics (#1)"
```

---

## Self-Review Notes

- **Spec coverage:** field-pushed concept (Task 1 grid, Task 3 push), Canvas 2D
  (Task 5), spring-back-to-home (Task 2), gravity/bounce (Tasks 2/4),
  direction+strength response (Task 3 velocity bias), performance/pure step
  (Tasks 1–4), plugin `init` API + options (Task 5), responsiveness + touch +
  reduced-motion (Task 5), README/integration docs (Task 7). All spec sections map
  to a task.
- **Placeholders:** none — every code step shows full code; `applyPush`/`collide`
  are intentionally staged no-ops with explicit later tasks that replace them.
- **Type consistency:** `step(particles, dt, input, config, bounds)`,
  `input = {x,y,vx,vy,active}`, `Particle = {home,pos,vel,char,activity}`,
  `bounds = {width,height}`, and the `init` return `{updateOptions,destroy}` are
  used consistently across tasks.
