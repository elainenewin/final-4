/* ============================================================
   CUBETIMER — script.js
   Timer logic, sound, stats, history, confetti
   ============================================================ */

'use strict';

// ─── STATE ───────────────────────────────────────────────────
const state = {
  phase: 'idle',   // idle | holding | running | stopped
  startTime: null,
  elapsed: 0,
  rafId: null,
  solves: [],
  muted: false,
  audioCtx: null,
};

// Load persisted solves
try {
  const saved = localStorage.getItem('cubetimer_solves');
  if (saved) state.solves = JSON.parse(saved);
} catch (_) {}

// ─── DOM REFS ────────────────────────────────────────────────
const timerDisplay  = document.getElementById('timer-display');
const timerRing     = document.getElementById('timer-ring');
const timerStatus   = document.getElementById('timer-status');
const instructionEl = document.getElementById('instruction-card');
const instructionTx = document.getElementById('instruction-text');
const solveList     = document.getElementById('solve-list');
const clearBtn      = document.getElementById('clear-btn');
const muteBtn       = document.getElementById('mute-btn');
const muteIcon      = document.getElementById('mute-icon');
const themeBtn      = document.getElementById('theme-btn');
const themeIcon     = document.getElementById('theme-icon');
const confCanvas    = document.getElementById('confetti-canvas');
const statBest      = document.getElementById('stat-best');
const statAo5       = document.getElementById('stat-ao5');
const statAo12      = document.getElementById('stat-ao12');
const statMean      = document.getElementById('stat-mean');
const touchTarget   = document.getElementById('touch-target');

// ─── AUDIO ENGINE ────────────────────────────────────────────
function getAudioCtx() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioCtx;
}

function playTone({ freq = 440, type = 'sine', duration = 0.12, gain = 0.25, attack = 0.01, decay = 0.05 } = {}) {
  if (state.muted) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch (_) {}
}

// UNO-style card flip sound (chord-ish)
function soundReady() {
  playTone({ freq: 523, type: 'triangle', duration: 0.14, gain: 0.2 });
  setTimeout(() => playTone({ freq: 659, type: 'triangle', duration: 0.14, gain: 0.2 }), 60);
}

// Start: punchy click
function soundStart() {
  playTone({ freq: 880, type: 'square', duration: 0.06, gain: 0.15 });
  setTimeout(() => playTone({ freq: 1100, type: 'square', duration: 0.06, gain: 0.1 }), 40);
}

// Stop: satisfying pop
function soundStop() {
  playTone({ freq: 660, type: 'sine', duration: 0.18, gain: 0.3 });
  setTimeout(() => playTone({ freq: 440, type: 'sine', duration: 0.18, gain: 0.2 }), 60);
  setTimeout(() => playTone({ freq: 330, type: 'sine', duration: 0.2, gain: 0.15 }), 120);
}

// PB: fanfare arpeggio
function soundPB() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    setTimeout(() => playTone({ freq: f, type: 'triangle', duration: 0.25, gain: 0.25 }), i * 80);
  });
}

// ─── TIMER FORMATTING ────────────────────────────────────────
function formatTime(ms) {
  const s = ms / 1000;
  if (s < 60) return s.toFixed(2);
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(2).padStart(5, '0');
  return `${m}:${rest}`;
}

// ─── TIMER LOOP ──────────────────────────────────────────────
function tick() {
  state.elapsed = performance.now() - state.startTime;
  timerDisplay.textContent = formatTime(state.elapsed);
  state.rafId = requestAnimationFrame(tick);
}

// ─── PHASE TRANSITIONS ───────────────────────────────────────
function setPhase(phase) {
  state.phase = phase;

  // Remove all state classes
  timerRing.classList.remove('state-ready', 'state-running', 'state-pb');
  instructionEl.classList.remove('ready-state', 'running-state');

  if (phase === 'idle') {
    timerStatus.textContent = 'ready';
    instructionTx.innerHTML = 'Hold <kbd>SPACE</kbd> to get ready';

  } else if (phase === 'holding') {
    timerRing.classList.add('state-ready');
    instructionEl.classList.add('ready-state');
    timerStatus.textContent = 'release!';
    instructionTx.textContent = 'Release to start ✓';
    timerDisplay.textContent = '0.00';
    soundReady();

  } else if (phase === 'running') {
    timerRing.classList.add('state-running');
    instructionEl.classList.add('running-state');
    timerStatus.textContent = 'solving...';
    instructionTx.textContent = 'Press SPACE to stop';
    state.startTime = performance.now();
    state.elapsed = 0;
    soundStart();
    state.rafId = requestAnimationFrame(tick);

  } else if (phase === 'stopped') {
    cancelAnimationFrame(state.rafId);
    timerStatus.textContent = 'done!';
    instructionTx.innerHTML = 'Hold <kbd>SPACE</kbd> for next solve';
    soundStop();
    saveSolve(state.elapsed);
  }
}

// ─── INPUT HANDLING ──────────────────────────────────────────
let holdTimeout = null;

function onPressStart() {
  if (state.phase === 'idle' || state.phase === 'stopped') {
    // Start hold → ready
    holdTimeout = setTimeout(() => {
      setPhase('holding');
    }, 150);

  } else if (state.phase === 'running') {
    setPhase('stopped');
  }
}

function onPressEnd() {
  clearTimeout(holdTimeout);
  if (state.phase === 'holding') {
    setPhase('running');
  }
}

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    onPressStart();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    onPressEnd();
  }
});

// Touch / pointer
let pointerDown = false;
document.addEventListener('pointerdown', (e) => {
  // Ignore clicks on buttons
  if (e.target.closest('button, .solve-item')) return;
  pointerDown = true;
  onPressStart();
});

document.addEventListener('pointerup', () => {
  if (!pointerDown) return;
  pointerDown = false;
  onPressEnd();
});

// ─── SAVE SOLVE ──────────────────────────────────────────────
function saveSolve(ms) {
  const solve = {
    id: Date.now().toString(),
    time: Math.round(ms) / 1000,
    date: new Date().toISOString(),
  };

  state.solves.unshift(solve);
  persistSolves();

  const isPB = isPersonalBest(solve);
  if (isPB) {
    onNewPB();
  } else {
    // Pop animation
    timerRing.classList.add('state-pb');
    setTimeout(() => timerRing.classList.remove('state-pb'), 500);
  }

  renderSolveList();
  updateStats();
}

function isPersonalBest(solve) {
  if (state.solves.length <= 1) return true;
  const best = Math.min(...state.solves.slice(1).map(s => s.time));
  return solve.time < best;
}

function onNewPB() {
  timerRing.classList.add('state-pb');
  setTimeout(() => timerRing.classList.remove('state-pb'), 600);
  soundPB();
  launchConfetti();
}

function persistSolves() {
  try {
    localStorage.setItem('cubetimer_solves', JSON.stringify(state.solves));
  } catch (_) {}
}

// ─── STATS ───────────────────────────────────────────────────
function ao(n) {
  if (state.solves.length < n) return null;
  const times = state.solves.slice(0, n).map(s => s.time).sort((a, b) => a - b);
  // Trim best and worst for n >= 5
  const trimmed = n >= 5 ? times.slice(1, -1) : times;
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function updateStats() {
  const times = state.solves.map(s => s.time);
  const best = times.length ? Math.min(...times).toFixed(2) : null;
  const ao5Val = ao(5);
  const ao12Val = ao(12);
  const mean = times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2) : null;

  statBest.textContent  = best     ? best                 : '--';
  statAo5.textContent   = ao5Val   ? ao5Val.toFixed(2)    : '--';
  statAo12.textContent  = ao12Val  ? ao12Val.toFixed(2)   : '--';
  statMean.textContent  = mean     ? mean                 : '--';
}

// ─── SOLVE LIST RENDER ───────────────────────────────────────
function renderSolveList() {
  if (state.solves.length === 0) {
    solveList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⏱️</span>
        <p>No solves yet!<br/>Press Space to start.</p>
      </div>`;
    return;
  }

  const bestTime = Math.min(...state.solves.map(s => s.time));

  solveList.innerHTML = state.solves.map((solve, i) => {
    const isPB = solve.time === bestTime;
    const timeStr = new Date(solve.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="solve-item ${isPB ? 'is-pb' : ''}" data-id="${solve.id}">
        <span class="solve-rank">#${i + 1}</span>
        <span class="solve-time">${solve.time.toFixed(2)}</span>
        ${isPB ? '<span class="pb-badge">PB!</span>' : ''}
        <span class="solve-date">${timeStr}</span>
        <button class="solve-delete" data-id="${solve.id}" title="Delete">✕</button>
      </div>`;
  }).join('');
}

solveList.addEventListener('click', (e) => {
  const btn = e.target.closest('.solve-delete');
  if (!btn) return;
  const id = btn.dataset.id;
  state.solves = state.solves.filter(s => s.id !== id);
  persistSolves();
  renderSolveList();
  updateStats();
});

clearBtn.addEventListener('click', () => {
  if (state.solves.length === 0) return;
  if (!confirm('Clear all solves?')) return;
  state.solves = [];
  persistSolves();
  renderSolveList();
  updateStats();
  setPhase('idle');
  timerDisplay.textContent = '0.00';
});

// ─── THEME TOGGLE ─────────────────────────────────────────────
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
  try { localStorage.setItem('cubetimer_theme', theme); } catch (_) {}
}

const savedTheme = (() => { try { return localStorage.getItem('cubetimer_theme'); } catch (_) { return null; } })();
setTheme(savedTheme || 'dark');

themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

// ─── MUTE TOGGLE ─────────────────────────────────────────────
muteBtn.addEventListener('click', () => {
  state.muted = !state.muted;
  muteIcon.textContent = state.muted ? '🔇' : '🔊';
  try { localStorage.setItem('cubetimer_muted', state.muted); } catch (_) {}
});

const savedMuted = (() => { try { return localStorage.getItem('cubetimer_muted') === 'true'; } catch (_) { return false; } })();
state.muted = savedMuted;
muteIcon.textContent = state.muted ? '🔇' : '🔊';

// ─── CONFETTI ────────────────────────────────────────────────
const confCtx = confCanvas.getContext('2d');
let confettiParticles = [];
let confRafId = null;

function resizeConfCanvas() {
  confCanvas.width  = window.innerWidth;
  confCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfCanvas);
resizeConfCanvas();

const CONF_COLORS = ['#B90000','#0045AD','#009B48','#FFD500','#FF5900','#ffffff'];

function launchConfetti() {
  confettiParticles = Array.from({ length: 90 }, () => ({
    x: Math.random() * confCanvas.width,
    y: -10 - Math.random() * 100,
    w: 8 + Math.random() * 8,
    h: 4 + Math.random() * 4,
    color: CONF_COLORS[Math.floor(Math.random() * CONF_COLORS.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: 3 + Math.random() * 5,
    rot: Math.random() * Math.PI * 2,
    rSpeed: (Math.random() - 0.5) * 0.2,
    alpha: 1,
  }));

  if (confRafId) cancelAnimationFrame(confRafId);
  animateConfetti();
}

function animateConfetti() {
  confCtx.clearRect(0, 0, confCanvas.width, confCanvas.height);

  confettiParticles = confettiParticles.filter(p => p.alpha > 0.02);

  confettiParticles.forEach(p => {
    p.x   += p.vx;
    p.y   += p.vy;
    p.vy  += 0.12;   // gravity
    p.rot += p.rSpeed;
    if (p.y > confCanvas.height * 0.7) p.alpha -= 0.03;

    confCtx.save();
    confCtx.globalAlpha = p.alpha;
    confCtx.translate(p.x, p.y);
    confCtx.rotate(p.rot);
    confCtx.fillStyle = p.color;
    confCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    confCtx.restore();
  });

  if (confettiParticles.length > 0) {
    confRafId = requestAnimationFrame(animateConfetti);
  } else {
    confCtx.clearRect(0, 0, confCanvas.width, confCanvas.height);
  }
}

// ─── INIT ────────────────────────────────────────────────────
renderSolveList();
updateStats();

// Prevent context menu on long press (mobile)
document.addEventListener('contextmenu', (e) => e.preventDefault());