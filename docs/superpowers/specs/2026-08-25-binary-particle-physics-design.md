# Natural Binary Particle Physics Animation — Design

**Date:** 2026-08-25
**Issue:** #1 — Natural Binary Particle Physics Animation
**Status:** Approved

## Summary

Rebuild the current DOM-based cursor effect into a natural binary-particle
physics animation, inspired by shouts.ch. A target element is filled with a grid
of static `0`s and `1`s rendered on a single `<canvas>`. Moving the cursor near
them shoves them away; each disturbed glyph falls and bounces under gravity, then
eases back to its home grid position so the field restores itself.

The result is packaged as a dependency-free, reusable plugin exposing
`BinaryParticles.init(element, options)`. `index.html` remains a live demo.

## Goals (from issue user stories)

- Particles react naturally to mouse movement; smooth and realistic.
- Response depends on direction and strength of the cursor movement.
- Particles bounce and fall under gravity after being pushed.
- Particles eventually settle (here: spring back to their home grid position).
- Optimized for smooth real-time rendering with many particles.
- Reusable plugin with simple integration and configurable options.
- Works across screen sizes and input environments (mouse + touch).

## Non-goals (YAGNI)

- No WebGL renderer (Canvas 2D is sufficient for the target particle counts).
- No data-attribute auto-init (programmatic `init()` only).
- No particle piling/stacking or respawn model (springs back to home instead).
- No build toolchain beyond the existing optional SCSS→CSS for the demo.

## Rendering

Canvas 2D. All glyphs are drawn to one `<canvas>` sized to the target element,
with `devicePixelRatio` scaling for crisp text. No per-particle DOM nodes, so the
effect scales to thousands of particles at 60fps.

## Physics model

Each particle holds:

- `home {x, y}` — its resting grid position.
- `pos {x, y}` — current position.
- `vel {x, y}` — current velocity.
- `char` — fixed `'0'` or `'1'`.
- `activity` — 0…1 scalar gating gravity (see below).

Per frame (`dt` in seconds, clamped):

1. **Spring to home:** `accel += (home - pos) * stiffness`.
2. **Gravity × activity:** `accel += (0, gravity) * activity`.
   - A push sets `activity = 1`.
   - `activity` decays toward 0 as the particle nears home *and* slows.
   - Consequence: a resting particle sits exactly on its home spot with gravity
     effectively off; a disturbed particle falls and bounces realistically.
3. **Damping:** `vel *= damping` (per-second, scaled by `dt`).
4. **Integrate:** `vel += accel * dt`; `pos += vel * dt`.
5. **Collision:** bounce off container floor/walls with `restitution` while active
   (velocity component reflected and scaled).

### Mouse push

Particles within `pushRadius` of the cursor receive an impulse directed away from
the cursor, scaled by:

- **Proximity:** closer → stronger (falls off to 0 at the radius edge).
- **Cursor speed and direction:** impulse blends a radial push with the cursor's
  velocity, scaled by `velocityInfluence`. A fast horizontal sweep throws glyphs
  sideways; a slow nudge barely moves them.

Any pushed particle has `activity` set to 1.

## Architecture

One file (`script.js`), organized into small single-purpose units:

- `config` — default options + merge/validate.
- `buildGrid(width, height, spacing, chars)` — creates particles at home
  positions across the element; caps at `maxParticles`.
- `step(particles, dt, input, config)` — **pure function**, no DOM/canvas access.
  This is the physics core and the primary unit under test.
- `render(ctx, particles, config)` — draws glyphs to the canvas.
- `input` — `pointermove`/`pointerleave` tracking → cursor position and velocity
  (velocity derived from position delta over time). Touch via Pointer Events.
- `loop` — `requestAnimationFrame` driver with clamped `dt`. Honors
  `prefers-reduced-motion` by rendering a static field (no animation loop).

### Instance API

```js
const instance = BinaryParticles.init(element, options);
instance.updateOptions(partialOptions); // merge + apply live
instance.destroy();                      // stop loop, remove canvas + listeners
```

- `init` builds the canvas, grid, input, and loop; returns the instance.
- `ResizeObserver` on the element rebuilds the grid and resizes the canvas
  (DPR-aware) on layout changes, for responsiveness.

### Node interop for testing

`script.js` exposes `BinaryParticles` as a browser global and, when
`module.exports` exists (Node), also exports the pure helpers (`step`,
`buildGrid`, `config` defaults) so they can be unit-tested without a DOM.

## Configuration options

| Option              | Default        | Meaning                                          |
| ------------------- | -------------- | ------------------------------------------------ |
| `chars`             | `['0','1']`    | Glyphs used for particles.                       |
| `spacing`           | `28`           | Grid cell size in px (controls density).         |
| `fontSize`          | `20`           | Glyph font size in px.                            |
| `fontFamily`        | `monospace`    | Glyph font family.                               |
| `color`             | `'#111'`       | Glyph color.                                     |
| `background`        | `'#ccc'`       | Canvas background (or `'transparent'`).          |
| `gravity`           | `1400`         | Downward acceleration (px/s²) when active.       |
| `stiffness`         | `120`          | Spring constant pulling particles home.          |
| `damping`           | `0.86`         | Velocity retention per frame-second.             |
| `restitution`       | `0.5`          | Bounce energy retained on wall collision.        |
| `pushRadius`        | `90`           | Cursor influence radius in px.                   |
| `pushStrength`      | `2600`         | Base radial impulse strength.                    |
| `velocityInfluence` | `0.7`          | How much cursor velocity biases the push.        |
| `maxParticles`      | `4000`         | Safety cap on particle count.                    |

`updateOptions` merges partials; grid-affecting changes (`spacing`, `chars`,
`maxParticles`) trigger a rebuild.

## Files

- `script.js` — the plugin (UMD-style global + Node `module.exports`).
- `index.html` — live demo initializing the plugin on a container element.
- `style.css` — minimal; sizes the demo container. Canvas draws the effect.
- `style.scss` — updated source matching `style.css`; old `.number` styles removed.
- `test/physics.test.js` — `node --test` unit tests for `step()`/`buildGrid()`.
- `README.md` — updated usage/integration/options docs.

## Testing

`node --test` (built-in, zero dependencies) against the pure functions:

1. **Push imparts outward velocity:** a particle within `pushRadius` gains
   velocity directed away from the cursor.
2. **Return to home:** a displaced particle's distance to home decreases over
   repeated `step` calls with no input.
3. **Floor collision:** a particle moving down through the floor has its `vy`
   reflected and scaled by `restitution`.
4. **Grid build:** `buildGrid` places particles within bounds, respects
   `spacing`, and caps at `maxParticles`.

## Responsiveness & accessibility

- DPR-aware canvas for crisp text on high-density displays.
- `ResizeObserver` rebuilds on element resize.
- Pointer Events cover mouse, pen, and touch.
- `prefers-reduced-motion: reduce` → static field, no animation.
