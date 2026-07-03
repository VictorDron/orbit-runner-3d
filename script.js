window.__orbitErrors = [];
window.addEventListener('error', event => {
  window.__orbitErrors.push({ message: event.message, source: event.filename, line: event.lineno, column: event.colno });
});
window.addEventListener('unhandledrejection', event => {
  window.__orbitErrors.push({ message: String(event.reason && event.reason.message || event.reason || 'unhandled rejection') });
});

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const shieldBar = document.getElementById('shieldBar');
const speedEl = document.getElementById('speed');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');

const keys = new Set();
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let W = 1280, H = 720, cx = 640, cy = 360, scale = 1;
let running = false, paused = false, last = 0, spawnTimer = 0, energyTimer = 0;
let score = 0, speed = 1, shake = 0;
let stars = [], obstacles = [], energies = [], particles = [];
const player = { x: 0, y: 0, vx: 0, vy: 0, z: 1, shield: 100, boost: 0 };

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  W = rect.width; H = rect.height; cx = W / 2; cy = H / 2; scale = Math.min(W / 1280, H / 720);
  stars = Array.from({ length: Math.floor(W * H / 5200) }, () => ({ x: rnd(-1, 1), y: rnd(-0.62, 0.62), z: rnd(0.05, 1), r: rnd(0.4, 1.8) }));
}

function project(x, y, z) {
  const f = 520 * scale / z;
  return { x: cx + x * f, y: cy + y * f, s: f };
}

function reset() {
  running = true; paused = false; last = performance.now(); score = 0; speed = 1; shake = 0;
  spawnTimer = 0; energyTimer = 0; obstacles = []; energies = []; particles = [];
  Object.assign(player, { x: 0, y: 0, vx: 0, vy: 0, z: 1, shield: 100, boost: 0 });
  overlay.classList.add('hidden');
  requestAnimationFrame(loop);
}

function spawnObstacle() {
  const angle = rnd(0, Math.PI * 2);
  const radius = rnd(0.35, 1.05);
  obstacles.push({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.62,
    z: 7.5,
    size: rnd(0.045, 0.085),
    rot: rnd(0, 9),
    spin: rnd(-3, 3),
    hue: Math.random() > 0.55 ? '#f6c96f' : '#ff6d5a'
  });
}

function spawnEnergy() {
  const angle = rnd(0, Math.PI * 2);
  const radius = rnd(0.18, 0.86);
  energies.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.58, z: 7.5, size: 0.04, rot: 0 });
}

function update(dt) {
  if (!running || paused) return;
  const accel = 2.6;
  player.vx += ((keys.has('ArrowRight') || keys.has('d')) - (keys.has('ArrowLeft') || keys.has('a'))) * accel * dt;
  player.vy += ((keys.has('ArrowDown') || keys.has('s')) - (keys.has('ArrowUp') || keys.has('w'))) * accel * dt;
  player.vx *= Math.pow(0.08, dt); player.vy *= Math.pow(0.08, dt);
  player.x = clamp(player.x + player.vx * dt, -0.92, 0.92);
  player.y = clamp(player.y + player.vy * dt, -0.52, 0.52);
  player.boost = keys.has(' ') ? 1 : Math.max(0, player.boost - dt * 2.5);
  speed = clamp(speed + dt * 0.035, 1, 2.65) + player.boost * 0.48;
  score += dt * 420 * speed;
  spawnTimer -= dt * speed; energyTimer -= dt;
  if (spawnTimer <= 0) { spawnObstacle(); spawnTimer = rnd(0.34, 0.72) / speed; }
  if (energyTimer <= 0) { spawnEnergy(); energyTimer = rnd(1.0, 1.8); }
  for (const s of stars) { s.z -= dt * 0.34 * speed; if (s.z < 0.05) { s.z = 1; s.x = rnd(-1,1); s.y = rnd(-0.62,0.62); } }
  for (const o of obstacles) { o.z -= dt * 2.35 * speed; o.rot += o.spin * dt; }
  for (const e of energies) { e.z -= dt * 2.45 * speed; e.rot += dt * 4; }
  obstacles = obstacles.filter(o => o.z > 0.18);
  energies = energies.filter(e => e.z > 0.18);
  for (const o of obstacles) {
    if (o.z < 1.1 && Math.hypot(o.x - player.x, (o.y - player.y) * 1.4) < o.size * 3.4) {
      player.shield -= 18; shake = 16; burst(o.x, o.y, '#ff3d5a'); o.z = -1;
      if (player.shield <= 0) gameOver();
    }
  }
  for (const e of energies) {
    if (e.z < 1.1 && Math.hypot(e.x - player.x, (e.y - player.y) * 1.4) < e.size * 4.6) {
      player.shield = clamp(player.shield + 14, 0, 100); score += 1800; burst(e.x, e.y, '#62e6ff'); e.z = -1;
    }
  }
  for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z -= dt * 0.7; }
  particles = particles.filter(p => p.life > 0);
  shake *= Math.pow(0.001, dt);
}

function burst(x, y, color) {
  for (let i = 0; i < 16; i++) particles.push({ x, y, z: 0.9, vx: rnd(-0.7,0.7), vy: rnd(-0.45,0.45), life: rnd(0.25,0.55), color });
}

function gameOver() {
  running = false;
  overlay.classList.remove('hidden');
  overlay.querySelector('h1').textContent = 'Missão encerrada';
  overlay.querySelector('p:not(.eyebrow)').textContent = `Pontuação final: ${Math.floor(score).toLocaleString('pt-BR')}. Clique para tentar novamente.`;
  startBtn.textContent = 'Reiniciar missão';
}

function drawTunnel(t) {
  ctx.save();
  ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(W,H)*0.75);
  grad.addColorStop(0, '#11172c'); grad.addColorStop(0.5, '#080a16'); grad.addColorStop(1, '#03040a');
  ctx.fillStyle = grad; ctx.fillRect(-40, -40, W+80, H+80);
  ctx.strokeStyle = 'rgba(98,230,255,.12)'; ctx.lineWidth = 1;
  for (let r = 0.18; r < 1.65; r += 0.15) {
    ctx.beginPath();
    const rr = r * Math.min(W,H) * (1 + Math.sin(t * 0.001 + r * 6) * 0.02);
    ctx.ellipse(cx, cy, rr * 1.45, rr * 0.82, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2 + t * 0.00012;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a)*W, cy + Math.sin(a)*H); ctx.stroke();
  }
  for (const s of stars) {
    const p = project(s.x, s.y, s.z * 4 + 0.2);
    ctx.fillStyle = `rgba(248,241,223,${0.25 + (1-s.z)*0.65})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, s.r * scale / (s.z + 0.15), 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawRock(o) {
  const p = project(o.x, o.y, o.z);
  const r = o.size * p.s;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(o.rot); ctx.shadowColor = o.hue; ctx.shadowBlur = 18 * scale;
  ctx.fillStyle = '#2a2230'; ctx.strokeStyle = o.hue; ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    const rr = r * (0.72 + (i % 3) * 0.16);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawEnergy(e) {
  const p = project(e.x, e.y, e.z); const r = e.size * p.s;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(e.rot); ctx.shadowColor = '#62e6ff'; ctx.shadowBlur = 28 * scale;
  ctx.strokeStyle = '#62e6ff'; ctx.fillStyle = 'rgba(98,230,255,.16)'; ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f8f1df'; ctx.beginPath(); ctx.arc(0,0,r*.18,0,Math.PI*2); ctx.fill(); ctx.restore();
}

function drawPlayer() {
  const x = cx + player.x * W * 0.32, y = cy + player.y * H * 0.43;
  ctx.save(); ctx.translate(x, y); ctx.rotate(player.vx * 0.12); ctx.shadowColor = '#f6c96f'; ctx.shadowBlur = 28 * scale;
  const s = 1.1 * scale;
  ctx.fillStyle = '#f8f1df'; ctx.strokeStyle = '#f6c96f'; ctx.lineWidth = 2*s;
  ctx.beginPath(); ctx.moveTo(0, -34*s); ctx.lineTo(25*s, 25*s); ctx.lineTo(0, 14*s); ctx.lineTo(-25*s,25*s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#62e6ff'; ctx.beginPath(); ctx.arc(0,-7*s,8*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = player.boost ? '#fff2c6' : '#ff6d5a'; ctx.beginPath(); ctx.ellipse(0, 36*s, 8*s, (24 + player.boost*22)*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function render(t) {
  drawTunnel(t);
  [...obstacles].sort((a,b)=>b.z-a.z).forEach(drawRock);
  [...energies].sort((a,b)=>b.z-a.z).forEach(drawEnergy);
  for (const p of particles) { const q = project(p.x,p.y,p.z); ctx.globalAlpha = clamp(p.life*2,0,1); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(q.x,q.y,5*scale,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
  drawPlayer();
  scoreEl.textContent = Math.floor(score).toString().padStart(6,'0');
  shieldBar.style.width = `${clamp(player.shield,0,100)}%`;
  speedEl.textContent = `velocidade ${speed.toFixed(1)}x`;
  if (paused) { ctx.fillStyle='rgba(7,8,18,.62)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#f8f1df'; ctx.font=`700 ${42*scale}px Space Grotesk`; ctx.textAlign='center'; ctx.fillText('PAUSADO',cx,cy); }
}

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now;
  update(dt); render(now);
  if (running) requestAnimationFrame(loop);
}

addEventListener('resize', resize);
addEventListener('keydown', e => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault(); keys.add(e.key); if (e.key.toLowerCase()==='p' && running) paused=!paused; });
addEventListener('keyup', e => keys.delete(e.key));
startBtn.addEventListener('click', reset);
resize(); render(performance.now());
