// State Management
let habits = JSON.parse(localStorage.getItem('habits')) || [];

// DOM Elements
const habitForm = document.getElementById('habit-form');
const habitInput = document.getElementById('habit-input');
const frequencyInput = document.getElementById('frequency');
const targetDateInput = document.getElementById('target-date-input');
const habitList = document.getElementById('habit-list');
const emptyState = document.getElementById('empty-state');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const completionStatus = document.getElementById('completion-status');
const currentDateEl = document.getElementById('current-date');
const navToggleButton = document.getElementById('nav-toggle');
const sideNav = document.getElementById('side-nav');
const navOverlay = document.getElementById('nav-overlay');
const monthPicker = document.getElementById('month-picker');
const monthlyCheckTable = document.getElementById('monthly-check-table');
const weeklyCheckTable = document.getElementById('weekly-check-table');
const weekRangeLabel = document.getElementById('week-range-label');
const isEditHabitsPage = document.body.dataset.page === 'edit-habits';
let editingHabitIndex = null;

// Initialize Date
const options = { weekday: 'long', month: 'short', day: 'numeric' };
if (currentDateEl) {
    currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);
}

habits = normalizeHabits(habits);

// Functions
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCurrentMonthString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function normalizeHabits(habitsToNormalize) {
    const today = getTodayDateString();
    return habitsToNormalize.map((habit) => ({
        ...habit,
        frequency: canonicalizeFrequency(habit.frequency),
        startDate: habit.startDate || today,
        targetDate: habit.targetDate || '',
        checkins: habit.checkins && typeof habit.checkins === 'object' ? habit.checkins : {}
    }));
}

function canonicalizeFrequency(value) {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'weekly' || normalized === 'once a week') {
        return 'weekly';
    }

    if (normalized === 'monthly' || normalized === 'once a month') {
        return 'monthly';
    }

    return 'daily';
}

function isValidDateString(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return false;
    }
    const parsed = new Date(`${dateString}T00:00:00`);
    return !Number.isNaN(parsed.getTime());
}

function getHabitMetaText(habit, activeDays) {
    const targetText = habit.targetDate ? ` • Target ${formatDisplayDate(habit.targetDate)}` : '';
    const frequencyText = habit.frequency ? ` • ${habit.frequency}` : '';
    return `Started ${formatDisplayDate(habit.startDate)} • Active for ${activeDays} day${activeDays === 1 ? '' : 's'}${targetText}${frequencyText}`;
}

function escapeAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getDateKey(dateObject) {
    const year = dateObject.getFullYear();
    const month = String(dateObject.getMonth() + 1).padStart(2, '0');
    const day = String(dateObject.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCurrentWeekDates() {
    const today = new Date();
    const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(sunday);
        date.setDate(sunday.getDate() + index);
        return date;
    });
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
    renderMonthlyHabits();
    renderWeeklyTable();
}

function render() {
    if (!habitList || !emptyState) {
        return;
    }

    habitList.innerHTML = '';
    
    if (habits.length === 0) {
        emptyState.style.display = 'block';
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    } else {
        emptyState.style.display = 'none';
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        
        habits.forEach((habit, index) => {
            const li = document.createElement('li');
            li.className = `habit-item ${habit.completed ? 'done' : ''}`;
            const activeDays = getActiveDays(habit.startDate);

            if (isEditHabitsPage) {
                if (editingHabitIndex === index) {
                    li.innerHTML = `
                        <div class="habit-edit-form">
                            <label class="habit-edit-label" for="edit-name-${index}">Habit name</label>
                            <input id="edit-name-${index}" class="habit-edit-input" type="text" value="${escapeAttribute(habit.name)}">
                            <div class="habit-edit-dates">
                                <div>
                                    <label class="habit-edit-label" for="edit-start-${index}">Start date</label>
                                    <input id="edit-start-${index}" class="habit-edit-input" type="date" value="${escapeAttribute(habit.startDate)}">
                                </div>
                                <div>
                                    <label class="habit-edit-label" for="edit-target-${index}">End/Target date</label>
                                    <input id="edit-target-${index}" class="habit-edit-input" type="date" value="${escapeAttribute(habit.targetDate || '')}">
                                </div>
                                <div>
                                    <label class="habit-edit-label" for="edit-frequency-${index}">Frequency</label>
                                    <select id="edit-frequency-${index}" class="habit-edit-input">
                                        <option value="daily" ${habit.frequency === 'daily' ? 'selected' : ''}>Daily</option>
                                        <option value="weekly" ${habit.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                                        <option value="monthly" ${habit.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <button class="edit-btn" onclick="saveEditedHabit(${index})">Save</button>
                        <button class="edit-btn edit-cancel-btn" onclick="cancelEditHabit()">Cancel</button>
                    `;
                } else {
                    li.innerHTML = `
                        <div class="habit-details">
                            <span class="habit-name">${habit.name}</span>
                            <span class="habit-meta">${getHabitMetaText(habit, activeDays)}</span>
                        </div>
                        ${habit.completed ? '<span class="badge">Done!</span>' : ''}
                        <button class="edit-btn" onclick="beginEditHabit(${index})">Edit</button>
                        <button class="delete-btn" onclick="deleteHabit(${index})">✕</button>
                    `;
                }
            } else {
                li.innerHTML = `
                    <button class="check-btn" onclick="toggleHabit(${index})">
                        ${habit.completed ? '✓' : ''}
                    </button>
                    <div class="habit-details">
                        <span class="habit-name">${habit.name}</span>
                        <span class="habit-meta">${getHabitMetaText(habit, activeDays)}</span>
                    </div>
                    ${habit.completed ? '<span class="badge">Done!</span>' : ''}
                    <button class="delete-btn" onclick="deleteHabit(${index})">✕</button>
                `;
            }

            habitList.appendChild(li);
        });
    }
    updateProgress();
}

function updateProgress() {
    if (!progressBar || !progressPercent || !completionStatus) {
        return;
    }

    const total = habits.length;
    const completed = habits.filter(h => h.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    completionStatus.textContent = `${completed}/${total} done`;
}

function toggleHabit(index) {
    if (!habits[index]) {
        return;
    }

    habits[index].completed = !habits[index].completed;
    const todayKey = getTodayDateString();
    habits[index].checkins[todayKey] = habits[index].completed;
    saveAndRender();
}

function deleteHabit(index) {
    if (!habits[index]) {
        return;
    }

    if (editingHabitIndex === index) {
        editingHabitIndex = null;
    } else if (editingHabitIndex !== null && editingHabitIndex > index) {
        editingHabitIndex -= 1;
    }

    habits.splice(index, 1);
    saveAndRender();
}

function beginEditHabit(index) {
    if (!isEditHabitsPage || !habits[index] || editingHabitIndex === index) {
        return;
    }

    editingHabitIndex = index;
    render();
}

function cancelEditHabit() {
    if (!isEditHabitsPage) {
        return;
    }

    editingHabitIndex = null;
    render();
}

function saveEditedHabit(index) {
    if (!isEditHabitsPage || !habits[index]) {
        return;
    }

    const nameInput = document.getElementById(`edit-name-${index}`);
    const startInput = document.getElementById(`edit-start-${index}`);
    const targetInput = document.getElementById(`edit-target-${index}`);
    const frequencySelect = document.getElementById(`edit-frequency-${index}`);

    if (!nameInput || !startInput || !targetInput || !frequencySelect) {
        return;
    }

    const currentHabit = habits[index];
    const trimmedName = nameInput.value.trim();
    if (!trimmedName) {
        window.alert('Habit name cannot be empty.');
        return;
    }

    const normalizedStartDate = startInput.value.trim();
    if (!isValidDateString(normalizedStartDate)) {
        window.alert('Please use a valid date in YYYY-MM-DD format.');
        return;
    }

    const normalizedTargetDate = targetInput.value.trim();
    if (normalizedTargetDate && !isValidDateString(normalizedTargetDate)) {
        window.alert('Please use a valid target date in YYYY-MM-DD format.');
        return;
    }

    habits[index] = {
        ...currentHabit,
        name: trimmedName,
        frequency: canonicalizeFrequency(frequencySelect.value),
        startDate: normalizedStartDate,
        targetDate: normalizedTargetDate
    };

    editingHabitIndex = null;
    saveAndRender();
}

window.beginEditHabit = beginEditHabit;
window.saveEditedHabit = saveEditedHabit;
window.cancelEditHabit = cancelEditHabit;

function toggleWeekCheck(index, dateKey) {
    if (!habits[index]) {
        return;
    }

    const currentValue = Boolean(habits[index].checkins[dateKey]);
    habits[index].checkins[dateKey] = !currentValue;

    if (dateKey === getTodayDateString()) {
        habits[index].completed = !currentValue;
    }

    saveAndRender();
}

window.toggleWeekCheck = toggleWeekCheck;

function toggleMonthCheck(index, dateKey) {
    if (!habits[index]) {
        return;
    }

    const currentValue = Boolean(habits[index].checkins[dateKey]);
    habits[index].checkins[dateKey] = !currentValue;

    if (dateKey === getTodayDateString()) {
        habits[index].completed = !currentValue;
    }

    saveAndRender();
}

window.toggleMonthCheck = toggleMonthCheck;

function setNavOpen(isOpen) {
    if (!navToggleButton || !sideNav || !navOverlay) {
        return;
    }

    document.body.classList.toggle('nav-open', isOpen);
    navToggleButton.setAttribute('aria-expanded', String(isOpen));
    navOverlay.setAttribute('aria-hidden', String(!isOpen));
}

function setupNavigation() {
    if (!navToggleButton || !sideNav || !navOverlay) {
        return;
    }

    navToggleButton.addEventListener('click', () => {
        const isOpen = document.body.classList.contains('nav-open');
        setNavOpen(!isOpen);
    });

    navOverlay.addEventListener('click', () => {
        setNavOpen(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setNavOpen(false);
        }
    });

    sideNav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            setNavOpen(false);
        });
    });
}

function getMonthlyLogoPath() {
    return window.location.pathname.includes('/src/')
        ? '../pictures/arise_logo.png'
        : 'pictures/arise_logo.png';
}

function getDatesInMonth(selectedMonth) {
    const [yearText, monthText] = selectedMonth.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
        return new Date(year, monthIndex, index + 1);
    });
}

function getCalendarWeeks(selectedMonth) {
    const [yearText, monthText] = selectedMonth.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;

    const firstOfMonth = new Date(year, monthIndex, 1);
    const lastOfMonth = new Date(year, monthIndex + 1, 0);

    const cursor = new Date(firstOfMonth);
    cursor.setDate(firstOfMonth.getDate() - firstOfMonth.getDay()); // rewind to Sunday

    const weeks = [];
    while (cursor <= lastOfMonth) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            week.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }
    return weeks;
}

function normalizeFrequency(frequencyText) {
    return canonicalizeFrequency(frequencyText);
}

function isHabitActiveOnDate(habit, date) {
    const habitStart = new Date(`${habit.startDate}T00:00:00`);
    const habitTarget = habit.targetDate ? new Date(`${habit.targetDate}T00:00:00`) : null;

    if (date < habitStart) {
        return false;
    }

    if (habitTarget && date > habitTarget) {
        return false;
    }

    return true;
}

function isDateScheduledByFrequency(habit, date) {
    const frequency = normalizeFrequency(habit.frequency);
    const habitStart = new Date(`${habit.startDate}T00:00:00`);
    const dateWeekday = date.getDay();

    if (frequency === 'daily') {
        return true;
    }

    if (frequency === 'weekly') {
        return dateWeekday === habitStart.getDay();
    }

    if (frequency === 'monthly') {
        return date.getDate() === habitStart.getDate();
    }

    // Safety fallback.
    return true;
}

function isHabitActiveInMonth(habit, selectedMonth) {
    const [yearText, monthText] = selectedMonth.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);

    const habitStart = new Date(`${habit.startDate}T00:00:00`);
    const habitTarget = habit.targetDate ? new Date(`${habit.targetDate}T00:00:00`) : null;

    if (habitStart > monthEnd) {
        return false;
    }

    if (habitTarget && habitTarget < monthStart) {
        return false;
    }

    return true;
}

function renderMonthlyHabits() {
    if (!monthlyCheckTable) {
        return;
    }

    const selectedMonth = monthPicker && monthPicker.value
        ? monthPicker.value
        : getCurrentMonthString();

    const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
    const selectedMonthIndex = selectedMonthNum - 1;
    const weekDateGroups = getCalendarWeeks(selectedMonth);
    const activeHabits = habits
        .map((habit, index) => ({ habit, index }))
        .filter(({ habit }) => isHabitActiveInMonth(habit, selectedMonth));

    if (activeHabits.length === 0) {
        monthlyCheckTable.innerHTML = weekDateGroups.map((weekDates, weekIndex) => {
            const inMonthDates = weekDates.filter((d) => d.getMonth() === selectedMonthIndex);
            if (inMonthDates.length === 0) return '';
            const firstDay = inMonthDates[0].getDate();
            const lastDay = inMonthDates[inMonthDates.length - 1].getDate();
            return `
                <section class="month-week-block">
                    <h3 class="month-week-title">Week ${weekIndex + 1} (${firstDay}-${lastDay})</h3>
                    <div class="empty-state week-empty">
                        <img src="${getMonthlyLogoPath()}" alt="Arise Logo" class="logo">
                        <p>No habits yet. Add one above to get started!</p>
                    </div>
                </section>
            `;
        }).join('');
        return;
    }

    monthlyCheckTable.innerHTML = weekDateGroups.map((weekDates, weekIndex) => {
        const inMonthDates = weekDates.filter((d) => d.getMonth() === selectedMonthIndex);
        if (inMonthDates.length === 0) return '';

        const weekHabits = activeHabits.filter(({ habit }) => {
            return inMonthDates.some((date) => isHabitActiveOnDate(habit, date) && isDateScheduledByFrequency(habit, date));
        });

        const dayHeaders = weekDates.map((date) => {
            const isInMonth = date.getMonth() === selectedMonthIndex;
            const weekdayLetter = date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
            const thClass = isInMonth ? '' : ' class="out-of-month"';
            return `<th${thClass}>${weekdayLetter}<br><span class="day-num">${date.getDate()}</span></th>`;
        }).join('');

        const firstDay = inMonthDates[0].getDate();
        const lastDay = inMonthDates[inMonthDates.length - 1].getDate();

        if (weekHabits.length === 0) {
            return `
                <section class="month-week-block">
                    <h3 class="month-week-title">Week ${weekIndex + 1} (${firstDay}-${lastDay})</h3>
                    <div class="empty-state week-empty">
                        <img src="${getMonthlyLogoPath()}" alt="Arise Logo" class="logo">
                        <p>No habits yet. Add one above to get started!</p>
                    </div>
                </section>
            `;
        }

        const bodyRows = weekHabits.map(({ habit, index }) => {
            const cells = weekDates.map((date) => {
                if (date.getMonth() !== selectedMonthIndex) {
                    return '<td class="unscheduled-td"></td>';
                }
                const dateKey = getDateKey(date);
                const isActiveOnDate = isHabitActiveOnDate(habit, date);
                const isScheduled = isDateScheduledByFrequency(habit, date);
                const isEligible = isActiveOnDate && isScheduled;
                const checkedClass = habit.checkins[dateKey] ? 'checked' : '';

                if (!isEligible) {
                    return '<td class="unscheduled-td"></td>';
                }

                return `
                    <td>
                        <button
                            type="button"
                            class="week-check-cell ${checkedClass}"
                            aria-label="Mark ${habit.name} on ${dateKey}"
                            onclick="toggleMonthCheck(${index}, '${dateKey}')"
                        ></button>
                    </td>
                `;
            }).join('');

            return `
                <tr>
                    <td class="habit-col">${habit.name}</td>
                    ${cells}
                </tr>
            `;
        }).join('');

        return `
            <section class="month-week-block">
                <h3 class="month-week-title">Week ${weekIndex + 1} (${firstDay}-${lastDay})</h3>
                <div class="weekly-check-table">
                    <table class="weekly-grid month-week-grid">
                        <thead>
                            <tr>
                                <th class="habit-col">Habit List</th>
                                ${dayHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            ${bodyRows}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    }).join('');
}

function setupMonthlyHabitsView() {
    if (!monthPicker || !monthlyCheckTable) {
        return;
    }

    monthPicker.value = getCurrentMonthString();
    monthPicker.addEventListener('change', renderMonthlyHabits);
    renderMonthlyHabits();
}

function renderWeeklyTable() {
    if (!weeklyCheckTable) {
        return;
    }

    const weekDates = getCurrentWeekDates();
    const dayHeader = weekDates.map((date) => {
        const letter = date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
        const dayNumber = date.getDate();
        return `<th>${letter}<br><span class="day-num">${dayNumber}</span></th>`;
    }).join('');

    if (weekRangeLabel) {
        const first = weekDates[0];
        const last = weekDates[6];
        const firstLabel = first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const lastLabel = last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        weekRangeLabel.textContent = `${firstLabel} - ${lastLabel}`;
    }

    if (habits.length === 0) {
        weeklyCheckTable.innerHTML = `
            <div class="empty-state week-empty">
                <img src="pictures/arise_logo.png" alt="Arise Logo" class="logo">
                <p>No habits yet. Add one above to get started!</p>
            </div>
        `;
        return;
    }

    const bodyRows = habits.map((habit, habitIndex) => {
        const cells = weekDates.map((date) => {
            const dateKey = getDateKey(date);
            const isActiveOnDate = isHabitActiveOnDate(habit, date);
            const isScheduled = isDateScheduledByFrequency(habit, date);
            const isEligible = isActiveOnDate && isScheduled;
            const checkedClass = habit.checkins[dateKey] ? 'checked' : '';

            if (!isEligible) {
                return '<td class="unscheduled-td"></td>';
            }

            return `
                <td>
                    <button
                        type="button"
                        class="week-check-cell ${checkedClass}"
                        aria-label="Mark ${habit.name} on ${dateKey}"
                        onclick="toggleWeekCheck(${habitIndex}, '${dateKey}')"
                    ></button>
                </td>
            `;
        }).join('');

        return `
            <tr>
                <td class="habit-col">${habit.name}</td>
                ${cells}
            </tr>
        `;
    }).join('');

    weeklyCheckTable.innerHTML = `
        <table class="weekly-grid">
            <thead>
                <tr>
                    <th class="habit-col">Habit List</th>
                    ${dayHeader}
                </tr>
            </thead>
            <tbody>
                ${bodyRows}
            </tbody>
        </table>
    `;
}

// Event Listeners
if (habitForm && habitInput) {
    habitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = habitInput.value.trim();
        const frequency = frequencyInput ? canonicalizeFrequency(frequencyInput.value) : 'daily';
        const startDate = getTodayDateString();
        const targetDate = targetDateInput && targetDateInput.value ? targetDateInput.value : '';

        if (targetDate && !isValidDateString(targetDate)) {
            window.alert('Please use a valid target date in YYYY-MM-DD format.');
            return;
        }

        if (name) {
            habits.push({
                name,
                frequency,
                completed: false,
                startDate,
                targetDate,
                checkins: {}
            });
            habitInput.value = '';
            if (frequencyInput) {
                frequencyInput.value = 'daily';
            }
            if (targetDateInput) {
                targetDateInput.value = '';
            }
            saveAndRender();
        }
    });
}

// Initial Load
setupNavigation();
if (habitList) {
    render();
}
setupMonthlyHabitsView();
renderWeeklyTable();