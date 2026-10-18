import test from 'node:test';
import assert from 'node:assert/strict';
import { MelonWorld, FRUITS, HEIGHT, LIMIT, SPRITE_SCALE, avatarBounds } from '../assets/melon-engine.mjs';
import Matter from '../assets/vendor/matter.mjs';

function advance(world, seconds) {
  for (let n = 0; n < seconds * 120; n++) world.step(1 / 120);
}

test('touching matching silhouettes merge once and chain with correct points', () => {
  const world = new MelonWorld();
  world.engine.gravity.y = 0;
  const a = world.add(0, 210, 300), b = world.add(0, 212, 300);
  a.merged = b.merged = -1;
  world.step(1 / 120);
  assert.equal(world.bodies.length, 1);
  assert.equal(world.bodies[0].level, 1);
  assert.equal(world.score, FRUITS[1].points);
  const first = world.bodies[0];
  const second = world.add(1, first.x + 2, first.y);
  first.merged = second.merged = -1;
  world.step(1 / 120);
  assert.equal(world.bodies.length, 1);
  assert.equal(world.bodies[0].level, 2);
  assert.equal(world.score, FRUITS[1].points + FRUITS[2].points);
  world.destroy();
});

test('overlapping old circles do not collide or merge across transparent padding', () => {
  const world = new MelonWorld();
  world.engine.gravity.y = 0;
  const a = world.add(0, 200, 300), b = world.add(0, 227, 300);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r);
  advance(world, 1);
  assert.equal(world.bodies.length, 2);
  assert.equal(world.score, 0);
  assert.ok(world.boundsFor(a).max.x < world.boundsFor(b).min.x);
  world.destroy();
});

test('empty concave space between hair remains empty instead of using one convex hull', () => {
  const world = new MelonWorld();
  const b = world.add(3, 210, 300);
  const point = { x: b.x, y: b.y + b.r * SPRITE_SCALE * .25 };
  assert.ok(Matter.Vertices.contains(b.rigid.vertices, point));
  assert.equal(Matter.Query.point([b.rigid], point).length, 0);
  world.destroy();
});

test('render origin and collision silhouette stay aligned through rotation for every avatar', () => {
  const world = new MelonWorld();
  for (let level = 0; level < 5; level++) {
    const b = world.add(level, 210, 300);
    for (const angle of [-1.1, .6, 2.1]) {
      Matter.Body.setAngle(b.rigid, angle);
      world.sync(b);
      const expected = avatarBounds(level, angle), actual = world.boundsFor(b);
      assert.ok(Math.abs(actual.min.x - b.x - expected.minX) < .00001);
      assert.ok(Math.abs(actual.min.y - b.y - expected.minY) < .00001);
      assert.ok(Math.abs(actual.max.x - b.x - expected.maxX) < .00001);
      assert.ok(Math.abs(actual.max.y - b.y - expected.maxY) < .00001);
    }
  }
  world.destroy();
});

test('different silhouettes settle, remain finite, and respect the real floor', () => {
  const world = new MelonWorld();
  world.add(3, 210, 400); world.add(4, 210, 300);
  advance(world, 10);
  assert.equal(world.bodies.length, 2);
  for (const b of world.bodies) {
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.angle));
    assert.ok(world.boundsFor(b).max.y <= HEIGHT - 11);
    assert.ok(world.boundsFor(b).min.x >= 7.5);
    assert.ok(world.boundsFor(b).max.x <= 412.5);
    assert.ok(Math.abs(b.vy) < 15);
  }
  assert.equal(world.over, false);
  world.destroy();
});

test('drops respect silhouette wall bounds, cooldown and game over', () => {
  const world = new MelonWorld();
  assert.equal(world.drop(4, -500), true);
  assert.ok(world.boundsFor(world.bodies[0]).min.x >= 7.999);
  assert.equal(world.drop(0, 200), false);
  advance(world, .7);
  assert.equal(world.drop(0, 200), true);
  world.over = true;
  assert.equal(world.drop(0, 200), false);
  world.destroy();
});

test('largest avatars stay separate; overflow is based on visible outline, not radius', () => {
  const world = new MelonWorld();
  world.engine.gravity.y = 0;
  const a = world.add(10, 200, 300), b = world.add(10, 220, 300);
  a.merged = b.merged = -1;
  advance(world, .5);
  assert.equal(world.bodies.length, 2);
  assert.equal(world.score, 0);
  world.destroy();
  const safe = new MelonWorld();
  safe.engine.gravity.y = 0;
  const c = safe.add(0, 210, 112);
  assert.ok(c.y - c.r < LIMIT);
  assert.ok(safe.boundsFor(c).min.y > LIMIT);
  advance(safe, 4);
  assert.equal(safe.over, false);
  safe.destroy();
  const full = new MelonWorld();
  full.engine.gravity.y = 0;
  const d = full.add(0, 210, 104);
  assert.ok(full.boundsFor(d).min.y < LIMIT);
  advance(full, 4);
  assert.equal(full.over, true);
  full.destroy();
});

test('a falling avatar crossing the limit does not immediately end a game', () => {
  const world = new MelonWorld();
  world.drop(0, 200);
  advance(world, 4);
  assert.equal(world.over, false);
  assert.equal(world.danger, 0);
  world.destroy();
});
