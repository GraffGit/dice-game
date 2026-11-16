// Логика кубика: бросок, звук, статистика, история, конфетти
const dice = document.getElementById('dice');
const btn = document.getElementById('rollBtn');
const result = document.getElementById('result');
const score = document.getElementById('score');
const totalEl = document.getElementById('totalRolls');
const avgEl = document.getElementById('avgRoll');
const streakEl = document.getElementById('streak');
const barsEl = document.getElementById('bars');
const historyEl = document.getElementById('historyList');
const resetBtn = document.getElementById('resetBtn');

// Углы поворота кубика, чтобы нужная грань смотрела на нас
const faceAngles = {
  1: { x: 0,   y: 0 },     // front
  2: { x: 0,   y: 180 },   // back
  3: { x: 0,   y: -90 },   // right
  4: { x: 0,   y: 90 },    // left
  5: { x: -90, y: 0 },     // top
  6: { x: 90,  y: 0 }      // bottom
};

let rolling = false;
let fullSpins = 0; // копим полные обороты, чтобы анимация всегда шла "вперёд"

// --- Данные (сохраняются между перезагрузками) ---
const SAVE_KEY = 'diceStats';
let data = load();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* повреждённые данные — начинаем заново */ }
  return { counts: [0, 0, 0, 0, 0, 0], last: null, streak: 0 };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
}

// --- Звук через Web Audio API (без внешних файлов) ---
let audioCtx = null;

function tick() { // «так» во время вращения
  playTone(180 + Math.random() * 120, 0.04, 'square', 0.08);
}

function chime(value) { // «дзынь» при выпадении — тем выше, чем больше очко
  const base = 400 + value * 60;
  playTone(base, 0.15, 'sine', 0.15);
  setTimeout(() => playTone(base * 1.5, 0.25, 'sine', 0.12), 90);
}

function playTone(freq, dur, type, vol) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (e) { /* аудио недоступно — не страшно */ }
}

// --- Бросок ---
btn.addEventListener('click', roll);
dice.addEventListener('click', roll);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); roll(); }
});

function roll() {
  if (rolling) return;
  rolling = true;
  btn.disabled = true;
  result.textContent = 'Кубик крутится…';
  score.classList.remove('pop');

  // Тряска перед броском
  dice.classList.add('shake');
  setTimeout(() => dice.classList.remove('shake'), 500);

  const value = Math.floor(Math.random() * 6) + 1; // выпавшее число 1..6
  const angle = faceAngles[value];

  // Щелчки во время вращения
  const ticks = setInterval(tick, 180);
  setTimeout(() => clearInterval(ticks), 1150);

  // Добавляем 2–4 полных оборота для эффекта вращения
  const spins = 2 + Math.floor(Math.random() * 3);
  fullSpins += spins * 360;

  dice.style.transform =
    `rotateX(${angle.x + fullSpins}deg) rotateY(${angle.y + fullSpins}deg)`;

  // Ждём окончания CSS-анимации вращения (1.2s), затем показываем очко
  setTimeout(() => {
    result.textContent = 'Выпало очко:';
    score.textContent = value;
    void score.offsetWidth; // перезапуск анимации появления числа
    score.classList.add('pop');

    chime(value);
    updateStats(value);
    addHistory(value);
    if (value === 6) confetti();

    rolling = false;
    btn.disabled = false;
  }, 1250);
}

// --- Статистика ---
function updateStats(value) {
  data.counts[value - 1]++;
  data.streak = (value === data.last) ? data.streak + 1 : 1;
  data.last = value;
  save();
  renderStats();
}

function renderStats() {
  const total = data.counts.reduce((a, b) => a + b, 0);
  totalEl.textContent = total;
  avgEl.textContent = total
    ? (data.counts.reduce((sum, c, i) => sum + c * (i + 1), 0) / total).toFixed(2)
    : '—';
  streakEl.textContent = data.streak;

  const max = Math.max(...data.counts, 1);
  barsEl.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML =
      `<span class="count">${data.counts[i]}</span>` +
      `<div class="fill" style="height:${(data.counts[i] / max) * 100}%"></div>` +
      `<span class="pip">${i + 1}</span>`;
    barsEl.appendChild(bar);
  }
}

resetBtn.addEventListener('click', () => {
  data = { counts: [0, 0, 0, 0, 0, 0], last: null, streak: 0 };
  save();
  renderStats();
  historyEl.innerHTML = '<p class="empty">Пока пусто — сделай первый бросок!</p>';
});

// --- История (последние 12 бросков мини-кубиками) ---
function addHistory(value) {
  const emptyMsg = historyEl.querySelector('.empty');
  if (emptyMsg) emptyMsg.remove();

  const mini = document.createElement('div');
  mini.className = 'mini';
  mini.dataset.v = value;
  mini.title = `Выпало: ${value}`;
  for (let i = 0; i < 9; i++) mini.appendChild(document.createElement('i'));

  historyEl.prepend(mini);
  while (historyEl.children.length > 12) historyEl.lastChild.remove();
}

// --- Конфетти при шестёрке 🎉 ---
const canvas = document.getElementById('confetti');
const ctx = canvas.getContext('2d');
let particles = [];
let confettiTimer = null;

function confetti() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const colors = ['#ffd76e', '#ff6b6b', '#c44ce6', '#4ecdc4', '#6a8cff'];
  for (let i = 0; i < 120; i++) {
    particles.push({
      x: innerWidth / 2,
      y: innerHeight / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.9) * 14,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1
    });
  }
  if (!confettiTimer) animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.35;          // гравитация
    p.rot += p.vr;
    p.life -= 0.012;
    ctx.save();
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  });
  particles = particles.filter(p => p.life > 0 && p.y < canvas.height + 20);

  if (particles.length) {
    confettiTimer = requestAnimationFrame(animateConfetti);
  } else {
    cancelAnimationFrame(confettiTimer);
    confettiTimer = null;
  }
}

// Первый рендер сохранённой статистики при загрузке
renderStats();
