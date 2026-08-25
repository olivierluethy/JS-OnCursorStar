const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULTS, mergeConfig, buildGrid, step,
} = require('../script.js');

// ---------------------------------------------------------------------------
// Task 1: config + buildGrid
// ---------------------------------------------------------------------------

test('DEFAULTS has all documented keys', () => {
  for (const key of [
    'chars', 'spacing', 'fontSize', 'fontFamily', 'color', 'background',
    'gravity', 'stiffness', 'damping', 'restitution', 'pushRadius',
    'pushStrength', 'velocityInfluence', 'maxParticles',
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

// ---------------------------------------------------------------------------
// Task 2: physics step — spring, gravity/activity, damping, integration
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Task 3: mouse push — proximity + velocity-biased impulse
// ---------------------------------------------------------------------------

test('push imparts outward velocity to a nearby particle', () => {
  const config = mergeConfig();
  const p = {
    // Resting at its home, 20px to the right of the cursor: isolates the push
    // from any spring force so we test the push in isolation.
    home: { x: 120, y: 100 },
    pos: { x: 120, y: 100 },
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

// ---------------------------------------------------------------------------
// Task 4: wall/floor collision with restitution
// ---------------------------------------------------------------------------

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
