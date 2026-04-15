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

// Functions
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
            
            li.innerHTML = `
                <button class="check-btn" onclick="toggleHabit(${index})">
                    ${habit.completed ? '✓' : ''}
                </button>
                <span class="habit-name">${habit.name}</span>
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
    if (name) {
        habits.push({ name, completed: false });
        habitInput.value = '';
        saveAndRender();
    }
});

// Initial Load
render();