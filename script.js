/* ─────────────────────────────────────────────────────────────
   CubeFlow — script.js
   ───────────────────────────────────────────────────────────── */

// ─── State ────────────────────────────────────────────────────
let solves   = [];
let timerInterval = null;
let startTime     = 0;
let isRunning     = false;
let isHolding     = false;
let holdTimeout   = null;
let currentScramble = '';

const HOLD_DELAY = 300; // ms to hold space before starting

// ─── DOM ──────────────────────────────────────────────────────
const timerDisplay  = document.getElementById('timerDisplay');
const timerStatus   = document.getElementById('timerStatus');
const timerHint     = document.getElementById('timerHint');
const timerRing     = document.querySelector('.timer-ring');
const scrambleEl    = document.getElementById('scramble');
const newScrambleBtn= document.getElementById('newScrambleBtn');
const bestTimeEl    = document.getElementById('bestTime');
const lastTimeEl    = document.getElementById('lastTime');
const avgTimeEl     = document.getElementById('avgTime');
const solveCountEl  = document.getElementById('solveCount');
const historyList   = document.getElementById('historyList');

// ─── Scramble Generator ───────────────────────────────────────
const FACES = ['R', 'L', 'U', 'D', 'F', 'B'];
const MODS  = ['', "'", '2'];

// Opposite faces — avoid same or opposite face back-to-back
const OPPOSITE = { R:'L', L:'R', U:'D', D:'U', F:'B', B:'F' };

function generateScramble(length = 20) {
  const moves = [];
  let lastFace = '';
  let secondLastFace = '';

  while (moves.length < length) {
    let face;
    let attempts = 0;
    do {
      face = FACES[Math.floor(Math.random() * FACES.length)];
      attempts++;
    } while (
      attempts < 20 &&
      (face === lastFace ||
       (face === OPPOSITE[lastFace] && face === secondLastFace))
    );

    const mod = MODS[Math.floor(Math.random() * MODS.length)];
    moves.push(face + mod);
    secondLastFace = lastFace;
    lastFace = face;
  }
  return moves;
}

function renderScramble(moves) {
  scrambleEl.innerHTML = moves.map(m => {
    const face = m[0];
    return `<span class="move-${face}">${m}</span>`;
  }).join(' ');
}

function newScramble() {
  scrambleEl.classList.add('updating');
  setTimeout(() => {
    const moves = generateScramble();
    currentScramble = moves.join(' ');
    renderScramble(moves);
    scrambleEl.classList.remove('updating');
  }, 150);
}

newScrambleBtn.addEventListener('click', newScramble);

// ─── Timer ────────────────────────────────────────────────────
function formatTime(ms) {
  if (ms < 60000) {
    return (ms / 1000).toFixed(2);
  }
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

function startTimer() {
  startTime = Date.now();
  isRunning = true;

  timerRing.classList.remove('holding', 'stopped');
  timerRing.classList.add('running');
  timerStatus.textContent = 'SOLVING…';
  timerHint.textContent   = 'Press Space to stop';

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    timerDisplay.textContent = formatTime(elapsed);
  }, 10);
}

function stopTimer() {
  if (!isRunning) return;

  clearInterval(timerInterval);
  isRunning = false;

  const elapsed = Date.now() - startTime;
  const timeStr = formatTime(elapsed);
  timerDisplay.textContent = timeStr;

  timerRing.classList.remove('running', 'holding');
  timerRing.classList.add('stopped');

  timerStatus.textContent = 'SOLVED!';
  timerHint.textContent   = 'Hold Space for next solve';

  recordSolve(elapsed, timeStr);

  setTimeout(() => {
    timerRing.classList.remove('stopped');
    timerStatus.textContent = 'HOLD SPACE TO START';
    timerHint.textContent   = 'Release to begin timing';
  }, 2000);
}

// ─── Keyboard Logic ───────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();

  if (isRunning) {
    stopTimer();
    return;
  }

  if (!isHolding) {
    isHolding = true;
    timerRing.classList.add('holding');
    timerDisplay.style.color = '';
    timerStatus.textContent = 'HOLD…';
    timerHint.textContent   = 'Keep holding…';

    holdTimeout = setTimeout(() => {
      if (isHolding) {
        timerStatus.textContent = 'READY!';
        timerHint.textContent   = 'Release to start!';
      }
    }, HOLD_DELAY);
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();

  if (isRunning) return;

  clearTimeout(holdTimeout);

  if (isHolding) {
    isHolding = false;

    const elapsed = Date.now() - (window._holdStart || Date.now());
    timerRing.classList.remove('holding');
    startTimer();
  }
});

// ─── Stats & History ──────────────────────────────────────────
function recordSolve(ms, timeStr) {
  const solve = {
    time: ms,
    display: timeStr,
    scramble: currentScramble,
    date: new Date()
  };

  solves.unshift(solve); // newest first

  updateStats();
  renderHistory();
  newScramble();
}

function getBest() {
  if (!solves.length) return null;
  return solves.reduce((a, b) => a.time < b.time ? a : b);
}

function getAverage(n) {
  const slice = solves.slice(0, n);
  if (!slice.length) return null;
  const sum = slice.reduce((a, b) => a + b.time, 0);
  return sum / slice.length;
}

function updateStats() {
  const best = getBest();
  const avg  = getAverage(5);
  const last = solves[0];

  solveCountEl.textContent = solves.length;

  if (last) {
    lastTimeEl.textContent = last.display;
  }

  if (best) {
    const prevBest = bestTimeEl.textContent;
    bestTimeEl.textContent = best.display;

    // Flash if new record
    if (prevBest !== '--' && best.display !== prevBest) {
      bestTimeEl.classList.remove('new-record');
      void bestTimeEl.offsetWidth;
      bestTimeEl.classList.add('new-record');
    }
  }

  if (avg !== null) {
    avgTimeEl.textContent = formatTime(avg);
  }
}

function renderHistory() {
  const MAX_SHOWN = 5;
  const best = getBest();

  if (!solves.length) {
    historyList.innerHTML = '<div class="history-empty">No solves yet. Press Space to start!</div>';
    return;
  }

  const items = solves.slice(0, MAX_SHOWN);
  historyList.innerHTML = items.map((s, i) => {
    const isBest = best && s.time === best.time;
    return `
      <div class="history-item ${isBest ? 'best-solve' : ''}">
        <span class="history-num">#${i + 1}</span>
        <span class="history-time">${s.display}</span>
        <span class="history-scramble">${s.scramble}</span>
        ${isBest ? '<span class="history-badge">BEST</span>' : ''}
      </div>
    `;
  }).join('');
}

// ─── Init ─────────────────────────────────────────────────────
(function init() {
  const moves = generateScramble();
  currentScramble = moves.join(' ');
  renderScramble(moves);
})();
