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

| Option              | Default     | Meaning                                     |
| ------------------- | ----------- | ------------------------------------------- |
| `chars`             | `['0','1']` | Glyphs used for particles.                  |
| `spacing`           | `28`        | Grid cell size in px (density).             |
| `fontSize`          | `20`        | Glyph font size in px.                       |
| `fontFamily`        | `monospace` | Glyph font family.                          |
| `color`             | `'#111'`    | Glyph color.                                |
| `background`        | `'#ccc'`    | Canvas background (`'transparent'` ok).     |
| `gravity`           | `1400`      | Downward accel (px/s²) while active.        |
| `stiffness`         | `120`       | Spring constant pulling particles home.     |
| `damping`           | `0.86`      | Velocity retention per frame-second.        |
| `restitution`       | `0.5`       | Bounce energy retained on collision.        |
| `pushRadius`        | `90`        | Cursor influence radius in px.              |
| `pushStrength`      | `2600`      | Cursor repulsion acceleration (px/s²).      |
| `velocityInfluence` | `0.7`       | How much cursor velocity biases the push.   |
| `maxParticles`      | `4000`      | Safety cap on particle count.               |

## API

- `BinaryParticles.init(element, options)` → `{ updateOptions(partial), destroy() }`
- `updateOptions(partial)` — merge new options; rebuilds the grid if `spacing`,
  `chars`, or `maxParticles` change.
- `destroy()` — stop the loop and remove the canvas + listeners.

## How it works

Each particle remembers its home grid spot. A spring constantly pulls it home.
Gravity is gated by an `activity` value that a cursor push raises to 1 and that
decays as the particle nears home and slows — so a disturbed glyph falls and
bounces, while a settled one rests exactly on its home spot. The cursor applies a
continuous repulsion force blending a radial push with the cursor's own velocity,
so the direction and strength of your movement shape how the glyphs scatter.

The physics core (`buildGrid`, `step`) is a set of pure functions with no DOM or
canvas access, which is what the tests exercise.

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
