import Matter from './vendor/matter.mjs';
import { AVATAR_SHAPES } from './avatar-colliders.mjs';

export const WIDTH = 420;
export const HEIGHT = 480;
export const LIMIT = 100;
export const SPRITE_SCALE = 1.92;
export const FRUITS = [
  { name: '波点·初见', avatar: 'polka-hat', radius: 15, color: '#d28b9c', points: 2 },
  { name: '短发·初见', avatar: 'bob', radius: 21, color: '#9a91c9', points: 4 },
  { name: '侧颜·初见', avatar: 'closeup', radius: 27, color: '#83a9b8', points: 8 },
  { name: '猫帽·初见', avatar: 'cat-hat', radius: 33, color: '#dc9f76', points: 16 },
  { name: '偏分·初见', avatar: 'parted-bob', radius: 40, color: '#b69ac9', points: 32 },
  { name: '短发·心动', avatar: 'bob', radius: 48, color: '#8aaf9a', points: 64 },
  { name: '侧颜·心动', avatar: 'closeup', radius: 57, color: '#d7b45f', points: 128 },
  { name: '猫帽·心动', avatar: 'cat-hat', radius: 67, color: '#a790cd', points: 256 },
  { name: '波点·闪耀', avatar: 'polka-hat', radius: 78, color: '#78a9b6', points: 512 },
  { name: '偏分·星光', avatar: 'parted-bob', radius: 90, color: '#c08aaa', points: 1024 },
  { name: '猫帽·满级', avatar: 'cat-hat', radius: 103, color: '#c5a455', points: 2048 },
];

const { Body, Bodies, Composite, Engine, Vertices } = Matter;

export function avatarBounds(level, angle = 0) {
  const scale = FRUITS[level].radius * SPRITE_SCALE;
  const c = Math.cos(angle), s = Math.sin(angle);
  const points = AVATAR_SHAPES[FRUITS[level].avatar].parts.flat();
  const xs = points.map(([x, y]) => scale * (x * c - y * s));
  const ys = points.map(([x, y]) => scale * (x * s + y * c));
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function aimRange(level) {
  const bounds = avatarBounds(level);
  return { min: 8 - bounds.minX, max: WIDTH - 8 - bounds.maxX };
}

export class MelonWorld {
  constructor() {
    this.bodies = [];
    this.score = 0;
    this.time = 0;
    this.lastDrop = -Infinity;
    this.danger = 0;
    this.over = false;
    this.merges = [];
    this.nextId = 0;
    this.engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
    this.engine.gravity.y = 1.1;
    Composite.add(this.engine.world, [
      Bodies.rectangle(-42, HEIGHT / 2, 100, HEIGHT * 4, { isStatic: true }),
      Bodies.rectangle(WIDTH + 42, HEIGHT / 2, 100, HEIGHT * 4, { isStatic: true }),
      Bodies.rectangle(WIDTH / 2, HEIGHT + 38, WIDTH + 200, 100, { isStatic: true }),
    ]);
  }

  add(level, x, y) {
    const fruit = FRUITS[level], scale = fruit.radius * SPRITE_SCALE;
    const options = { friction: .45, frictionStatic: .65, frictionAir: .012,
      restitution: .05, density: .002, slop: .03 };
    // Each convex part retains its original position within the alpha silhouette.
    // A single hull would incorrectly fill the empty space between long hair strands.
    const parts = AVATAR_SHAPES[fruit.avatar].parts.map(polygon => {
      const vertices = polygon.map(([px, py]) => ({ x: px * scale, y: py * scale }));
      return Body.create({ ...options, position: Vertices.centre(vertices), vertices });
    });
    const rigid = parts.length === 1 ? parts[0] : Body.create({ ...options, parts });
    const offset = { ...rigid.position };
    const range = aimRange(level);
    Body.translate(rigid, { x: Math.max(range.min, Math.min(range.max, x)), y });
    const body = { id: this.nextId++, level, r: fruit.radius, rigid, offset,
      born: this.time, merged: this.time, x: 0, y: 0, vx: 0, vy: 0, angle: 0 };
    rigid.plugin.avatar = body;
    Composite.add(this.engine.world, rigid);
    this.bodies.push(body);
    this.sync(body);
    return body;
  }

  sync(body) {
    const { rigid, offset } = body;
    const c = Math.cos(rigid.angle), s = Math.sin(rigid.angle);
    body.x = rigid.position.x - (offset.x * c - offset.y * s);
    body.y = rigid.position.y - (offset.x * s + offset.y * c);
    body.angle = rigid.angle;
    body.vx = rigid.velocity.x * 60;
    body.vy = rigid.velocity.y * 60;
  }

  boundsFor(body) {
    // Matter's broad-phase bounds include a velocity margin. Gameplay limits use
    // the actual transformed silhouette instead, so empty swept space is ignored.
    const xs = body.rigid.vertices.map(vertex => vertex.x);
    const ys = body.rigid.vertices.map(vertex => vertex.y);
    return { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
  }

  drop(level, x) {
    if (this.over || this.time - this.lastDrop < .65) return false;
    this.add(level, x, 44);
    this.lastDrop = this.time;
    return true;
  }

  step(dt) {
    if (this.over || dt <= 0) return;
    this.time += dt;
    this.merges = [];
    Engine.update(this.engine, dt * 1000);
    for (const body of this.bodies) this.sync(body);
    const consumed = new Set();
    const newborn = [];
    for (const pair of this.engine.pairs.list) {
      if (!pair.isActive) continue;
      const a = pair.bodyA.parent.plugin.avatar;
      const b = pair.bodyB.parent.plugin.avatar;
      if (!a || !b || a === b || consumed.has(a.id) || consumed.has(b.id)) continue;
      if (a.level !== b.level || a.level === FRUITS.length - 1 ||
          this.time - a.merged <= .15 || this.time - b.merged <= .15) continue;
      consumed.add(a.id); consumed.add(b.id);
      newborn.push({ level: a.level + 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
        vx: (a.vx + b.vx) / 2, vy: Math.min(0, (a.vy + b.vy) / 2) - 65,
        born: Math.min(a.born, b.born) });
    }
    if (consumed.size) {
      for (const body of this.bodies) if (consumed.has(body.id)) Composite.remove(this.engine.world, body.rigid);
      this.bodies = this.bodies.filter(body => !consumed.has(body.id));
      for (const data of newborn) {
        const body = this.add(data.level, data.x, data.y);
        body.born = data.born;
        Body.setVelocity(body.rigid, { x: data.vx / 60, y: data.vy / 60 });
        this.sync(body);
        this.score += FRUITS[body.level].points;
        this.merges.push({ x: body.x, y: body.y, level: body.level });
      }
    }
    const overflowing = this.bodies.some(body => this.time - body.born > 1.5 && this.boundsFor(body).min.y < LIMIT);
    this.danger = overflowing ? this.danger + dt : Math.max(0, this.danger - dt * 2);
    if (this.danger >= 2) this.over = true;
  }

  destroy() {
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.bodies = [];
  }
}
