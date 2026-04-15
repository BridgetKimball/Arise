// State Management
let habits = JSON.parse(localStorage.getItem('habits')) || [];

// DOM Elements
const habitForm = document.getElementById('habit-form');
const habitInput = document.getElementById('habit-input');
const habitList = document.getElementById('habit-list');
const emptyState = document.getElementById('empty-state');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const completionStatus = document.getElementById('completion-status');
const currentDateEl = document.getElementById('current-date');

// Initialize Date
const options = { weekday: 'long', month: 'short', day: 'numeric' };
currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);

habits = normalizeHabits(habits);

// Functions
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normalizeHabits(habitsToNormalize) {
    const today = getTodayDateString();
    return habitsToNormalize.map((habit) => ({
        ...habit,
        startDate: habit.startDate || today
    }));
}

function formatDisplayDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function getActiveDays(startDateString) {
    const startDate = new Date(`${startDateString}T00:00:00`);
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.floor((todayMidnight - startDate) / msPerDay);
    return Math.max(0, days);
}

function saveAndRender() {
    localStorage.setItem('habits', JSON.stringify(habits));
    render();
}

function render() {
    habitList.innerHTML = '';
    
    if (habits.length === 0) {
        emptyState.style.display = 'block';
        progressContainer.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        progressContainer.style.display = 'block';
        
        habits.forEach((habit, index) => {
            const li = document.createElement('li');
            li.className = `habit-item ${habit.completed ? 'done' : ''}`;
            const activeDays = getActiveDays(habit.startDate);
            
            li.innerHTML = `
                <button class="check-btn" onclick="toggleHabit(${index})">
                    ${habit.completed ? '✓' : ''}
                </button>
                <div class="habit-details">
                    <span class="habit-name">${habit.name}</span>
                    <span class="habit-meta">Started ${formatDisplayDate(habit.startDate)} • Active for ${activeDays} day${activeDays === 1 ? '' : 's'}</span>
                </div>
                ${habit.completed ? '<span class="badge">Done!</span>' : ''}
                <button class="delete-btn" onclick="deleteHabit(${index})">✕</button>
            `;
            habitList.appendChild(li);
        });
    }
    updateProgress();
}

function updateProgress() {
    const total = habits.length;
    const completed = habits.filter(h => h.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    completionStatus.textContent = `${completed}/${total} done`;
}

function toggleHabit(index) {
    habits[index].completed = !habits[index].completed;
    saveAndRender();
}

function deleteHabit(index) {
    habits.splice(index, 1);
    saveAndRender();
}

// Event Listeners
habitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = habitInput.value.trim();
    const startDate = getTodayDateString();
    if (name) {
        habits.push({ name, completed: false, startDate });
        habitInput.value = '';
        saveAndRender();
    }
});

// Initial Load
render();