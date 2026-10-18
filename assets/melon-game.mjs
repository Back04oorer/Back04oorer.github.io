import { MelonWorld, FRUITS, WIDTH, HEIGHT, LIMIT, SPRITE_SCALE, aimRange, avatarBounds } from './melon-engine.mjs';

export function mountMelonGame(root) {
  const host = root.querySelector('[data-melon-game]');
  if (!host) return () => {};
  const canvas = host.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const overlay = host.querySelector('[data-overlay]');
  const overlayTitle = host.querySelector('[data-overlay-title]');
  const overlayCopy = host.querySelector('[data-overlay-copy]');
  const playButton = host.querySelector('[data-play]');
  const announcement = host.querySelector('[data-announcement]');
  const abort = new AbortController();
  const listen = (target, type, fn) => target.addEventListener(type, fn, { signal: abort.signal });
  let world, current, next, aim = WIDTH / 2, playing = false, paused = false;
  let particles = [], best = 0, frame, lastTime = 0, accumulator = 0, disposed = false;
  let pointer = null, celebrated = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { best = Number(localStorage.getItem('mba-avatar-best')) || 0; } catch {}

  function randomFruit() {
    const pick = Math.random();
    return pick < .3 ? 0 : pick < .58 ? 1 : pick < .8 ? 2 : pick < .94 ? 3 : 4;
  }

  const avatars = new Map();
  let assetsReady = false;
  let loading = false;

  function fruit(context, level, x, y, radius, angle = 0, alpha = 1) {
    const f = FRUITS[level];
    const sprite = avatars.get(f.avatar);
    context.save(); context.globalAlpha = alpha;
    context.translate(x, y); context.rotate(angle);
    if (sprite?.complete && sprite.naturalWidth) {
      const size = radius * SPRITE_SCALE;
      context.shadowColor = '#4c335320'; context.shadowBlur = radius * .08;
      context.shadowOffsetY = 1.5;
      context.drawImage(sprite, -size / 2, -size / 2, size, size);
      context.shadowColor = 'transparent';
    }
    context.restore();
  }

  function reset() {
    world?.destroy();
    world = new MelonWorld(); current = randomFruit(); next = randomFruit();
    particles = []; aim = WIDTH / 2; accumulator = 0; celebrated = false;
    host.querySelector('[data-game-note]').textContent = '最高分保存在这台设备上。刷新后，本局游戏会重新开始。';
  }

  function showOverlay(title, copy, button) {
    overlayTitle.textContent = title; overlayCopy.textContent = copy;
    playButton.textContent = button; overlay.hidden = false;
  }

  function start() {
    if (!assetsReady) return;
    if (!playing || world.over) reset();
    playing = true; paused = false; overlay.hidden = true;
    lastTime = 0; accumulator = 0;
    canvas.focus({ preventScroll: true });
  }

  function pause() {
    if (!playing || world.over || paused) return;
    paused = true; pointer = null;
    showOverlay('休息一下', '头像们在这里等你，准备好了就继续。', '继续游戏');
  }

  function drop() {
    if (!playing || paused || world.over) return;
    if (world.drop(current, aim)) {
      current = next; next = randomFruit();
    }
  }

  function position(event) {
    const rect = canvas.getBoundingClientRect();
    const range = aimRange(current);
    aim = Math.max(range.min, Math.min(range.max, (event.clientX - rect.left) * WIDTH / rect.width));
  }

  listen(canvas, 'pointerdown', event => {
    if (!playing || paused || world.over || !event.isPrimary || event.button !== 0) return;
    pointer = event.pointerId; canvas.setPointerCapture(pointer); position(event);
    canvas.focus({ preventScroll: true });
  });
  listen(canvas, 'pointermove', event => { if (pointer === event.pointerId || event.pointerType === 'mouse') position(event); });
  listen(canvas, 'pointerup', event => {
    if (pointer !== event.pointerId) return;
    position(event); pointer = null; drop();
  });
  listen(canvas, 'pointercancel', () => { pointer = null; });
  listen(canvas, 'lostpointercapture', () => { pointer = null; });
  listen(canvas, 'keydown', event => {
    if (['ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape'].includes(event.key)) event.preventDefault();
    if (event.key === 'Escape') { pause(); return; }
    if (!playing || paused || world.over) return;
    const range = aimRange(current);
    if (event.key === 'ArrowLeft') aim = Math.max(range.min, aim - 18);
    if (event.key === 'ArrowRight') aim = Math.min(range.max, aim + 18);
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) drop();
  });
  listen(playButton, 'click', start);
  listen(document, 'visibilitychange', () => { if (document.hidden) pause(); });
  listen(window, 'blur', pause);

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr; canvas.height = HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const observer = new ResizeObserver(resize); observer.observe(canvas);

  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#faf7fc'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#d8cde780';
    for (let x = 20; x < WIDTH; x += 24) for (let y = 20; y < HEIGHT; y += 24) {
      ctx.beginPath(); ctx.arc(x, y, .8, 0, Math.PI * 2); ctx.fill();
    }
    const danger = world.danger > .05;
    ctx.strokeStyle = danger ? '#c66b53' : '#c5bca3'; ctx.lineWidth = 1; ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(12, LIMIT); ctx.lineTo(WIDTH - 12, LIMIT); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = danger ? '#b95b45' : '#99917c'; ctx.font = '10px system-ui';
    ctx.fillText(danger ? '快满啦 · 试着合成腾出空间' : '别让头像超过这条线', 18, LIMIT - 10);
    ctx.fillStyle = '#ddd4e7'; ctx.fillRect(0, HEIGHT - 12, WIDTH, 12);
    ctx.fillRect(0, 0, 8, HEIGHT); ctx.fillRect(WIDTH - 8, 0, 8, HEIGHT);
    for (const b of world.bodies) fruit(ctx, b.level, b.x, b.y, b.r, b.angle);
    if (playing && !world.over) {
      const ready = world.time - world.lastDrop >= .65;
      const r = FRUITS[current].radius;
      const range = aimRange(current);
      const x = Math.max(range.min, Math.min(range.max, aim));
      ctx.strokeStyle = '#927aab50'; ctx.setLineDash([3, 7]);
      ctx.beginPath(); ctx.moveTo(x, 44 + avatarBounds(current).maxY + 7); ctx.lineTo(x, HEIGHT - 15); ctx.stroke(); ctx.setLineDash([]);
      fruit(ctx, current, x, 44, r, 0, ready ? .95 : .3);
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / .65);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function tick(timestamp) {
    if (disposed) return;
    const elapsed = lastTime ? Math.min((timestamp - lastTime) / 1000, .05) : 0;
    lastTime = timestamp;
    if (playing && !paused && !world.over) {
      accumulator += elapsed;
      while (accumulator >= 1 / 120 && !world.over) {
        world.step(1 / 120); accumulator -= 1 / 120;
        for (const merge of world.merges) {
          if (!reducedMotion) for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({ x: merge.x, y: merge.y, vx: Math.cos(angle) * 110,
              vy: Math.sin(angle) * 110, radius: 2 + Math.random() * 3, color: FRUITS[merge.level].color, life: .65 });
          }
          announcement.textContent = `合成了${FRUITS[merge.level].name}！得分 ${world.score}`;
          if (merge.level === FRUITS.length - 1 && !celebrated) {
            celebrated = true; announcement.textContent = '恭喜！合成满级猫帽头像了！继续挑战更高分吧。';
            host.querySelector('[data-game-note]').textContent = '太棒了，合成满级头像啦！继续挑战更高分吧。';
          }
        }
      }
      if (world.score > best) {
        best = world.score;
        try { localStorage.setItem('mba-avatar-best', String(best)); } catch {}
      }
      for (const p of particles) { p.life -= elapsed; p.x += p.vx * elapsed; p.y += p.vy * elapsed; }
      particles = particles.filter(p => p.life > 0);
      if (world.over) {
        showOverlay('这一局，合照满员啦', `这次得到了 ${world.score} 分。再来一局，向满级头像出发。`, '再来一局');
        announcement.textContent = `游戏结束，得分 ${world.score}`;
        playButton.focus({ preventScroll: true });
      }
    }
    draw(); frame = requestAnimationFrame(tick);
  }
  async function loadAvatars() {
    if (loading || disposed) return;
    loading = true; playButton.disabled = true;
    showOverlay('头像准备中…', '正在载入照片头像，马上就好。', '载入中…');
    try {
      await Promise.all([...new Set(FRUITS.map(f => f.avatar))].map(async name => {
        const image = new Image();
        image.src = new URL(`./avatars/photo/${name}.webp`, import.meta.url).href;
        await image.decode();
        avatars.set(name, image);
      }));
      if (disposed) return;
      assetsReady = true;
      showOverlay('今天，合成一个新表情。', '相同头像、相同等级，碰在一起就升级。向 Lv.11 出发吧。', '开始合成');
    } catch {
      if (disposed) return;
      showOverlay('头像还没准备好', '图片加载失败，点击重试就能重新加载。', '重新加载');
    } finally {
      loading = false;
      if (!disposed) playButton.disabled = false;
    }
  }
  listen(playButton, 'click', () => { if (!assetsReady) loadAvatars(); });
  reset();
  loadAvatars();
  frame = requestAnimationFrame(tick);
  return () => { disposed = true; cancelAnimationFrame(frame); abort.abort(); observer.disconnect(); particles = []; world.destroy(); };
}
