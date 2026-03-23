const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const towerMenu = document.getElementById('tower-menu');

// ---- SUPABASE LEADERBOARD ----
const SB_URL = 'https://cpsympiswakeujnpmbtc.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwc3ltcGlzd2FrZXVqbnBtYnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODE5MTYsImV4cCI6MjA4OTc1NzkxNn0.EzHFc8NYFhvrM9PCmDS7V5Xo5Ssayv_sk_f7MZrJFiw';
let sbUser = null;
let scoreSubmitted = false;

async function sbLogin() {
  // Open GitHub OAuth in default browser
  const redirectTo = 'https://vakovalskii.github.io/defendyse/leaderboard/';
  const authUrl = `${SB_URL}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(redirectTo)}`;
  // In Tauri, open external URL
  if (window.__TAURI__ && window.__TAURI__.shell) {
    window.__TAURI__.shell.open(authUrl);
  } else {
    window.open(authUrl, '_blank');
  }
}

async function sbCheckToken() {
  const token = localStorage.getItem('sb_access_token');
  if (!token) return null;
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SB_KEY }
    });
    if (res.ok) {
      sbUser = await res.json();
      return sbUser;
    }
  } catch(e) {}
  return null;
}

async function submitScoreOnce(st) {
  if (scoreSubmitted || !sbUser) return;
  scoreSubmitted = true;
  const token = localStorage.getItem('sb_access_token');
  if (!token) return;
  const meta = sbUser.user_metadata || {};
  try {
    await fetch(`${SB_URL}/rest/v1/leaderboard`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        user_id: sbUser.id,
        github_username: meta.user_name || meta.preferred_username || 'anonymous',
        github_avatar: meta.avatar_url || '',
        github_url: `https://github.com/${meta.user_name || meta.preferred_username || ''}`,
        score: st.score,
        wave: st.wave.number,
        ship_level: st.player ? st.player.level : 1,
        towers_placed: st.stats ? st.stats.towers_placed : 0,
      })
    });
    addFloatingText(canvas.width / 2, canvas.height / 2 + 60, 'Score submitted!', '#0f0');
  } catch(e) {
    console.error('Score submit failed:', e);
  }
}

// Reset score submission flag on restart
const origRestart = restartGame;

// Try to load saved token on startup
sbCheckToken();


function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

let state = null, prevState = null;
let selectedKind = 'Gatling', lastWaveNum = 0;
let mouseX = 0, mouseY = 0;
let hoveredTower = null, draggingTower = null, placementCheck = null;
let menuTower = null, linkingFrom = null;
let screenShake = 0, shakeX = 0, shakeY = 0;
let animTime = 0;
let prevProjectileCount = 0;

// ---- TRAIL SYSTEM (ring buffer, zero GC) ----
const TRAIL_MAX = 3000;
const trails = new Float32Array(TRAIL_MAX * 5); // x, y, r, g, b per trail point
let trailHead = 0, trailCount = 0;
function addTrail(x, y, r, g, b) {
  const i = trailHead * 5;
  trails[i] = x; trails[i+1] = y; trails[i+2] = r; trails[i+3] = g; trails[i+4] = b;
  trailHead = (trailHead + 1) % TRAIL_MAX;
  if (trailCount < TRAIL_MAX) trailCount++;
}
function drawTrails() {
  if (trailCount === 0) return;
  const fade = 0.92; // trails fade each frame
  for (let j = 0; j < trailCount; j++) {
    const idx = ((trailHead - trailCount + j + TRAIL_MAX) % TRAIL_MAX) * 5;
    const age = 1 - j / trailCount;
    const a = age * 0.36;
    if (a < 0.01) continue;
    ctx.fillStyle = `rgba(${trails[idx+2]|0},${trails[idx+3]|0},${trails[idx+4]|0},${a})`;
    ctx.fillRect(trails[idx] - 1, trails[idx+1] - 1, 2, 2);
  }
  // Fade old trails by shifting their alpha contribution (handled by age calc)
}

// ---- PARTICLE SYSTEM ----
const particles = [];
const MAX_PARTICLES = 500;
function emit(x, y, count, color, spdMin, spdMax, lifeMin, lifeMax, sizeMin, sizeMax) {
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = spdMin + Math.random() * (spdMax - spdMin);
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      life: lifeMin + Math.random() * (lifeMax - lifeMin),
      maxLife: lifeMin + Math.random() * (lifeMax - lifeMin),
      size: sizeMin + Math.random() * (sizeMax - sizeMin),
      color,
      decay: 0.97 + Math.random() * 0.02,
    });
  }
}
function tickParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= p.decay; p.vy *= p.decay;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size * a + 0.5, p.size * a + 0.5);
  }
  ctx.globalAlpha = 1;
}

// ---- FLOATING TEXT SYSTEM ----
const floatingTexts = [];
function addFloatingText(x, y, text, color) {
  floatingTexts.push({
    x, y, text, color,
    life: 1.2,
    vy: -40
  });
}
function tickFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}
function drawFloatingTexts() {
  for (const ft of floatingTexts) {
    const alpha = Math.max(0, ft.life / 1.2);
    ctx.globalAlpha = alpha;
    // Manual glow: draw text twice, first larger and dimmer
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
}

// ---- DETECT CHANGES FOR FX ----
function detectEvents() {
  if (!state || !prevState) return;
  // Detect enemy kills
  const prevIds = new Set(prevState.enemies.map(e => e.id));
  const currIds = new Set(state.enemies.map(e => e.id));
  for (const pe of prevState.enemies) {
    if (!currIds.has(pe.id)) {
      // Enemy died — EPIC explosion!
      if (pe.kind === 'Tank') {
        // MASSIVE explosion — crab goes BOOM
        emit(pe.x, pe.y, 40, '#f80', 50, 200, 0.3, 0.8, 2, 5);
        emit(pe.x, pe.y, 25, '#fa0', 30, 150, 0.2, 0.6, 1.5, 4);
        emit(pe.x, pe.y, 20, '#ff4', 40, 180, 0.15, 0.4, 1, 3);
        emit(pe.x, pe.y, 15, '#fff', 60, 250, 0.1, 0.25, 0.5, 2);
        screenShake = Math.max(screenShake, 6);
        // Gore trails
        for (let g = 0; g < 20; g++) addTrail(pe.x + (Math.random()-0.5)*20, pe.y + (Math.random()-0.5)*20, 200, 100, 30);
      } else if (pe.kind === 'Fighter') {
        // Medium explosion — squid pops
        emit(pe.x, pe.y, 20, '#ff0', 40, 150, 0.2, 0.5, 1.5, 3);
        emit(pe.x, pe.y, 12, '#ffa', 30, 120, 0.15, 0.4, 1, 2.5);
        emit(pe.x, pe.y, 8, '#fff', 50, 180, 0.1, 0.2, 0.5, 1.5);
        screenShake = Math.max(screenShake, 2);
        for (let g = 0; g < 8; g++) addTrail(pe.x + (Math.random()-0.5)*12, pe.y + (Math.random()-0.5)*12, 200, 180, 40);
      } else {
        // Small pop — scarab bursts
        emit(pe.x, pe.y, 10, '#f44', 30, 100, 0.15, 0.4, 1, 2);
        emit(pe.x, pe.y, 5, '#fa8', 20, 80, 0.1, 0.25, 0.5, 1.5);
        emit(pe.x, pe.y, 3, '#fff', 40, 120, 0.08, 0.15, 0.3, 1);
      }
      // Floating text: money earned from kill
      const moneyEarned = state.money - prevState.money;
      if (moneyEarned > 0) {
        // Estimate per-enemy reward based on money diff and kills this frame
        const killedThisFrame = prevState.enemies.filter(e => !currIds.has(e.id));
        const perEnemy = Math.round(moneyEarned / killedThisFrame.length);
        addFloatingText(pe.x, pe.y, '+$' + perEnemy, '#0f0');
      }
    }
  }
  // Detect core damage
  if (state.core.hp < prevState.core.hp) {
    const dmg = prevState.core.hp - state.core.hp;
    screenShake = Math.min(dmg * 0.3, 12);
    emit(state.core.x, state.core.y, Math.floor(dmg), '#4af', 20, 80, 0.3, 0.6, 1, 3);
    addFloatingText(state.core.x, state.core.y, '-' + Math.ceil(dmg), '#f44');
  }

  // Detect new projectiles for muzzle flash
  const currProjCount = state.projectiles.length;
  if (currProjCount > prevProjectileCount) {
    // New projectiles were created — emit muzzle flash particles at origin
    for (const p of state.projectiles) {
      if (p.kind === 'Gatling' && p.origin_x !== undefined) {
        emit(p.origin_x, p.origin_y, 2, '#ff0', 20, 50, 0.05, 0.12, 1, 2.5);
      }
    }
  }
  prevProjectileCount = currProjCount;
}

// ---- PARALLAX STAR LAYERS ----
// 3 layers: far (slow), mid, near (fast)
const starLayers = [
  { stars: [], depth: 0.04, count: 150, sizeRange: [0.3, 0.8], brightRange: [0.15, 0.35], color: '#668' },
  { stars: [], depth: 0.10, count: 100, sizeRange: [0.5, 1.4], brightRange: [0.3, 0.55], color: '#aac' },
  { stars: [], depth: 0.20, count: 50,  sizeRange: [0.8, 2.2], brightRange: [0.5, 0.9],  color: '#fff' },
];

// Background planets (very far, decorative)
const bgPlanets = [
  { x: 0.82, y: 0.15, r: 35, depth: 0.015, color1: '#1a3a6a', color2: '#0a1838', ring: false, name: 'neptune' },
  { x: 0.15, y: 0.78, r: 22, depth: 0.02,  color1: '#5a3020', color2: '#2a1510', ring: true,  name: 'saturn' },
  { x: 0.55, y: 0.88, r: 14, depth: 0.025, color1: '#884422', color2: '#442211', ring: false, name: 'mars' },
  { x: 0.92, y: 0.65, r: 50, depth: 0.01,  color1: '#d4a060', color2: '#8a6030', ring: true,  name: 'gas giant' },
  { x: 0.35, y: 0.12, r: 8,  depth: 0.03,  color1: '#aaaacc', color2: '#666688', ring: false, name: 'moon' },
];
for (const layer of starLayers) {
  for (let i = 0; i < layer.count; i++) {
    layer.stars.push({
      x: Math.random(), y: Math.random(),
      s: layer.sizeRange[0] + Math.random() * (layer.sizeRange[1] - layer.sizeRange[0]),
      b: layer.brightRange[0] + Math.random() * (layer.brightRange[1] - layer.brightRange[0]),
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 2,
    });
  }
}
// Nebula clouds on far layer
const nebulae = [];
for (let i = 0; i < 5; i++) {
  nebulae.push({
    x: 0.1 + Math.random() * 0.8,
    y: 0.1 + Math.random() * 0.8,
    r: 80 + Math.random() * 200,
    color: [
      [20, 10, 60],
      [60, 10, 40],
      [10, 30, 60],
      [40, 10, 50],
      [15, 25, 55],
    ][i],
    depth: 0.01 + Math.random() * 0.03,
  });
}
// Parallax center — tracks mouse smoothly
// Parallax driven by time drift, not mouse

listen('game-state', (event) => {
  prevState = state;
  state = event.payload;
  detectEvents();
  render();
});

// ---- CONTROLS ----
document.querySelectorAll('.tb[data-kind]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (selectedKind === btn.dataset.kind) {
      selectedKind = null; placementCheck = null; btn.classList.remove('active'); canvas.style.cursor = 'default';
    } else {
      document.querySelectorAll('.tb[data-kind]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); selectedKind = btn.dataset.kind; canvas.style.cursor = 'crosshair';
      invoke('select_tower_kind', { kind: selectedKind });
    }
  });
});
document.querySelectorAll('.tb[data-speed]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tb[data-speed]').forEach(b => b.classList.remove('speed-active'));
    btn.classList.add('speed-active'); invoke('set_speed', { multiplier: parseFloat(btn.dataset.speed) });
  });
});
document.getElementById('btn-buy-slot').addEventListener('click', () => invoke('buy_tower_slot'));
canvas.addEventListener('mousemove', async (e) => {
  mouseX = e.clientX; mouseY = e.clientY; findHoveredTower();
  if (!draggingTower && !hoveredTower && state && selectedKind)
    placementCheck = await invoke('check_placement', { x: mouseX, y: mouseY, kind: selectedKind });
  else if (!selectedKind) placementCheck = null;
});
function findHoveredTower() {
  if (!state || draggingTower) return;
  hoveredTower = null;
  for (const t of state.towers) {
    const dx = mouseX - t.x, dy = mouseY - t.y;
    if (Math.sqrt(dx*dx + dy*dy) < 25) { hoveredTower = t; break; }
  }
}
function closeTowerMenu() { towerMenu.style.display = 'none'; menuTower = null; }
function openTowerMenu(t, x, y) {
  menuTower = t;
  const lc = state ? state.spirit_links.filter(l => l.tower_a === t.id || l.tower_b === t.id).length : 0;
  const ePct = Math.round((t.energy || 1) * 100);
  const eCol = ePct >= 80 ? '#4af' : ePct >= 50 ? '#ff0' : '#f44';
  towerMenu.innerHTML = `
    <div class="tm-header"><b>${t.kind}</b> L${t.level} | DMG:${t.damage.toFixed(1)} RNG:${t.range.toFixed(0)}<br><span style="color:${eCol}">Power: ${ePct}%</span></div>
    ${lc > 0 ? `<div style="color:#a6f;font-size:10px;margin-bottom:4px">Spirit x${lc} (+${lc*20}% DMG +${lc*15}% SPD)</div>` : ''}
    <button class="tm-btn" style="color:#0f0" onclick="doUpgrade()">Upgrade — $${t.cost * t.level}</button>
    ${lc < 2 ? '<button class="tm-btn" style="color:#a6f" onclick="doLink()">Spirit Link — $100</button>' : ''}
    <button class="tm-btn" style="color:#4af" onclick="doMove()">Move</button>
    <button class="tm-btn" style="color:#f44" onclick="doSell()">Sell — +$${Math.floor(t.cost/2)}</button>`;
  towerMenu.style.display = 'block';
  towerMenu.style.left = Math.min(x, innerWidth - 180) + 'px';
  towerMenu.style.top = Math.min(y, innerHeight - 140) + 'px';
}
async function doUpgrade() {
  if (menuTower) {
    const tx = menuTower.x, ty = menuTower.y;
    await invoke('upgrade_tower', { towerId: menuTower.id });
    addFloatingText(tx, ty, 'UPGRADED!', '#ff0');
    emit(tx, ty, 20, '#ff0', 30, 100, 0.3, 0.6, 1, 3);
    emit(tx, ty, 10, '#fff', 20, 60, 0.2, 0.4, 0.5, 1.5);
    closeTowerMenu();
  }
}
function doMove() { if (menuTower) { draggingTower = menuTower; canvas.style.cursor = 'grabbing'; closeTowerMenu(); } }
async function doSell() {
  if (menuTower) {
    const refund = Math.floor(menuTower.cost / 2);
    emit(menuTower.x, menuTower.y, 15, '#4af', 30, 100, 0.3, 0.5, 1, 3);
    addFloatingText(menuTower.x, menuTower.y, '+$' + refund, '#0f0');
    await invoke('sell_tower', { towerId: menuTower.id });
    closeTowerMenu();
  }
}
function doLink() { if (menuTower) { linkingFrom = menuTower; canvas.style.cursor = 'pointer'; closeTowerMenu(); } }

canvas.addEventListener('click', async (e) => {
  if (!state || state.game_over) return;
  mouseX = e.clientX; mouseY = e.clientY;
  findHoveredTower(); // ensure hover is fresh
  if (menuTower) { closeTowerMenu(); return; }
  if (linkingFrom) {
    if (hoveredTower && hoveredTower.id !== linkingFrom.id) {
      const ok = await invoke('create_spirit_link', { towerA: linkingFrom.id, towerB: hoveredTower.id });
      if (ok) emit((linkingFrom.x+hoveredTower.x)/2, (linkingFrom.y+hoveredTower.y)/2, 20, '#a6f', 20, 80, 0.3, 0.7, 1, 3);
    }
    linkingFrom = null; canvas.style.cursor = selectedKind ? 'crosshair' : 'default'; return;
  }
  if (draggingTower) {
    await invoke('move_tower', { towerId: draggingTower.id, x: mouseX, y: mouseY });
    draggingTower = null; canvas.style.cursor = selectedKind ? 'crosshair' : 'default'; return;
  }
  // Click on tower = open menu
  if (hoveredTower) {
    openTowerMenu(hoveredTower, e.clientX, e.clientY);
    menuJustOpened = true;
    return;
  }
  // Click on empty space = place tower
  if (selectedKind) {
    const prevTowerCount = state ? state.towers.length : 0;
    await invoke('place_tower', { x: e.clientX, y: e.clientY, kind: selectedKind });
    // Particle burst at placement position (snapped to grid)
    if (state) {
      const gs = state.grid_size;
      const gx = Math.round(e.clientX / gs) * gs;
      const gy = Math.round(e.clientY / gs) * gs;
      emit(gx, gy, 25, '#0f0', 30, 100, 0.3, 0.6, 1, 3);
      emit(gx, gy, 12, '#fff', 20, 60, 0.2, 0.4, 0.5, 1.5);
    }
  }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// Close menu when clicking outside — delayed to avoid closing on the same click that opens it
let menuJustOpened = false;
document.addEventListener('click', (e) => {
  if (menuJustOpened) { menuJustOpened = false; return; }
  if (menuTower && !towerMenu.contains(e.target)) closeTowerMenu();
});
async function togglePause() { await invoke('toggle_pause'); }
async function restartGame() { scoreSubmitted = false; await invoke('restart_game'); document.getElementById('game-over').style.display = 'none'; }

// ---- PLAYER SHIP INPUT ----
const playerKeys = { up: false, down: false, left: false, right: false, fire: false };
function sendPlayerInput() {
  invoke('set_player_input', { input: playerKeys });
}

document.addEventListener('keydown', (e) => {
  let shipKey = true;
  if (e.key === 'ArrowUp') playerKeys.up = true;
  else if (e.key === 'ArrowDown') playerKeys.down = true;
  else if (e.key === 'ArrowLeft') playerKeys.left = true;
  else if (e.key === 'ArrowRight') playerKeys.right = true;
  else if (e.key === ' ') { playerKeys.fire = true; e.preventDefault(); }
  else shipKey = false;
  if (shipKey) { sendPlayerInput(); return; }
  if (e.key === 'Escape') {
    // Close active modes first
    if (menuTower) { closeTowerMenu(); return; }
    if (linkingFrom) { linkingFrom = null; canvas.style.cursor = selectedKind ? 'crosshair' : 'default'; return; }
    if (draggingTower) { draggingTower = null; canvas.style.cursor = selectedKind ? 'crosshair' : 'default'; return; }
    if (selectedKind) {
      selectedKind = null; placementCheck = null;
      document.querySelectorAll('.tb[data-kind]').forEach(b => b.classList.remove('active'));
      canvas.style.cursor = 'default';
      return;
    }
    // Toggle pause menu (only if game started)
    if (gameStarted) togglePauseMenu();
  }
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === '1') selectTower('Gatling'); if (e.key === '2') selectTower('Cannon'); if (e.key === '3') selectTower('Laser'); if (e.key === '4') selectTower('Hive');
  if (e.key === 'b' || e.key === 'B') invoke('buy_tower_slot');
  if ((e.key === 'r' || e.key === 'R') && state && state.game_over) restartGame();
  if (e.key === 'q') setSpeed(1); if (e.key === 'w') setSpeed(2); if (e.key === 'e') setSpeed(3);
  if (e.key === 'u' || e.key === 'U') {
    invoke('upgrade_ship').then(ok => {
      if (ok && state && state.player) {
        addFloatingText(state.player.x, state.player.y, 'SHIP UPGRADED!', '#0fc');
        emit(state.player.x, state.player.y, 25, '#0fc', 40, 120, 0.3, 0.6, 1, 3);
        emit(state.player.x, state.player.y, 15, '#fff', 30, 80, 0.2, 0.4, 0.5, 2);
      }
    });
  }
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp') playerKeys.up = false;
  else if (e.key === 'ArrowDown') playerKeys.down = false;
  else if (e.key === 'ArrowLeft') playerKeys.left = false;
  else if (e.key === 'ArrowRight') playerKeys.right = false;
  else if (e.key === ' ') playerKeys.fire = false;
  sendPlayerInput();
});
function selectTower(k) {
  if (selectedKind === k) { selectedKind = null; placementCheck = null; document.querySelectorAll('.tb[data-kind]').forEach(b => b.classList.remove('active')); canvas.style.cursor = 'default'; }
  else { selectedKind = k; document.querySelectorAll('.tb[data-kind]').forEach(b => b.classList.toggle('active', b.dataset.kind === k)); canvas.style.cursor = 'crosshair'; invoke('select_tower_kind', { kind: k }); }
}
function setSpeed(s) { document.querySelectorAll('.tb[data-speed]').forEach(b => b.classList.toggle('speed-active', b.dataset.speed === String(s))); invoke('set_speed', { multiplier: s }); }
function zoneYRange(x) {
  if (!state) return [0, 720];
  const t = Math.max(0, Math.min(1, (x - state.zone_x_min) / (state.zone_x_max - state.zone_x_min)));
  const half = state.zone_y_half_max + t * (state.zone_y_half_min - state.zone_y_half_max);
  return [state.zone_y_center - half, state.zone_y_center + half];
}


let gameStarted = false;
let menuOpen = true; // starts open (title screen)

function showMenu(mode) {
  const menu = document.getElementById('main-menu');
  const title = menu.querySelector('.sm-title');
  const sub = menu.querySelector('.sm-sub');
  const btns = document.getElementById('menu-buttons');
  document.getElementById('menu-help').style.display = 'none';

  const loginBtn = sbUser
    ? `<div style="color:#4af;font-size:12px;margin:8px 0">Logged in as ${(sbUser.user_metadata||{}).user_name||'Player'}</div>`
    : `<button class="sm-btn sm-help-btn" onclick="sbLogin()">Sign in with GitHub</button>`;
  const lbBtn = `<a class="sm-btn sm-help-btn" href="https://vakovalskii.github.io/defendyse/leaderboard/" target="_blank" style="text-decoration:none;display:inline-block">Leaderboard</a>`;

  if (mode === 'start') {
    title.textContent = 'DEFENDYSE';
    title.style.fontSize = '64px';
    sub.textContent = 'Planet Defense';
    sub.style.display = '';
    btns.innerHTML = `
      <button class="sm-btn" onclick="startGame()">START GAME</button>
      ${loginBtn}
      ${lbBtn}
      <button class="sm-btn sm-help-btn" onclick="toggleMenuHelp()">CONTROLS</button>`;
  } else {
    title.textContent = 'PAUSED';
    title.style.fontSize = '36px';
    sub.style.display = 'none';
    btns.innerHTML = `
      <button class="sm-btn" onclick="resumeGame()">CONTINUE</button>
      <button class="sm-btn" onclick="menuRestart()">RESTART</button>
      ${loginBtn}
      ${lbBtn}
      <button class="sm-btn sm-help-btn" onclick="toggleMenuHelp()">CONTROLS</button>`;
  }
  menu.style.display = 'flex';
  menuOpen = true;
}

function hideMenu() {
  document.getElementById('main-menu').style.display = 'none';
  menuOpen = false;
}

function startGame() {
  hideMenu();
  document.getElementById('hud').style.display = 'block';
  document.getElementById('toolbar').style.display = 'flex';
  gameStarted = true;
  invoke('restart_game');
}

function resumeGame() {
  hideMenu();
  invoke('toggle_pause');
}

function menuRestart() {
  hideMenu();
  invoke('toggle_pause');
  restartGame();
}

function togglePauseMenu() {
  if (menuOpen) {
    resumeGame();
  } else {
    invoke('toggle_pause');
    showMenu('pause');
  }
}

function toggleMenuHelp() {
  const h = document.getElementById('menu-help');
  h.style.display = h.style.display === 'none' ? 'block' : 'none';
}

// Show start menu on load
showMenu('start');

// Expose to global scope for onclick handlers in HTML
window.startGame = startGame;
window.toggleHelp = toggleHelp;
window.toggleMenuHelp = toggleMenuHelp;
window.doUpgrade = doUpgrade;
window.doMove = doMove;
window.doSell = doSell;
window.doLink = doLink;
window.togglePause = togglePause;
window.restartGame = restartGame;
window.resumeGame = resumeGame;
window.menuRestart = menuRestart;
window.sbLogin = sbLogin;

// ======== RENDER ========
function render() {
  if (!state) return;
  const W = canvas.width, H = canvas.height;
  const dt = 0.016;
  animTime += dt;

  // Screen shake
  if (screenShake > 0.1) {
    shakeX = (Math.random() - 0.5) * screenShake;
    shakeY = (Math.random() - 0.5) * screenShake;
    screenShake *= 0.85;
  } else { shakeX = 0; shakeY = 0; screenShake = 0; }

  tickParticles(dt);
  tickFloatingTexts(dt);

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Slow automatic parallax drift
  const pxOff = Math.sin(animTime * 0.05) * 0.3 + Math.sin(animTime * 0.02) * 0.15;
  const pyOff = Math.cos(animTime * 0.04) * 0.2 + Math.cos(animTime * 0.015) * 0.1;

  // Background
  ctx.fillStyle = '#03030a';
  ctx.fillRect(-5, -5, W + 10, H + 10);

  // Parallax nebulae (far background)
  drawNebulae(W, H, pxOff, pyOff);

  // Parallax stars + planets
  drawPlanets(W, H, pxOff, pyOff);
  drawStars(W, H, pxOff, pyOff);
  drawTrails();
  drawPlacementZone();
  drawBlackHoles();
  drawSpiritTriangles();
  drawSpiritLinks();
  drawCore();
  drawLightning();
  drawTowers();
  drawEnemies();
  drawProjectiles();
  drawHiveDrones();
  drawPlayerShip();
  drawParticles();
  drawFloatingTexts();
  drawGhost();
  drawLinkingLine();

  ctx.restore();
  updateHud();

  if (state.game_over) {
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').textContent = state.score;
    if (document.getElementById('final-wave')) document.getElementById('final-wave').textContent = state.wave.number;
    submitScoreOnce(state);
  }
  if (state.wave.number !== lastWaveNum && state.wave.started) {
    lastWaveNum = state.wave.number;
    const b = document.getElementById('wave-banner');
    b.textContent = `WAVE ${state.wave.number}`;
    b.style.display = 'block';
    setTimeout(() => b.style.display = 'none', 2000);
  }
}

function drawNebulae(W, H, pxOff, pyOff) {
  for (const n of nebulae) {
    const ox = pxOff * n.depth * W * 8;
    const oy = pyOff * n.depth * H * 8;
    const nx = n.x * W + ox;
    const ny = n.y * H + oy;
    const pulse = 1 + Math.sin(animTime * 0.3 + n.x * 10) * 0.1;
    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r * pulse);
    const [cr, cg, cb] = n.color;
    g.addColorStop(0, `rgba(${cr},${cg},${cb}, 0.18)`);
    g.addColorStop(0.5, `rgba(${cr},${cg},${cb}, 0.06)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(nx - n.r * pulse, ny - n.r * pulse, n.r * pulse * 2, n.r * pulse * 2);
  }
}

function drawStars(W, H, pxOff, pyOff) {
  for (const layer of starLayers) {
    const ox = pxOff * layer.depth * W;
    const oy = pyOff * layer.depth * H;
    for (const s of layer.stars) {
      const sx = ((s.x * W + ox) % W + W) % W;
      const sy = ((s.y * H + oy) % H + H) % H;
      const twinkle = 0.5 + 0.5 * Math.sin(animTime * s.twinkleSpeed + s.phase);
      ctx.globalAlpha = s.b * twinkle;
      ctx.fillStyle = layer.color;
      ctx.fillRect(sx, sy, s.s, s.s);
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlanets(W, H, pxOff, pyOff) {
  for (const p of bgPlanets) {
    const ox = pxOff * p.depth * W * 5;
    const oy = pyOff * p.depth * H * 5;
    const px = p.x * W + ox;
    const py = p.y * H + oy;
    const pr = parseInt(p.color1.slice(1,3),16);
    const pg = parseInt(p.color1.slice(3,5),16);
    const pb = parseInt(p.color1.slice(5,7),16);
    const pulse = 1 + Math.sin(animTime * 0.4 + p.x * 5) * 0.05;

    // Deep fog / nebula haze around planet
    const fogR = p.r * 5 * pulse;
    const fog = ctx.createRadialGradient(px, py, p.r * 0.5, px, py, fogR);
    fog.addColorStop(0, `rgba(${pr},${pg},${pb}, 0.08)`);
    fog.addColorStop(0.3, `rgba(${pr},${pg},${pb}, 0.04)`);
    fog.addColorStop(0.6, `rgba(${Math.floor(pr/2)},${Math.floor(pg/2)},${Math.floor(pb/2)}, 0.02)`);
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog;
    ctx.beginPath(); ctx.arc(px, py, fogR, 0, Math.PI*2); ctx.fill();

    // Outer glow (atmosphere)
    const glowR = p.r * 2.5;
    const glow = ctx.createRadialGradient(px, py, p.r * 0.8, px, py, glowR);
    glow.addColorStop(0, `rgba(${Math.min(255,pr+60)},${Math.min(255,pg+60)},${Math.min(255,pb+60)}, 0.12)`);
    glow.addColorStop(0.5, `rgba(${pr},${pg},${pb}, 0.05)`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(px, py, glowR, 0, Math.PI*2); ctx.fill();

    // Planet body
    const body = ctx.createRadialGradient(px - p.r*0.3, py - p.r*0.3, p.r*0.1, px, py, p.r);
    body.addColorStop(0, `rgb(${Math.min(255,pr+40)},${Math.min(255,pg+40)},${Math.min(255,pb+40)})`);
    body.addColorStop(0.7, p.color1);
    body.addColorStop(1, p.color2);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI*2); ctx.fill();

    // Terminator shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(px + p.r*0.2, py, p.r*0.95, -0.5, Math.PI*0.8); ctx.fill();

    // Bright edge (limb brightening)
    ctx.strokeStyle = `rgba(${Math.min(255,pr+80)},${Math.min(255,pg+80)},${Math.min(255,pb+80)}, 0.2)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI*2); ctx.stroke();

    // Rings
    if (p.ring) {
      ctx.strokeStyle = `rgba(${Math.min(255,pr+40)},${Math.min(255,pg+40)},${Math.min(255,pb+40)}, 0.25)`;
      ctx.lineWidth = p.r * 0.1;
      ctx.beginPath(); ctx.ellipse(px, py, p.r * 2, p.r * 0.35, -0.15, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = `rgba(${pr},${pg},${pb}, 0.12)`;
      ctx.lineWidth = p.r * 0.15;
      ctx.beginPath(); ctx.ellipse(px, py, p.r * 1.6, p.r * 0.28, -0.15, 0, Math.PI*2); ctx.stroke();
    }
  }
}

function drawBlackHoles() {
  if (!state || !state.black_holes) return;
  for (const bh of state.black_holes) {
    const lifeRatio = bh.lifetime / bh.max_lifetime;
    const fadeIn = Math.min(1, (bh.max_lifetime - bh.lifetime) * 2); // fade in over 0.5s
    const alpha = Math.min(lifeRatio * 2, 1) * fadeIn;
    const rot = bh.rotation;

    // Pull radius indicator
    ctx.beginPath(); ctx.arc(bh.x, bh.y, bh.pull_radius, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(80, 0, 120, ${alpha * 0.1})`;
    ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);

    // Gravitational lensing rings (3 spinning rings)
    for (let i = 3; i >= 1; i--) {
      const ringR = bh.radius * (1 + i * 1.5);
      ctx.beginPath();
      ctx.ellipse(bh.x, bh.y, ringR, ringR * 0.3, rot * (i % 2 === 0 ? 1 : -1) + i, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 50, 180, ${alpha * 0.15 / i})`;
      ctx.lineWidth = 2; ctx.stroke();
    }

    // Accretion disk — spinning ellipse
    ctx.beginPath();
    ctx.ellipse(bh.x, bh.y, bh.radius * 3, bh.radius * 0.8, rot, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180, 100, 255, ${alpha * 0.3})`;
    ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(bh.x, bh.y, bh.radius * 2.5, bh.radius * 0.6, rot + 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(120, 60, 200, ${alpha * 0.2})`;
    ctx.lineWidth = 2; ctx.stroke();

    // Dark center — event horizon
    const eg = ctx.createRadialGradient(bh.x, bh.y, 0, bh.x, bh.y, bh.radius * 1.5);
    eg.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
    eg.addColorStop(0.5, `rgba(10, 0, 20, ${alpha * 0.8})`);
    eg.addColorStop(0.8, `rgba(60, 20, 100, ${alpha * 0.3})`);
    eg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(bh.x, bh.y, bh.radius * 1.5, 0, Math.PI*2); ctx.fill();

    // Bright singularity point
    ctx.fillStyle = `rgba(200, 150, 255, ${alpha * 0.4 + Math.sin(animTime * 8) * 0.2})`;
    ctx.beginPath(); ctx.arc(bh.x, bh.y, 2, 0, Math.PI*2); ctx.fill();

    // Particle suction effect — spiral lines
    for (let s = 0; s < 6; s++) {
      const a = rot * 2 + s * Math.PI / 3;
      const sr = bh.pull_radius * 0.6 * (0.5 + Math.sin(animTime * 3 + s) * 0.3);
      const sx = bh.x + Math.cos(a) * sr;
      const sy = bh.y + Math.sin(a) * sr;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bh.x, bh.y);
      ctx.strokeStyle = `rgba(140, 80, 220, ${alpha * 0.1})`;
      ctx.lineWidth = 0.8; ctx.stroke();
    }

    // Ambient particles being sucked in
    if (Math.random() < 0.3 * alpha) {
      const pa = Math.random() * Math.PI * 2;
      const pr = bh.pull_radius * (0.3 + Math.random() * 0.7);
      emit(bh.x + Math.cos(pa) * pr, bh.y + Math.sin(pa) * pr,
        1, '#a4f', 5, 15, 0.3, 0.6, 0.5, 1.5);
    }
  }
}

function drawPlacementZone() {
  const { zone_x_min: xMin, zone_x_max: xMax, grid_size: gs } = state;
  const [yMinL, yMaxL] = zoneYRange(xMin);
  const [yMinR, yMaxR] = zoneYRange(xMax);

  // Zone shape
  ctx.beginPath();
  ctx.moveTo(xMin, yMinL); ctx.lineTo(xMax, yMinR);
  ctx.lineTo(xMax, yMaxR); ctx.lineTo(xMin, yMaxL); ctx.closePath();

  // Subtle fill (10% dimmer)
  const zg = ctx.createLinearGradient(xMin, 0, xMax, 0);
  const a = 0.025 + Math.sin(animTime * 0.8) * 0.008;
  zg.addColorStop(0, `rgba(0, 255, 120, ${a * 1.3})`);
  zg.addColorStop(0.5, `rgba(0, 200, 100, ${a * 0.8})`);
  zg.addColorStop(1, `rgba(0, 150, 80, ${a * 0.4})`);
  ctx.fillStyle = zg; ctx.fill();

  // Subtle border
  const ba = 0.12 + Math.sin(animTime * 1.5) * 0.05;
  ctx.strokeStyle = `rgba(0, 255, 120, ${ba})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);

  // Grid dots — dimmer
  const occ = new Set(state.towers.map(t => `${t.x},${t.y}`));
  for (let x = xMin; x <= xMax; x += gs) {
    const [yLo, yHi] = zoneYRange(x);
    for (let y = Math.ceil(yLo / gs) * gs; y <= yHi; y += gs) {
      if (occ.has(`${x},${y}`)) continue;
      ctx.fillStyle = `rgba(0, 255, 120, ${0.06 + Math.sin(animTime + x * 0.01 + y * 0.01) * 0.02})`;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  // ---- FLYING BEACONS along perimeter ----
  // 4 edges: top, right, bottom, left
  const edges = [
    [xMin, yMinL, xMax, yMinR], // top
    [xMax, yMinR, xMax, yMaxR], // right
    [xMax, yMaxR, xMin, yMaxL], // bottom
    [xMin, yMaxL, xMin, yMinL], // left
  ];
  const beaconCount = 8;
  for (let b = 0; b < beaconCount; b++) {
    // Each beacon travels around the entire perimeter
    const totalT = ((animTime * 0.15 + b / beaconCount) % 1.0); // 0-1 around perimeter
    const edgeIdx = Math.floor(totalT * 4);
    const edgeT = (totalT * 4) % 1;
    const edge = edges[edgeIdx % 4];
    const bx = edge[0] + (edge[2] - edge[0]) * edgeT;
    const by = edge[1] + (edge[3] - edge[1]) * edgeT;

    // Beacon glow
    const pulse = 0.4 + Math.sin(animTime * 4 + b * 2) * 0.2;
    ctx.fillStyle = `rgba(0, 255, 150, ${pulse * 0.15})`;
    ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI*2); ctx.fill();
    // Beacon dot
    ctx.fillStyle = `rgba(0, 255, 150, ${pulse})`;
    ctx.beginPath(); ctx.arc(bx, by, 2, 0, Math.PI*2); ctx.fill();
  }

  // Zone label
  ctx.fillStyle = `rgba(0, 255, 120, ${0.15 + Math.sin(animTime) * 0.06})`;
  ctx.font = '9px monospace'; ctx.textAlign = 'left';
  ctx.fillText('DEFENSE ZONE', xMin + 6, yMinL - 5);
}

function drawSpiritTriangles() {
  for (const tri of state.spirit_triangles) {
    const [v0, v1, v2] = tri.vertices;
    const alpha = 0.03 + Math.sin(animTime * 2) * 0.015;
    ctx.beginPath();
    ctx.moveTo(v0[0], v0[1]); ctx.lineTo(v1[0], v1[1]); ctx.lineTo(v2[0], v2[1]); ctx.closePath();
    // Animated gradient fill
    const cx = (v0[0]+v1[0]+v2[0])/3, cy = (v0[1]+v1[1]+v2[1])/3;
    const g = ctx.createRadialGradient(cx, cy, 5, cx, cy, 120);
    g.addColorStop(0, `rgba(160, 100, 255, ${alpha * 3})`);
    g.addColorStop(1, `rgba(80, 40, 180, ${alpha})`);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = `rgba(180, 130, 255, ${0.12 + Math.sin(animTime * 3) * 0.06})`;
    ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = `rgba(180, 130, 255, ${0.15 + Math.sin(animTime*2)*0.08})`;
    ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('SPIRIT FIELD', cx, cy);
  }
}

function drawSpiritLinks() {
  for (const link of state.spirit_links) {
    const ta = state.towers.find(t => t.id === link.tower_a);
    const tb = state.towers.find(t => t.id === link.tower_b);
    if (!ta || !tb) continue;
    const dx = tb.x - ta.x, dy = tb.y - ta.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const nx = -dy/dist, ny = dx/dist;
    const phase = link.pulse_phase;
    // Double helix waves
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let i = 0; i <= 50; i++) {
        const t = i / 50;
        const wx = ta.x + dx * t;
        const wy = ta.y + dy * t;
        const wave = Math.sin(t * Math.PI * 7 - phase * (pass === 0 ? 1 : -1.4)) * (5 + Math.sin(phase * 0.5) * 2);
        const px = wx + nx * wave, py = wy + ny * wave;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      const a = 0.25 + Math.sin(phase * 2 + pass) * 0.1;
      ctx.strokeStyle = pass === 0 ? `rgba(160,100,255,${a})` : `rgba(100,180,255,${a})`;
      ctx.lineWidth = 1.2; ctx.stroke();
    }
    // Energy orbs traveling — manual glow (semi-transparent circle behind)
    for (let p = 0; p < 3; p++) {
      const t = ((phase * 0.35 + p * 0.33) % 1);
      const px = ta.x + dx * t, py = ta.y + dy * t;
      ctx.fillStyle = 'rgba(160,100,255,0.12)';
      ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(200,150,255,0.5)';
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI*2); ctx.fill();
    }
  }
}

function drawLinkingLine() {
  if (!linkingFrom || !state) return;
  const ta = state.towers.find(t => t.id === linkingFrom.id);
  if (!ta) { linkingFrom = null; return; }
  ctx.beginPath(); ctx.moveTo(ta.x, ta.y); ctx.lineTo(mouseX, mouseY);
  const dx = mouseX - ta.x, dy = mouseY - ta.y, dist = Math.sqrt(dx*dx + dy*dy);
  const inR = dist <= 250, target = hoveredTower && hoveredTower.id !== linkingFrom.id;
  ctx.strokeStyle = inR && target ? 'rgba(160,100,255,0.6)' : inR ? 'rgba(160,100,255,0.25)' : 'rgba(255,50,50,0.25)';
  ctx.lineWidth = 2; ctx.setLineDash(inR && target ? [] : [8, 4]); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(ta.x, ta.y, 250, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(160,100,255,0.1)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
}

function drawCore() {
  const c = state.core;
  const hpR = c.hp / c.max_hp;
  const pulse = 1 + Math.sin(animTime * 2) * 0.08;

  // Outer glow — manual: large semi-transparent circle
  ctx.fillStyle = `rgba(0, 150, 255, ${0.06 * hpR})`;
  ctx.beginPath(); ctx.arc(c.x, c.y, c.radius * 3.5 * pulse, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(0, 120, 255, ${0.1 * hpR})`;
  ctx.beginPath(); ctx.arc(c.x, c.y, c.radius * 2.5 * pulse, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `rgba(0, 150, 255, ${0.2 * hpR})`;
  ctx.beginPath(); ctx.arc(c.x, c.y, c.radius * 1.5 * pulse, 0, Math.PI*2); ctx.fill();

  // Core body with inner glow
  const r = Math.floor(255 * (1 - hpR)), b = Math.floor(255 * hpR);
  const g2 = ctx.createRadialGradient(c.x - 8, c.y - 8, 5, c.x, c.y, c.radius);
  g2.addColorStop(0, `rgb(${Math.min(255, r+80)}, ${100}, ${Math.min(255, b+80)})`);
  g2.addColorStop(1, `rgb(${r}, 30, ${b})`);
  ctx.beginPath(); ctx.arc(c.x, c.y, c.radius * pulse, 0, Math.PI*2);
  ctx.fillStyle = g2; ctx.fill();
  ctx.strokeStyle = `rgba(100, 200, 255, ${0.4 + Math.sin(animTime*3)*0.2})`; ctx.lineWidth = 2; ctx.stroke();

  // Core range
  ctx.beginPath(); ctx.arc(c.x, c.y, c.range, 0, Math.PI*2);
  ctx.strokeStyle = `rgba(100,180,255,${0.08 + Math.sin(animTime)*0.04})`; ctx.lineWidth = 1; ctx.stroke();

  // HP bar
  const bw = 60;
  ctx.fillStyle = '#200'; ctx.fillRect(c.x - bw/2, c.y + c.radius + 10, bw, 4);
  ctx.fillStyle = hpR > 0.3 ? '#0af' : '#f44'; ctx.fillRect(c.x - bw/2, c.y + c.radius + 10, bw * hpR, 4);

  // Ambient particles from core
  if (Math.random() < 0.3) {
    const angle = Math.random() * Math.PI * 2;
    emit(c.x + Math.cos(angle) * c.radius * 0.8, c.y + Math.sin(angle) * c.radius * 0.8,
      1, hpR > 0.3 ? '#4af' : '#f44', 5, 20, 0.5, 1.2, 0.5, 2);
  }
}

function drawLightning() {
  if (!state.lightning_arcs) return;
  for (const arc of state.lightning_arcs) {
    const alpha = Math.min(1, arc.life * 8); // fast fade
    if (alpha <= 0) continue;

    const x1 = arc.x1, y1 = arc.y1, x2 = arc.x2, y2 = arc.y2;
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const segments = Math.max(4, Math.floor(dist / 20));

    // Draw 3 jagged lightning bolts (main + 2 branches)
    for (let bolt = 0; bolt < 3; bolt++) {
      const spread = bolt === 0 ? 15 : 10;
      const width = bolt === 0 ? 2.5 : 1.2;
      const boltAlpha = bolt === 0 ? alpha : alpha * 0.5;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const bx = x1 + dx * t + (Math.random() - 0.5) * spread;
        const by = y1 + dy * t + (Math.random() - 0.5) * spread;
        ctx.lineTo(bx, by);
      }
      ctx.lineTo(x2, y2);

      // Outer glow
      ctx.strokeStyle = `rgba(100, 180, 255, ${boltAlpha * 0.3})`;
      ctx.lineWidth = width + 4;
      ctx.stroke();

      // Mid
      ctx.strokeStyle = `rgba(150, 220, 255, ${boltAlpha * 0.6})`;
      ctx.lineWidth = width + 1.5;
      ctx.stroke();

      // Core (white-blue)
      ctx.strokeStyle = `rgba(220, 240, 255, ${boltAlpha})`;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    // Impact flash at enemy position
    ctx.fillStyle = `rgba(200, 230, 255, ${alpha * 0.4})`;
    ctx.beginPath(); ctx.arc(x2, y2, 12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    ctx.beginPath(); ctx.arc(x2, y2, 5, 0, Math.PI*2); ctx.fill();

    // Sparks at impact
    if (alpha > 0.5 && Math.random() < 0.5) {
      emit(x2, y2, 2, '#adf', 30, 80, 0.1, 0.2, 0.5, 1.5);
    }
  }

  // Core flash when lightning active
  if (state.lightning_arcs.length > 0 && state.lightning_arcs.some(a => a.life > 0.1)) {
    const c = state.core;
    ctx.fillStyle = `rgba(200, 230, 255, 0.15)`;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.radius * 2, 0, Math.PI*2); ctx.fill();
  }
}

function drawTowers() {
  // Draw energy beams from core to each tower
  for (const t of state.towers) {
    const e = t.energy || 1;
    ctx.beginPath(); ctx.moveTo(state.core.x, state.core.y); ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = `rgba(80, 160, 255, ${e * 0.06})`;
    ctx.lineWidth = e * 1.5;
    ctx.stroke();
  }

  for (const t of state.towers) {
    const isH = hoveredTower && hoveredTower.id === t.id;
    const isD = draggingTower && draggingTower.id === t.id;
    if (isD) continue;
    const lc = state.spirit_links.filter(l => l.tower_a === t.id || l.tower_b === t.id).length;
    const e = t.energy || 1; // energy multiplier

    // Spirit glow — manual: semi-transparent circle
    if (lc > 0) {
      const gr = 14 + lc * 6 + Math.sin(animTime * 3) * 3;
      ctx.fillStyle = `rgba(160,100,255,${0.08 + lc * 0.03})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, gr, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(160,100,255,${0.15 + lc * 0.04})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, gr * 0.5, 0, Math.PI*2); ctx.fill();
    }

    // Range (faint, brighter on hover)
    ctx.beginPath(); ctx.arc(t.x, t.y, t.range, 0, Math.PI*2);
    let rgb;
    switch (t.kind) { case 'Gatling': rgb='0,255,0'; break; case 'Cannon': rgb='255,136,0'; break; case 'Laser': rgb='255,0,255'; break; case 'Hive': rgb='0,200,255'; break; }
    ctx.fillStyle = `rgba(${rgb},${isH ? 0.08 : 0.015})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},${isH ? 0.3 : 0.06})`; ctx.lineWidth = isH ? 1.5 : 0.5; ctx.stroke();

    // Tower body — TECHNO MACHINES
    let color, size = 10;
    ctx.globalAlpha = 0.4 + e * 0.6;
    switch (t.kind) {
      case 'Gatling': {
        color = '#0f0'; size = 9;
        // Manual glow — semi-transparent circle behind
        ctx.fillStyle = `rgba(0,255,0,${(isH ? 0.15 : 0.08) * e})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, size + 6, 0, Math.PI*2); ctx.fill();
        // Base platform
        ctx.fillStyle = '#1a3a1a';
        ctx.fillRect(t.x - size, t.y - size, size*2, size*2);
        // Rotating barrel
        const bAng = animTime * 8;
        ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2;
        for (let b = 0; b < 3; b++) {
          const ba = bAng + b * Math.PI * 2/3;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          ctx.lineTo(t.x + Math.cos(ba) * size * 1.1, t.y + Math.sin(ba) * size * 1.1);
          ctx.stroke();
        }
        // Center dot
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(t.x, t.y, 3, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = isH ? '#fff' : `rgba(0,255,0,${0.3 + e * 0.3})`;
        ctx.lineWidth = 1; ctx.strokeRect(t.x - size, t.y - size, size*2, size*2);
        break;
      }
      case 'Cannon': {
        color = '#f80'; size = 11;
        // Manual glow
        ctx.fillStyle = `rgba(255,136,0,${(isH ? 0.15 : 0.08) * e})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, size + 6, 0, Math.PI*2); ctx.fill();
        // Heavy base — double diamond
        ctx.fillStyle = '#3a2a0a';
        ctx.beginPath();
        ctx.moveTo(t.x, t.y-size); ctx.lineTo(t.x+size, t.y); ctx.lineTo(t.x, t.y+size); ctx.lineTo(t.x-size, t.y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f80';
        ctx.beginPath();
        ctx.moveTo(t.x, t.y-size*0.5); ctx.lineTo(t.x+size*0.5, t.y); ctx.lineTo(t.x, t.y+size*0.5); ctx.lineTo(t.x-size*0.5, t.y);
        ctx.closePath(); ctx.fill();
        // Cannon barrel
        ctx.strokeStyle = '#fa0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + size * 0.8, t.y); ctx.stroke();
        ctx.strokeStyle = isH ? '#fff' : `rgba(255,136,0,${0.3 + e * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(t.x, t.y-size); ctx.lineTo(t.x+size, t.y); ctx.lineTo(t.x, t.y+size); ctx.lineTo(t.x-size, t.y); ctx.closePath(); ctx.stroke();
        break;
      }
      case 'Laser': {
        color = '#f0f'; size = 9;
        // Manual glow
        ctx.fillStyle = `rgba(255,0,255,${(isH ? 0.15 : 0.08) * e})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, size + 6, 0, Math.PI*2); ctx.fill();
        // Sleek triangle base
        ctx.fillStyle = '#2a0a2a';
        ctx.beginPath();
        ctx.moveTo(t.x, t.y - size * 1.1); ctx.lineTo(t.x + size, t.y + size * 0.8); ctx.lineTo(t.x - size, t.y + size * 0.8);
        ctx.closePath(); ctx.fill();
        // Lens at top — pulsing
        const lensR = 3 + Math.sin(animTime * 6) * 1;
        ctx.fillStyle = '#f0f';
        ctx.beginPath(); ctx.arc(t.x, t.y - size * 0.3, lensR, 0, Math.PI*2); ctx.fill();
        // Tech lines
        ctx.strokeStyle = `rgba(255,0,255,${0.4 + e * 0.3})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(t.x - size*0.5, t.y + size*0.4); ctx.lineTo(t.x, t.y - size*0.3); ctx.lineTo(t.x + size*0.5, t.y + size*0.4); ctx.stroke();
        ctx.strokeStyle = isH ? '#fff' : `rgba(255,0,255,${0.3 + e * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(t.x, t.y - size * 1.1); ctx.lineTo(t.x + size, t.y + size * 0.8); ctx.lineTo(t.x - size, t.y + size * 0.8); ctx.closePath(); ctx.stroke();
        break;
      }
      case 'Hive': {
        color = '#0cf'; size = 11;
        // Manual glow
        ctx.fillStyle = `rgba(0,200,255,${(isH ? 0.15 : 0.08) * e})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, size + 6, 0, Math.PI*2); ctx.fill();
        // Hexagonal platform
        ctx.fillStyle = '#0a2a3a';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI/3 * i - Math.PI/6;
          const px = t.x + Math.cos(a) * size, py = t.y + Math.sin(a) * size;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        // Inner hex
        ctx.fillStyle = '#0cf';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI/3 * i - Math.PI/6 + animTime * 0.5;
          const px = t.x + Math.cos(a) * size * 0.45, py = t.y + Math.sin(a) * size * 0.45;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        // Outer border
        ctx.strokeStyle = isH ? '#fff' : `rgba(0,200,255,${0.3 + e * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI/3 * i - Math.PI/6;
          const px = t.x + Math.cos(a) * size, py = t.y + Math.sin(a) * size;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
        break;
      }
    }
    ctx.globalAlpha = 1;

    // Muzzle flash — if the tower just fired (fire_timer very low)
    if (t.fire_timer !== undefined && t.fire_timer < 0.05) {
      const flashSize = 8 + Math.random() * 4;
      let flashColor;
      switch (t.kind) {
        case 'Gatling': flashColor = 'rgba(255,255,0,0.4)'; break;
        case 'Cannon': flashColor = 'rgba(255,136,0,0.5)'; break;
        case 'Laser': flashColor = 'rgba(255,0,255,0.4)'; break;
        case 'Hive': flashColor = 'rgba(0,200,255,0.3)'; break;
        default: flashColor = 'rgba(255,255,255,0.3)';
      }
      ctx.fillStyle = flashColor;
      ctx.beginPath(); ctx.arc(t.x, t.y, flashSize, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(t.x, t.y, flashSize * 0.3, 0, Math.PI*2); ctx.fill();
    }

    // Level
    if (t.level > 1) {
      ctx.fillStyle = '#ff0'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.fillText('L' + t.level, t.x, t.y - 14);
    }
    // Spirit stars
    if (lc > 0) {
      ctx.fillStyle = '#a6f'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
      ctx.fillText('\u2726'.repeat(lc), t.x, t.y + size + 12);
    }
    // Power % on hover
    if (isH) {
      drawPowerLabel(t.x, t.y, e, size + (lc > 0 ? 20 : 10));
    }
  }
}

function drawEnemies() {
  const enemyCount = state.enemies.length;
  const simpleDraw = enemyCount > 40;

  for (const e of state.enemies) {
    const dx = state.core.x - e.x, dy = state.core.y - e.y;
    const d = Math.sqrt(dx*dx+dy*dy) || 1;
    const ang = Math.atan2(dy, dx);
    const s = e.size;
    const t = animTime + e.id * 0.5;

    // Record trail (color per enemy type)
    const tc = e.kind === 'Drone' ? [180,50,50] : e.kind === 'Fighter' ? [200,180,40] : [200,120,50];
    if (e.id % 2 === 0 || !simpleDraw) addTrail(e.x, e.y, tc[0], tc[1], tc[2]); // every other for perf

    // Trail — organic slime/ink trail
    if (!simpleDraw) {
      const trailLen = e.kind === 'Fighter' ? 4 : e.kind === 'Tank' ? 3 : 2;
      for (let i = trailLen; i > 0; i--) {
        const tx = e.x - (dx/d) * e.speed * 0.025 * i;
        const ty = e.y - (dy/d) * e.speed * 0.025 * i;
        ctx.globalAlpha = 0.08 / i;
        const trailColor = e.kind === 'Drone' ? '#a33' : e.kind === 'Fighter' ? '#993' : '#a63';
        ctx.fillStyle = trailColor;
        ctx.beginPath(); ctx.arc(tx, ty, s * (1 - i * 0.15), 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(ang);

    switch (e.kind) {
      case 'Drone': {
        if (simpleDraw) {
          // LOD: simple colored rect
          ctx.fillStyle = '#c33';
          ctx.fillRect(-s * 1.2, -s * 0.7, s * 2.4, s * 1.4);
        } else {
          // BUG / SCARAB — small scuttling insect
          // Manual glow
          ctx.fillStyle = 'rgba(255,68,68,0.12)';
          ctx.beginPath(); ctx.arc(0, 0, s * 1.8, 0, Math.PI*2); ctx.fill();
          // Body — oval
          ctx.fillStyle = '#c33';
          ctx.beginPath(); ctx.ellipse(0, 0, s * 1.2, s * 0.7, 0, 0, Math.PI*2); ctx.fill();
          // Head
          ctx.fillStyle = '#e44';
          ctx.beginPath(); ctx.arc(s * 0.8, 0, s * 0.4, 0, Math.PI*2); ctx.fill();
          // Eyes — two tiny dots
          ctx.fillStyle = '#ff0';
          ctx.fillRect(s * 0.9, -s * 0.25, 1.5, 1.5);
          ctx.fillRect(s * 0.9, s * 0.1, 1.5, 1.5);
          // Legs — 3 pairs, animated
          ctx.strokeStyle = '#a22'; ctx.lineWidth = 0.8;
          for (let leg = -1; leg <= 1; leg++) {
            const legAng = Math.sin(t * 12 + leg * 2) * 0.4;
            for (let side = -1; side <= 1; side += 2) {
              ctx.beginPath();
              ctx.moveTo(leg * s * 0.4, 0);
              ctx.lineTo(leg * s * 0.4 + Math.cos(legAng) * s * 0.6, side * (s * 0.6 + Math.sin(legAng) * s * 0.3));
              ctx.stroke();
            }
          }
        }
        break;
      }
      case 'Fighter': {
        if (simpleDraw) {
          // LOD: simple triangle
          ctx.fillStyle = '#cc4';
          ctx.beginPath();
          ctx.moveTo(s * 1.0, 0);
          ctx.lineTo(-s * 0.8, -s * 0.7);
          ctx.lineTo(-s * 0.8, s * 0.7);
          ctx.closePath(); ctx.fill();
        } else {
          // SQUID / OCTOPUS — fast, alien, tentacles
          // Manual glow
          ctx.fillStyle = 'rgba(255,255,0,0.1)';
          ctx.beginPath(); ctx.arc(0, 0, s * 1.8, 0, Math.PI*2); ctx.fill();
          // Mantle (body)
          ctx.fillStyle = '#cc4';
          ctx.beginPath();
          ctx.moveTo(s * 1.0, 0);
          ctx.quadraticCurveTo(s * 0.3, -s * 0.9, -s * 0.5, -s * 0.4);
          ctx.quadraticCurveTo(-s * 0.8, 0, -s * 0.5, s * 0.4);
          ctx.quadraticCurveTo(s * 0.3, s * 0.9, s * 1.0, 0);
          ctx.fill();
          // Eye — big, alien
          ctx.fillStyle = '#f00';
          ctx.beginPath(); ctx.arc(s * 0.3, 0, s * 0.25, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(s * 0.35, 0, s * 0.1, 0, Math.PI*2); ctx.fill();
          // Tentacles — 4 wavy
          ctx.strokeStyle = '#aa3'; ctx.lineWidth = 1.2;
          for (let tn = 0; tn < 4; tn++) {
            const baseY = (tn - 1.5) * s * 0.35;
            ctx.beginPath();
            ctx.moveTo(-s * 0.5, baseY);
            const wave1 = Math.sin(t * 8 + tn * 1.5) * s * 0.3;
            const wave2 = Math.sin(t * 6 + tn * 2.0) * s * 0.4;
            ctx.quadraticCurveTo(-s * 1.0, baseY + wave1, -s * 1.5, baseY + wave2);
            ctx.stroke();
          }
        }
        break;
      }
      case 'Tank': {
        if (simpleDraw) {
          // LOD: circle + outline
          ctx.fillStyle = '#b52';
          ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#e84'; ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // CRAB — big, armored, claws
          // Manual glow
          ctx.fillStyle = 'rgba(255,136,0,0.1)';
          ctx.beginPath(); ctx.arc(0, 0, s * 1.8, 0, Math.PI*2); ctx.fill();
          // Shell — large round
          ctx.fillStyle = '#b52';
          ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.8, 0, 0, Math.PI*2); ctx.fill();
          // Shell highlight
          ctx.fillStyle = 'rgba(232,132,68,0.4)';
          ctx.beginPath(); ctx.ellipse(-s*0.2, -s*0.1, s*0.4, s*0.3, 0, 0, Math.PI*2); ctx.fill();
          // Shell segments
          ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.5, 0, 0, Math.PI*2); ctx.stroke();
          // Eyes on stalks
          ctx.fillStyle = '#ff0';
          for (let side = -1; side <= 1; side += 2) {
            ctx.beginPath(); ctx.arc(s * 0.5, side * s * 0.5, 2.5, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#a63'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(s * 0.3, side * s * 0.3);
            ctx.lineTo(s * 0.5, side * s * 0.5); ctx.stroke();
          }
          // CLAWS — animated pinch
          const pinch = Math.sin(t * 3) * 0.15;
          ctx.fillStyle = '#c63'; ctx.strokeStyle = '#a42'; ctx.lineWidth = 1.5;
          for (let side = -1; side <= 1; side += 2) {
            ctx.save();
            ctx.translate(s * 0.7, side * s * 0.6);
            ctx.rotate(side * (0.3 + pinch));
            // Upper claw
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(s * 0.6, -s * 0.15);
            ctx.lineTo(s * 0.5, 0); ctx.lineTo(s * 0.6, s * 0.15);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
          }
          // Legs — 3 pairs
          ctx.strokeStyle = '#a63'; ctx.lineWidth = 1.5;
          for (let leg = 0; leg < 3; leg++) {
            const lx = -s * 0.2 - leg * s * 0.3;
            const legWave = Math.sin(t * 5 + leg * 1.8) * s * 0.2;
            for (let side = -1; side <= 1; side += 2) {
              ctx.beginPath();
              ctx.moveTo(lx, side * s * 0.5);
              ctx.quadraticCurveTo(lx - s*0.2, side * (s * 0.8 + legWave), lx - s*0.4, side * (s * 0.7 + legWave));
              ctx.stroke();
            }
          }

          // Damage smoke
          if (e.hp / e.max_hp < 0.5 && Math.random() < 0.2) {
            emit(e.x + (Math.random()-0.5)*s, e.y + (Math.random()-0.5)*s, 1, '#a63', 10, 30, 0.1, 0.3, 0.5, 1.5);
          }
        }
        break;
      }
    }
    ctx.restore();

    // HP bar
    const hpR = e.hp / e.max_hp;
    if (hpR < 1.0 || e.kind !== 'Drone') {
      const bw = Math.max(s * 2.5, 10), bh = e.kind === 'Drone' ? 2 : 3;
      ctx.fillStyle = 'rgba(60,0,0,0.8)'; ctx.fillRect(e.x - bw/2, e.y - s - 7, bw, bh);
      ctx.fillStyle = hpR > 0.5 ? '#0f0' : hpR > 0.25 ? '#ff0' : '#f00';
      ctx.fillRect(e.x - bw/2, e.y - s - 7, bw * hpR, bh);
    }
  }
}

function drawProjectiles() {
  for (const p of state.projectiles) {
    switch (p.kind) {
      case 'Gatling': {
        // Bright yellow tracer line (short trail from velocity)
        const trailX = p.x - (p.vx || 0) * 0.02;
        const trailY = p.y - (p.vy || 0) * 0.02;
        // Glow behind
        ctx.fillStyle = 'rgba(255,255,0,0.15)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
        // Tracer line
        ctx.beginPath(); ctx.moveTo(trailX, trailY); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(255,255,100,0.7)';
        ctx.lineWidth = 2; ctx.stroke();
        // Bullet body
        ctx.fillStyle = '#ff0'; ctx.fillRect(p.x - 1.5, p.y - 1, 3, 2);
        break;
      }
      case 'Cannon': {
        // FAT orange-red trail behind the shell
        const trailLen = 0.06;
        const tx1 = p.x - (p.vx || 0) * trailLen;
        const ty1 = p.y - (p.vy || 0) * trailLen;
        const tx2 = p.x - (p.vx || 0) * trailLen * 0.5;
        const ty2 = p.y - (p.vy || 0) * trailLen * 0.5;

        // Wide fading trail
        ctx.beginPath(); ctx.moveTo(tx1, ty1); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(255,80,0,0.25)'; ctx.lineWidth = 8; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(255,136,0,0.4)'; ctx.lineWidth = 5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(255,200,50,0.5)'; ctx.lineWidth = 2; ctx.stroke();

        // Shell glow — radial gradient (fiery meteor)
        const cg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        cg.addColorStop(0, 'rgba(255,255,150,0.8)');
        cg.addColorStop(0.3, 'rgba(255,200,50,0.5)');
        cg.addColorStop(0.6, 'rgba(255,100,0,0.2)');
        cg.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI*2); ctx.fill();

        // Shell body — bright core
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ff4';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        break;
      }
      case 'Laser': {
        const beamAlpha = Math.min(1, (p.lifetime || 1) * 8);
        // Thick outer beam
        ctx.beginPath(); ctx.moveTo(p.origin_x, p.origin_y); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = `rgba(255,0,255,${beamAlpha * 0.3})`;
        ctx.lineWidth = 6; ctx.stroke();
        // Mid beam
        ctx.beginPath(); ctx.moveTo(p.origin_x, p.origin_y); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = `rgba(255,100,255,${beamAlpha * 0.6})`;
        ctx.lineWidth = 3; ctx.stroke();
        // Thin white core
        ctx.beginPath(); ctx.moveTo(p.origin_x, p.origin_y); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = `rgba(255,255,255,${beamAlpha * 0.8})`;
        ctx.lineWidth = 1.2; ctx.stroke();

        // Lens flare / starburst at origin
        const flareSize = 8 * beamAlpha;
        ctx.strokeStyle = `rgba(255,200,255,${beamAlpha * 0.6})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const fa = (Math.PI / 4) * i + animTime * 2;
          ctx.beginPath();
          ctx.moveTo(p.origin_x + Math.cos(fa) * flareSize * 0.3, p.origin_y + Math.sin(fa) * flareSize * 0.3);
          ctx.lineTo(p.origin_x + Math.cos(fa) * flareSize, p.origin_y + Math.sin(fa) * flareSize);
          ctx.stroke();
        }
        // Bright dot at origin
        ctx.fillStyle = `rgba(255,255,255,${beamAlpha * 0.7})`;
        ctx.beginPath(); ctx.arc(p.origin_x, p.origin_y, 3, 0, Math.PI*2); ctx.fill();

        // Hit point
        ctx.fillStyle = `rgba(255,255,255,${beamAlpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI*2); ctx.fill();
        break;
      }
      case 'Core': {
        // Electric blue bolt with crackling zigzag
        const ox = p.origin_x !== undefined ? p.origin_x : p.x;
        const oy = p.origin_y !== undefined ? p.origin_y : p.y;

        // Glow behind bolt
        ctx.fillStyle = 'rgba(100,180,255,0.12)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size + 6, 0, Math.PI*2); ctx.fill();

        // Crackling zigzag lines from origin to bullet (2-3 jagged segments)
        const boltDx = p.x - ox, boltDy = p.y - oy;
        const boltDist = Math.sqrt(boltDx*boltDx + boltDy*boltDy);
        if (boltDist > 5) {
          const perpX = -boltDy / boltDist, perpY = boltDx / boltDist;
          for (let bolt = 0; bolt < 2; bolt++) {
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            const segments = 4 + bolt;
            for (let seg = 1; seg < segments; seg++) {
              const frac = seg / segments;
              const jitter = (Math.sin(animTime * 30 + bolt * 7 + seg * 3) * 0.5 + (Math.random() - 0.5) * 0.5) * 12;
              const sx = ox + boltDx * frac + perpX * jitter;
              const sy = oy + boltDy * frac + perpY * jitter;
              ctx.lineTo(sx, sy);
            }
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = bolt === 0 ? 'rgba(100,200,255,0.6)' : 'rgba(180,220,255,0.3)';
            ctx.lineWidth = bolt === 0 ? 1.5 : 0.8;
            ctx.stroke();
          }
        }

        // Core of the bolt — radial gradient
        const eg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size + 3);
        eg.addColorStop(0, 'rgba(200,240,255,0.9)');
        eg.addColorStop(0.4, 'rgba(100,180,255,0.4)');
        eg.addColorStop(1, 'rgba(30,80,200,0)');
        ctx.fillStyle = eg;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size + 3, 0, Math.PI*2); ctx.fill();

        // Bright center
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI*2); ctx.fill();
        break;
      }
      case 'EnemyShot': {
        // Red-orange fireball with trail
        const etx = p.x - (p.vx || 0) * 0.03;
        const ety = p.y - (p.vy || 0) * 0.03;
        // Trail
        ctx.beginPath(); ctx.moveTo(etx, ety); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(255,80,0,0.3)'; ctx.lineWidth = p.size * 2.5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(etx, ety); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(255,160,50,0.4)'; ctx.lineWidth = p.size * 1.5; ctx.stroke();
        // Outer glow
        ctx.fillStyle = 'rgba(255,68,68,0.2)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI*2); ctx.fill();
        // Fireball body
        ctx.fillStyle = '#f44';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        // Hot core
        ctx.fillStyle = '#fa8';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI*2); ctx.fill();
        break;
      }
      case 'PlayerShot': {
        // Cyan plasma bolt with trail
        const ptx = p.x - (p.vx || 0) * 0.025;
        const pty = p.y - (p.vy || 0) * 0.025;
        // Outer trail
        ctx.beginPath(); ctx.moveTo(ptx, pty); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.2)'; ctx.lineWidth = 6; ctx.stroke();
        // Inner trail
        ctx.beginPath(); ctx.moveTo(ptx, pty); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)'; ctx.lineWidth = 3; ctx.stroke();
        // Core trail
        ctx.beginPath(); ctx.moveTo(ptx, pty); ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(200, 255, 255, 0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
        // Glow
        ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI*2); ctx.fill();
        // Bolt body
        ctx.fillStyle = '#0ff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        // Hot white center
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI*2); ctx.fill();
        break;
      }
    }
  }
}

function drawHiveDrones() {
  if (!state.hive_drones) return;
  for (const d of state.hive_drones) {
    // Cyan engine trail behind the drone (2 trail segments)
    const trailAngle = (d.orbit_angle || 0) + Math.PI; // opposite direction
    for (let i = 1; i <= 2; i++) {
      const tx = d.x + Math.cos(trailAngle) * i * 4;
      const ty = d.y + Math.sin(trailAngle) * i * 4;
      ctx.fillStyle = `rgba(0, 200, 255, ${0.15 / i})`;
      ctx.beginPath(); ctx.arc(tx, ty, 3 - i * 0.5, 0, Math.PI*2); ctx.fill();
    }

    // Manual glow behind drone
    const glowColor = d.state === 'Attacking' ? 'rgba(255,136,0,0.15)' : 'rgba(0,200,255,0.12)';
    ctx.fillStyle = glowColor;
    ctx.beginPath(); ctx.arc(d.x, d.y, 8, 0, Math.PI*2); ctx.fill();

    // Drone body — small triangle
    const angle = d.orbit_angle || 0;
    ctx.save();
    ctx.translate(d.x, d.y);

    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-3, -3);
    ctx.lineTo(-1, 0);
    ctx.lineTo(-3, 3);
    ctx.closePath();
    ctx.fillStyle = d.state === 'Attacking' ? '#fa0' : d.state === 'Returning' ? '#0af' : '#0cf';
    ctx.fill();

    ctx.restore();

    // Attack line to target when close — electric arc
    if (d.state === 'Attacking' && d.target_enemy) {
      const enemy = state.enemies.find(e => e.id === d.target_enemy);
      if (enemy) {
        const adx = enemy.x - d.x, ady = enemy.y - d.y;
        const dist = Math.sqrt(adx*adx+ady*ady);
        if (dist < 20) {
          // Electric arc — jagged line
          const perpX = -ady / dist, perpY = adx / dist;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          const segs = 4;
          for (let i = 1; i < segs; i++) {
            const frac = i / segs;
            const jitter = (Math.sin(animTime * 40 + i * 5) + Math.random() - 0.5) * 5;
            ctx.lineTo(
              d.x + adx * frac + perpX * jitter,
              d.y + ady * frac + perpY * jitter
            );
          }
          ctx.lineTo(enemy.x, enemy.y);
          ctx.strokeStyle = `rgba(255, 200, 50, ${0.6 + Math.sin(animTime*10)*0.3})`;
          ctx.lineWidth = 1.2; ctx.stroke();
          // Thinner white core
          ctx.beginPath();
          ctx.moveTo(d.x, d.y); ctx.lineTo(enemy.x, enemy.y);
          ctx.strokeStyle = `rgba(255, 255, 200, ${0.3 + Math.sin(animTime*15)*0.2})`;
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    }
  }
}

function drawPlayerShip() {
  if (!state || !state.player) return;
  const p = state.player;

  if (!p.alive) {
    const c = state.core;
    if (p.respawn_timer > 0) {
      // Pulsing respawn indicator
      const ra = 0.3 + Math.sin(animTime * 4) * 0.15;
      ctx.fillStyle = `rgba(0,255,200,${ra})`;
      ctx.beginPath(); ctx.arc(c.x + 60, c.y, 15, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(0,255,200,0.5)`;
      ctx.font = '13px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`RESPAWN ${p.respawn_timer.toFixed(1)}s`, c.x + 60, c.y - 25);
    }
    return;
  }

  const s = 18; // bigger ship
  const ep = p.engine_phase || animTime * 12;

  // === ENGINE EXHAUST (animated flame) ===
  const exLen = 12 + Math.sin(ep) * 5 + Math.sin(ep * 2.3) * 3;
  const exW = 5 + Math.sin(ep * 1.7) * 2;
  for (let flame = 2; flame >= 0; flame--) {
    const fl = exLen * (1 + flame * 0.4);
    const fw = exW * (1 + flame * 0.3);
    const fa = [0.06, 0.1, 0.2][flame];
    const fc = [`rgba(0,100,200,${fa})`, `rgba(0,200,255,${fa})`, `rgba(150,255,255,${fa})`][flame];
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    ctx.fillStyle = fc;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -fw); ctx.lineTo(-s * 0.6 - fl, 0); ctx.lineTo(-s * 0.6, fw);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Engine particles + trail (longer, brighter)
  const ex = p.x - Math.cos(p.angle) * s * 0.8;
  const ey = p.y - Math.sin(p.angle) * s * 0.8;
  addTrail(ex, ey, 50, 230, 255); // bright cyan exhaust
  addTrail(ex + (Math.random()-0.5)*4, ey + (Math.random()-0.5)*4, 30, 200, 255); // jittered exhaust
  addTrail(p.x, p.y, 0, 180, 230); // body trail
  if (Math.random() < 0.6) {
    emit(ex, ey, 1, '#0cf', 20, 60, 0.1, 0.3, 0.5, 2);
  }

  // === INVULNERABILITY SHIELD ===
  if (p.invuln_timer > 0) {
    const sa = 0.2 + Math.sin(animTime * 15) * 0.15;
    ctx.strokeStyle = `rgba(0, 255, 200, ${sa})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, s + 8, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = `rgba(0, 255, 200, ${sa * 0.2})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, s + 8, 0, Math.PI*2); ctx.fill();
  }

  // === SHIP BODY ===
  ctx.save();
  ctx.translate(p.x, p.y); ctx.rotate(p.angle);

  // Glow aura
  ctx.fillStyle = 'rgba(0, 255, 200, 0.06)';
  ctx.beginPath(); ctx.arc(0, 0, s * 2, 0, Math.PI*2); ctx.fill();

  // Wings (outer)
  ctx.fillStyle = '#0a3a3a';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, 0);
  ctx.lineTo(-s * 0.7, -s * 1.1);
  ctx.lineTo(-s * 0.9, -s * 0.8);
  ctx.lineTo(-s * 0.3, 0);
  ctx.lineTo(-s * 0.9, s * 0.8);
  ctx.lineTo(-s * 0.7, s * 1.1);
  ctx.closePath(); ctx.fill();
  // Wing glow lines
  ctx.strokeStyle = `rgba(0, 200, 255, ${0.3 + Math.sin(ep * 0.5) * 0.1})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-s*0.7, -s*1.1); ctx.lineTo(s*0.3, 0); ctx.moveTo(-s*0.7, s*1.1); ctx.lineTo(s*0.3, 0); ctx.stroke();

  // Main hull
  ctx.fillStyle = '#0db';
  ctx.beginPath();
  ctx.moveTo(s * 1.3, 0);
  ctx.lineTo(s * 0.2, -s * 0.55);
  ctx.lineTo(-s * 0.5, -s * 0.35);
  ctx.lineTo(-s * 0.5, s * 0.35);
  ctx.lineTo(s * 0.2, s * 0.55);
  ctx.closePath(); ctx.fill();

  // Hull highlight
  ctx.fillStyle = 'rgba(150, 255, 240, 0.3)';
  ctx.beginPath();
  ctx.moveTo(s * 1.3, 0);
  ctx.lineTo(s * 0.2, -s * 0.55);
  ctx.lineTo(-s * 0.1, -s * 0.2);
  ctx.lineTo(s * 0.5, 0);
  ctx.closePath(); ctx.fill();

  // Cockpit
  ctx.fillStyle = '#aff';
  ctx.beginPath(); ctx.ellipse(s * 0.4, 0, s * 0.2, s * 0.12, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(s * 0.45, -s*0.03, s * 0.08, s * 0.05, 0, 0, Math.PI*2); ctx.fill();

  // Weapon hardpoints glow
  const wpGlow = 0.2 + Math.sin(ep * 2) * 0.1;
  ctx.fillStyle = `rgba(0, 255, 255, ${wpGlow})`;
  ctx.fillRect(s * 0.6, -s * 0.15, 3, 2);
  ctx.fillRect(s * 0.6, s * 0.05, 3, 2);

  ctx.restore();

  // === HP BAR ===
  const hpR = p.hp / p.max_hp;
  const bw = 30;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(p.x - bw/2, p.y - s - 12, bw, 4);
  ctx.fillStyle = hpR > 0.5 ? '#0fc' : hpR > 0.25 ? '#ff0' : '#f44';
  ctx.fillRect(p.x - bw/2, p.y - s - 12, bw * hpR, 4);

  // === LEVEL + XP ===
  ctx.fillStyle = '#0fc'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`L${p.level}`, p.x, p.y + s + 14);
  if (p.xp_to_next > 0) {
    const xpR = p.xp / p.xp_to_next;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(p.x - bw/2, p.y + s + 16, bw, 2);
    ctx.fillStyle = '#0fc'; ctx.fillRect(p.x - bw/2, p.y + s + 16, bw * xpR, 2);
  }

  // === SHOT SPREAD INDICATOR ===
  if (p.shot_spread > 1) {
    ctx.fillStyle = 'rgba(0,255,200,0.4)'; ctx.font = '8px monospace';
    ctx.fillText(`x${p.shot_spread}`, p.x, p.y + s + 24);
  }

  // === HEALING ===
  const hdx = p.x - state.core.x, hdy = p.y - state.core.y;
  const distCore = Math.sqrt(hdx*hdx+hdy*hdy);
  if (distCore < state.core.radius + 60 && hpR < 1) {
    // Healing beam from core to ship
    ctx.strokeStyle = `rgba(0, 255, 200, ${0.15 + Math.sin(animTime * 5) * 0.1})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(state.core.x, state.core.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = `rgba(0, 255, 200, ${0.3 + Math.sin(animTime * 4) * 0.15})`;
    ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('HEALING', p.x, p.y - s - 18);
    // Healing particles
    if (Math.random() < 0.3) emit(p.x + (Math.random()-0.5)*10, p.y + (Math.random()-0.5)*10, 1, '#0fc', 5, 15, 0.2, 0.4, 0.5, 1.5);
  }

  // === UPGRADE COST (show near ship when alive) ===
  if (p.upgrade_cost && state.money >= p.upgrade_cost) {
    ctx.fillStyle = 'rgba(0,255,200,0.2)'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`[U] Upgrade $${p.upgrade_cost}`, p.x, p.y + s + 32);
  }
}

function calcPower(gx, gy) {
  const edx = gx - state.core.x, edy = gy - state.core.y;
  const eDist = Math.sqrt(edx*edx + edy*edy);
  const eMaxDist = state.zone_x_max - state.core.x;
  return Math.max(0.3, 1.0 - (eDist / eMaxDist) * 0.7);
}

function drawPowerLabel(gx, gy, power, yOffset) {
  const pct = Math.round(power * 100);
  const col = pct >= 80 ? '#4af' : pct >= 50 ? '#ff0' : '#f44';
  ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = col;
  ctx.fillText(`Power ${pct}%`, gx, gy + yOffset);
  // Power bar
  const bw = 30;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(gx - bw/2, gy + yOffset + 3, bw, 3);
  ctx.fillStyle = col; ctx.fillRect(gx - bw/2, gy + yOffset + 3, bw * power, 3);
}

function drawGhost() {
  if (draggingTower) {
    const gs = state.grid_size;
    const gx = Math.round(mouseX/gs)*gs, gy = Math.round(mouseY/gs)*gs;
    const power = calcPower(gx, gy);
    // Energy beam
    ctx.beginPath(); ctx.moveTo(state.core.x, state.core.y); ctx.lineTo(gx, gy);
    ctx.strokeStyle = `rgba(100,200,255,${power * 0.15})`; ctx.lineWidth = 1;
    ctx.setLineDash([3,6]); ctx.stroke(); ctx.setLineDash([]);
    // Ghost tower
    ctx.globalAlpha = 0.2 + power * 0.3; ctx.fillStyle = '#ff0';
    ctx.fillRect(gx-8, gy-8, 16, 16); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(gx, gy, draggingTower.range, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
    // Power label
    drawPowerLabel(gx, gy, power, -16);
    return;
  }
  if (hoveredTower || !placementCheck || !selectedKind) return;
  const pc = placementCheck, gx = pc.snapped_x, gy = pc.snapped_y;
  let range = selectedKind === 'Gatling' ? 100 : selectedKind === 'Cannon' ? 170 : selectedKind === 'Hive' ? 250 : 70;

  // Calculate energy at this position
  const edx = gx - state.core.x, edy = gy - state.core.y;
  const eDist = Math.sqrt(edx*edx + edy*edy);
  const eMaxDist = state.zone_x_max - state.core.x;
  const energy = Math.max(0.3, 1.0 - (eDist / eMaxDist) * 0.7);
  const energyPct = Math.round(energy * 100);

  // Energy beam line from core to ghost position
  ctx.beginPath(); ctx.moveTo(state.core.x, state.core.y); ctx.lineTo(gx, gy);
  const beamAlpha = energy * 0.15;
  ctx.strokeStyle = `rgba(100, 200, 255, ${beamAlpha})`;
  ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.stroke(); ctx.setLineDash([]);

  // Range circle (scaled by energy opacity)
  ctx.beginPath(); ctx.arc(gx, gy, range, 0, Math.PI*2);
  const bad = pc.overlap_count >= 3;
  ctx.strokeStyle = pc.valid ? `rgba(0,255,0,${0.15 + energy*0.1})` : bad ? 'rgba(255,0,0,0.3)' : 'rgba(255,255,0,0.2)';
  ctx.fillStyle = pc.valid ? `rgba(0,255,0,${0.01 + energy*0.02})` : bad ? 'rgba(255,0,0,0.05)' : 'rgba(255,255,0,0.02)';
  ctx.lineWidth = 1; ctx.setLineDash([4,4]); ctx.stroke(); ctx.fill(); ctx.setLineDash([]);

  // Ghost tower (brightness = energy)
  ctx.globalAlpha = 0.2 + energy * 0.3;
  ctx.fillStyle = pc.valid ? '#0f0' : bad ? '#f00' : '#ff0';
  ctx.fillRect(gx-6, gy-6, 12, 12); ctx.globalAlpha = 1;

  // Power label
  drawPowerLabel(gx, gy, energy, -16);

  if (!pc.valid) {
    ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = bad ? '#f44' : '#ff0';
    const msg = bad ? `MAX 3 OVERLAP` : !pc.in_zone ? 'OUT OF ZONE' : !pc.has_slot ? 'NO SLOTS [B]' : 'NO MONEY';
    ctx.fillText(msg, gx, gy + 24);
  }
}

function updateHud() {
  document.getElementById('hud-wave').textContent = state.wave.number;
  document.getElementById('hud-hp').textContent = Math.ceil(state.core.hp);
  document.getElementById('hud-score').textContent = state.score;
  document.getElementById('hud-money').textContent = state.money;
  document.getElementById('hud-towers').textContent = `${state.towers.length}/${state.max_towers}`;
  document.getElementById('hud-speed').textContent = `x${state.speed_multiplier}`;
  // Ship HUD
  const shipEl = document.getElementById('hud-ship');
  if (shipEl && state.player) {
    const p = state.player;
    if (p.alive) {
      shipEl.innerHTML = `<span style="color:#0fc">SHIP</span> L${p.level} HP:${Math.ceil(p.hp)}/${Math.ceil(p.max_hp)}`;
    } else {
      shipEl.innerHTML = `<span style="color:#f44">SHIP DOWN</span> ${p.respawn_timer.toFixed(1)}s`;
    }
  }
}
