const STORAGE_KEY = 'smartPiggyBankGoals_v1';
const THEME_KEY = 'smartPiggyBankTheme_v1';

const goalForm = document.getElementById('goalForm');
const goalsContainer = document.getElementById('goalsContainer');
const goalTemplate = document.getElementById('goalCardTemplate');
const totalGoalsEl = document.getElementById('totalGoals');
const totalSavedEl = document.getElementById('totalSaved');
const completedGoalsEl = document.getElementById('completedGoals');
const progressMoodEl = document.getElementById('progressMood');
const toastEl = document.getElementById('toast');
const confettiContainer = document.getElementById('confettiContainer');
const emojiRain = document.getElementById('emojiRain');
const overlay = document.getElementById('withdrawOverlay');
const seedDemoBtn = document.getElementById('seedDemo');
const themeToggle = document.getElementById('themeToggle');
const chartCanvas = document.getElementById('goalChart');
const chartLegend = document.getElementById('chartLegend');
const ctx = chartCanvas.getContext('2d');

const chartColors = ['#ff6fa9', '#8d7bff', '#ffd86f', '#4cc38a', '#5ed3f3', '#ff936f', '#c58cff', '#78d96d'];

let goals = loadGoals();
applySavedTheme();
render();

function loadGoals() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveGoals() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateString) {
  if (!dateString) return 'No deadline';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getProgress(goal) {
  return Math.min(100, Math.round((goal.saved / goal.target) * 100 || 0));
}

function randomPenalty(goal) {
  if (!goal.penalties.length) return 'Pause and think for 30 seconds before withdrawing.';
  const index = Math.floor(Math.random() * goal.penalties.length);
  return goal.penalties[index];
}

function createGoal(data) {
  return {
    id: crypto.randomUUID(),
    name: data.name,
    target: Number(data.target),
    saved: 0,
    deadline: data.deadline,
    image: data.image || '',
    letter: data.letter || 'You believed in yourself and kept going. 🌷',
    penalties: data.penalties,
    completed: false,
    createdAt: Date.now()
  };
}

function updateStats() {
  const totalSaved = goals.reduce((sum, g) => sum + g.saved, 0);
  const completed = goals.filter(g => g.completed).length;
  totalGoalsEl.textContent = goals.length;
  totalSavedEl.textContent = formatCurrency(totalSaved);
  completedGoalsEl.textContent = completed;

  const average = goals.length ? Math.round(goals.reduce((sum, g) => sum + getProgress(g), 0) / goals.length) : 0;
  let mood = 'Let’s start 🚀';
  if (average >= 100) mood = 'Legendary 🌟';
  else if (average >= 75) mood = 'Almost there 🔥';
  else if (average >= 40) mood = 'Steady progress 💪';
  else if (average > 0) mood = 'Keep going 🌱';
  progressMoodEl.textContent = mood;
}

function render() {
  saveGoals();
  updateStats();
  renderGoals();
  drawPieChart();
}

function renderGoals() {
  goalsContainer.innerHTML = '';

  if (!goals.length) {
    goalsContainer.innerHTML = `
      <div class="empty-state">
        <h4>No piggy banks yet 🐷</h4>
        <p>Create your first dream goal and start saving with intention.</p>
      </div>
    `;
    return;
  }

  goals
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(goal => {
      const node = goalTemplate.content.cloneNode(true);
      const card = node.querySelector('.goal-card');
      const img = node.querySelector('.goal-image');
      const title = node.querySelector('.goal-title');
      const status = node.querySelector('.goal-status');
      const deadline = node.querySelector('.goal-deadline');
      const amounts = node.querySelector('.goal-amounts');
      const progressFill = node.querySelector('.progress-fill');
      const progressText = node.querySelector('.progress-text');
      const moneyInput = node.querySelector('.money-input');
      const addBtn = node.querySelector('.add-btn');
      const withdrawBtn = node.querySelector('.withdraw-btn');
      const letterBtn = node.querySelector('.letter-btn');
      const deleteBtn = node.querySelector('.delete-btn');
      const penaltyBox = node.querySelector('.penalty-box');
      const letterBox = node.querySelector('.letter-box');

      const progress = getProgress(goal);
      title.textContent = goal.name;
      status.textContent = goal.completed ? 'Completed 🎉' : 'In Progress';
      deadline.textContent = `Deadline: ${formatDate(goal.deadline)}`;
      amounts.textContent = `${formatCurrency(goal.saved)} / ${formatCurrency(goal.target)}`;
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${progress}% completed`;
      img.src = goal.image || `https://placehold.co/400x400/png?text=${encodeURIComponent(goal.name)}`;
      img.onerror = () => {
        img.src = `https://placehold.co/400x400/png?text=${encodeURIComponent(goal.name)}`;
      };

      addBtn.addEventListener('click', () => handleAddMoney(goal.id, moneyInput.value));
      withdrawBtn.addEventListener('click', () => handleWithdraw(goal.id, moneyInput.value, penaltyBox));
      letterBtn.addEventListener('click', () => toggleLetter(goal, letterBox));
      deleteBtn.addEventListener('click', () => handleDelete(goal.id));

      card.dataset.id = goal.id;
      goalsContainer.appendChild(node);
    });
}

function handleAddMoney(goalId, rawAmount) {
  const amount = Number(rawAmount);
  if (!amount || amount <= 0) {
    showToast('Enter a valid amount first 💸');
    return;
  }

  const goal = goals.find(g => g.id === goalId);
  goal.saved += amount;

  if (goal.saved >= goal.target) {
    goal.saved = goal.target;
    if (!goal.completed) {
      goal.completed = true;
      launchConfetti();
      showToast(`Goal completed! Your future-self letter is ready 💌`);
    }
  } else {
    launchConfetti(24);
    showToast('You’re getting closer! ✨');
  }

  render();
}

function handleWithdraw(goalId, rawAmount, penaltyBox) {
  const amount = Number(rawAmount);
  const goal = goals.find(g => g.id === goalId);

  if (!amount || amount <= 0) {
    showToast('Enter a valid amount first 💸');
    return;
  }
  if (amount > goal.saved) {
    showToast('You do not have that much saved 😭');
    return;
  }

  overlay.classList.add('active');
  const task = randomPenalty(goal);
  penaltyBox.classList.remove('hidden');
  penaltyBox.innerHTML = `
    <strong>Penalty task before withdrawal ⚠️</strong>
    <p>${task}</p>
    <label style="display:flex; gap:10px; align-items:flex-start; margin:12px 0;">
      <input type="checkbox" class="penalty-check" style="width:auto; margin-top:4px;" />
      <span>I completed this task honestly.</span>
    </label>
    <div style="display:flex; gap:10px; flex-wrap:wrap;">
      <button class="small-btn confirm-withdraw">Confirm Withdrawal</button>
      <button class="small-btn cancel-withdraw" style="background: rgba(255,98,124,.8);">Cancel</button>
    </div>
  `;

  penaltyBox.querySelector('.confirm-withdraw').addEventListener('click', () => {
    const checked = penaltyBox.querySelector('.penalty-check').checked;
    if (!checked) {
      showToast('Complete the penalty task first ⚡');
      return;
    }

    goal.saved -= amount;
    goal.completed = false;
    penaltyBox.classList.add('hidden');
    penaltyBox.innerHTML = '';
    overlay.classList.remove('active');
    startSadRain();
    showToast('Withdrawal completed... stay focused on your dream 💔');
    render();
  });

  penaltyBox.querySelector('.cancel-withdraw').addEventListener('click', () => {
    penaltyBox.classList.add('hidden');
    penaltyBox.innerHTML = '';
    overlay.classList.remove('active');
    showToast('Good choice. Your dream is still safe 🐷');
  });
}

function toggleLetter(goal, letterBox) {
  letterBox.classList.toggle('hidden');
  const canReveal = goal.completed;

  if (canReveal) {
    letterBox.innerHTML = `
      <strong>Future Self Letter 💌</strong>
      <p>${escapeHtml(goal.letter).replace(/\n/g, '<br>')}</p>
      <p><em>You did it. Your discipline turned into reality. 🌟</em></p>
    `;
  } else {
    letterBox.innerHTML = `
      <strong>Locked Letter 🔒</strong>
      <p>Complete this goal to unlock your emotional reward.</p>
    `;
  }
}

function handleDelete(goalId) {
  goals = goals.filter(g => g.id !== goalId);
  render();
  showToast('Goal deleted.');
}

function drawPieChart() {
  ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
  chartLegend.innerHTML = '';

  const total = goals.reduce((sum, goal) => sum + goal.saved, 0);

  if (!goals.length || total === 0) {
    ctx.beginPath();
    ctx.arc(160, 160, 100, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180,180,180,0.25)';
    ctx.fill();
    ctx.fillStyle = '#8b8393';
    ctx.font = '16px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No savings yet', 160, 165);
    return;
  }

  let startAngle = -Math.PI / 2;
  goals.forEach((goal, index) => {
    if (goal.saved <= 0) return;
    const slice = (goal.saved / total) * Math.PI * 2;
    const color = chartColors[index % chartColors.length];

    ctx.beginPath();
    ctx.moveTo(160, 160);
    ctx.arc(160, 160, 110, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle += slice;

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-left">
        <span class="legend-color" style="background:${color}"></span>
        <span>${escapeHtml(goal.name)}</span>
      </div>
      <strong>${formatCurrency(goal.saved)}</strong>
    `;
    chartLegend.appendChild(item);
  });
}

function launchConfetti(count = 36) {
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.textContent = ['✨', '🎉', '💖', '🪙'][Math.floor(Math.random() * 4)];
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.fontSize = `${14 + Math.random() * 18}px`;
    piece.style.animationDuration = `${2 + Math.random() * 2.5}s`;
    confettiContainer.appendChild(piece);
    setTimeout(() => piece.remove(), 4500);
  }
}

function startSadRain() {
  for (let i = 0; i < 24; i++) {
    const emoji = document.createElement('span');
    emoji.className = 'sad-emoji';
    emoji.textContent = ['😭', '💔', '🥲'][Math.floor(Math.random() * 3)];
    emoji.style.left = `${Math.random() * 100}%`;
    emoji.style.fontSize = `${16 + Math.random() * 22}px`;
    emoji.style.animationDuration = `${2 + Math.random() * 2.2}s`;
    emojiRain.appendChild(emoji);
    setTimeout(() => emoji.remove(), 4500);
  }
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
}

function escapeHtml(str = '') {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

goalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('goalName').value.trim();
  const target = document.getElementById('targetAmount').value;
  const deadline = document.getElementById('deadline').value;
  const image = document.getElementById('goalImage').value.trim();
  const letter = document.getElementById('futureLetter').value.trim();
  const penalties = document.getElementById('penalties').value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);

  if (!name || !target || !deadline) {
    showToast('Please fill dream name, target amount and deadline.');
    return;
  }

  goals.push(createGoal({ name, target, deadline, image, letter, penalties }));
  goalForm.reset();
  render();
  launchConfetti(22);
  showToast('New dream piggy bank created! 🐷');
});

seedDemoBtn.addEventListener('click', () => {
  if (goals.length) {
    showToast('Demo works best when list is empty first ✨');
    return;
  }

  goals = [
    {
      id: crypto.randomUUID(),
      name: 'Buy Laptop 💻',
      target: 50000,
      saved: 18000,
      deadline: '2026-08-30',
      image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80',
      letter: 'Future me, this laptop is not just a machine. It is a step toward your skills, work, and freedom.',
      penalties: ['Study for 1 hour', 'No Instagram for 1 day', 'Do 20 pushups'],
      completed: false,
      createdAt: Date.now() - 1000
    },
    {
      id: crypto.randomUUID(),
      name: 'Trip to Goa 🌴',
      target: 15000,
      saved: 6000,
      deadline: '2026-12-10',
      image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80',
      letter: 'You earned this break. Rest without guilt and enjoy every sunset.',
      penalties: ['Walk 5000 steps', 'No junk food today', 'Read 10 pages of a book'],
      completed: false,
      createdAt: Date.now() - 2000
    },
    {
      id: crypto.randomUUID(),
      name: 'Birthday Gift 🎁',
      target: 5000,
      saved: 5000,
      deadline: '2026-04-07',
      image: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=600&q=80',
      letter: 'You remembered someone with love. That matters more than the price.',
      penalties: ['Do 15 squats', 'No reels for 12 hours'],
      completed: true,
      createdAt: Date.now() - 3000
    }
  ];

  render();
  launchConfetti(28);
  showToast('Demo goals added 🎉');
});

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.body.classList.toggle('dark', saved === 'dark');
}

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
});
