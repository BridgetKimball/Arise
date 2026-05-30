// State Management
const isLoginPage = document.body.dataset.page === 'login';
let currentUser = null;
let habits = [];
const apiBaseUrl = (() => {
    if (!window.location.protocol.startsWith('http')) {
        return 'http://localhost:3001';
    }

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001';
    }

    return window.location.origin;
})();

// DOM Elements
const habitForm = document.getElementById('habit-form');
const habitInput = document.getElementById('habit-input');
const frequencyInput = document.getElementById('frequency');
const targetDateInput = document.getElementById('target-date-input');
const notesInput = document.getElementById('habit-notes-input');
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
const isProfilePage = document.body.dataset.page === 'profile';
let editingHabitIndex = null;
let confirmDialogResolver = null;

// Initialize Date
const options = { weekday: 'long', month: 'short', day: 'numeric' };
if (currentDateEl) {
    currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);
}

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

async function apiRequest(pathname, options = {}) {
    const response = await fetch(`${apiBaseUrl}${pathname}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    const contentType = response.headers.get('content-type') || '';
    let payload = null;

    if (contentType.includes('application/json')) {
        payload = await response.json();
    } else {
        payload = await response.text();
    }

    if (!response.ok) {
        const message = payload && typeof payload === 'object' && payload.error
            ? payload.error
            : (typeof payload === 'string' && payload.trim() ? payload : 'Request failed.');
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return payload;
}

async function fetchCurrentUser() {
    try {
        const payload = await apiRequest('/api/me');
        return payload.user || null;
    } catch (error) {
        if (error.status === 401) {
            return null;
        }
        console.warn('Falling back to local habits because the server is unavailable.', error);
        return null;
    }
}

async function fetchHabitsFromServer() {
    const payload = await apiRequest('/api/habits');
    habits = normalizeHabits(Array.isArray(payload.habits) ? payload.habits : []);
}

function loadHabitsFromLocalStorage() {
    const localHabitsRaw = localStorage.getItem('habits');

    if (!localHabitsRaw) {
        habits = [];
        return;
    }

    try {
        const parsedHabits = JSON.parse(localHabitsRaw);
        habits = normalizeHabits(Array.isArray(parsedHabits) ? parsedHabits : []);
    } catch {
        habits = [];
    }
}

async function persistHabits() {
    if (!currentUser) {
        localStorage.setItem('habits', JSON.stringify(habits));
        return;
    }

    await apiRequest('/api/habits', {
        method: 'PUT',
        body: JSON.stringify({ habits })
    });
}

async function migrateLocalHabitsIfNeeded() {
    if (!currentUser || habits.length > 0) {
        return;
    }

    const localHabitsRaw = localStorage.getItem('habits');
    if (!localHabitsRaw) {
        return;
    }

    let localHabits = [];
    try {
        localHabits = JSON.parse(localHabitsRaw);
    } catch {
        localHabits = [];
    }

    if (!Array.isArray(localHabits) || localHabits.length === 0) {
        localStorage.removeItem('habits');
        return;
    }

    habits = normalizeHabits(localHabits);
    await persistHabits();
    localStorage.removeItem('habits');
}

function updateAuthLink() {
    const authLink = document.getElementById('nav-auth-link');
    const userIndicator = document.getElementById('header-user-indicator');
    if (!authLink) {
        return;
    }

    if (currentUser) {
        authLink.textContent = 'Logout';
        authLink.href = '#';
        authLink.onclick = async (event) => {
            event.preventDefault();
            await logout();
        };
        if (userIndicator) {
            userIndicator.textContent = currentUser.username;
            userIndicator.title = 'Open profile settings';
            userIndicator.hidden = false;
            userIndicator.onclick = () => {
                window.location.href = '/profile.html';
            };
        }
        return;
    }

    authLink.textContent = 'Login';
    authLink.href = '/login.html';
    authLink.onclick = null;
    if (userIndicator) {
        userIndicator.textContent = 'Guest';
        userIndicator.title = '';
        userIndicator.hidden = false;
        userIndicator.onclick = null;
    }
}

async function logout() {
    try {
        await apiRequest('/api/logout', { method: 'POST' });
    } catch {
        // Even if logout fails, move the user back to the login page.
    }

    currentUser = null;
    habits = [];
    window.location.href = '/login.html';
}

function normalizeHabits(habitsToNormalize) {
    const today = getTodayDateString();
    return habitsToNormalize.map((habit) => ({
        ...habit,
        frequency: canonicalizeFrequency(habit.frequency),
        startDate: habit.startDate || today,
        targetDate: habit.targetDate || '',
        notes: typeof habit.notes === 'string' ? habit.notes : '',
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

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getHabitNoteMarkup(habit) {
    return habit.notes ? `<span class="habit-note">${escapeHtml(habit.notes)}</span>` : '';
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

async function saveAndRender() {
    await persistHabits();
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
                            <div>
                                <label class="habit-edit-label" for="edit-notes-${index}">Notes</label>
                                <textarea id="edit-notes-${index}" class="habit-edit-input habit-edit-textarea" rows="3" placeholder="Add a note for this habit">${escapeHtml(habit.notes || '')}</textarea>
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
                            ${getHabitNoteMarkup(habit)}
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
                        ${getHabitNoteMarkup(habit)}
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

async function toggleHabit(index) {
    if (!habits[index]) {
        return;
    }

    habits[index].completed = !habits[index].completed;
    const todayKey = getTodayDateString();
    habits[index].checkins[todayKey] = habits[index].completed;
    await saveAndRender();
}

async function deleteHabit(index) {
    if (!habits[index]) {
        return;
    }

    const habitName = habits[index].name || 'this habit';
    const confirmed = await showConfirmDialog({
        title: 'Delete habit?',
        message: `Delete "${habitName}" permanently? This cannot be undone.`,
        confirmLabel: 'Delete habit'
    });

    if (!confirmed) {
        return;
    }

    if (editingHabitIndex === index) {
        editingHabitIndex = null;
    } else if (editingHabitIndex !== null && editingHabitIndex > index) {
        editingHabitIndex -= 1;
    }

    habits.splice(index, 1);
    await saveAndRender();
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

async function saveEditedHabit(index) {
    if (!isEditHabitsPage || !habits[index]) {
        return;
    }

    const nameInput = document.getElementById(`edit-name-${index}`);
    const startInput = document.getElementById(`edit-start-${index}`);
    const targetInput = document.getElementById(`edit-target-${index}`);
    const frequencySelect = document.getElementById(`edit-frequency-${index}`);
    const notesEditInput = document.getElementById(`edit-notes-${index}`);

    if (!nameInput || !startInput || !targetInput || !frequencySelect || !notesEditInput) {
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
        targetDate: normalizedTargetDate,
        notes: notesEditInput.value.trim()
    };

    editingHabitIndex = null;
    await saveAndRender();
}

window.beginEditHabit = beginEditHabit;
window.saveEditedHabit = saveEditedHabit;
window.cancelEditHabit = cancelEditHabit;

async function toggleWeekCheck(index, dateKey) {
    if (!habits[index]) {
        return;
    }

    const currentValue = Boolean(habits[index].checkins[dateKey]);
    habits[index].checkins[dateKey] = !currentValue;

    if (dateKey === getTodayDateString()) {
        habits[index].completed = !currentValue;
    }

    await saveAndRender();
}

window.toggleWeekCheck = toggleWeekCheck;

async function toggleMonthCheck(index, dateKey) {
    if (!habits[index]) {
        return;
    }

    const currentValue = Boolean(habits[index].checkins[dateKey]);
    habits[index].checkins[dateKey] = !currentValue;

    if (dateKey === getTodayDateString()) {
        habits[index].completed = !currentValue;
    }

    await saveAndRender();
}

window.toggleMonthCheck = toggleMonthCheck;

function ensureConfirmDialog() {
    if (document.getElementById('confirm-dialog')) {
        return;
    }

    const dialog = document.createElement('div');
    dialog.id = 'confirm-dialog';
    dialog.className = 'confirm-dialog';
    dialog.hidden = true;
    dialog.innerHTML = `
        <div class="confirm-dialog__overlay" data-confirm-cancel></div>
        <div class="confirm-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
            <h3 id="confirm-dialog-title" class="confirm-dialog__title">Confirm action</h3>
            <p id="confirm-dialog-message" class="confirm-dialog__message"></p>
            <div class="confirm-dialog__actions">
                <button type="button" class="confirm-dialog__button confirm-dialog__button--primary" data-confirm-yes>Confirm</button>
                <button type="button" class="confirm-dialog__button confirm-dialog__button--secondary" data-confirm-cancel>Cancel</button>
            </div>
        </div>
    `;

    dialog.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (target.hasAttribute('data-confirm-cancel')) {
            closeConfirmDialog(false);
        }

        if (target.hasAttribute('data-confirm-yes')) {
            closeConfirmDialog(true);
        }
    });

    document.body.appendChild(dialog);
}

function closeConfirmDialog(result) {
    const dialog = document.getElementById('confirm-dialog');
    if (!dialog) {
        return;
    }

    dialog.hidden = true;
    document.body.classList.remove('confirm-dialog-open');

    if (confirmDialogResolver) {
        confirmDialogResolver(result);
        confirmDialogResolver = null;
    }
}

function showConfirmDialog({ title, message, confirmLabel }) {
    ensureConfirmDialog();

    const dialog = document.getElementById('confirm-dialog');
    const dialogTitle = document.getElementById('confirm-dialog-title');
    const dialogMessage = document.getElementById('confirm-dialog-message');
    const confirmButton = dialog ? dialog.querySelector('[data-confirm-yes]') : null;

    if (!dialog || !dialogTitle || !dialogMessage || !confirmButton) {
        return Promise.resolve(false);
    }

    if (confirmDialogResolver) {
        confirmDialogResolver(false);
    }

    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    confirmButton.textContent = confirmLabel;
    dialog.hidden = false;
    document.body.classList.add('confirm-dialog-open');

    return new Promise((resolve) => {
        confirmDialogResolver = resolve;
        setTimeout(() => confirmButton.focus(), 0);
    });
}

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
                    <td class="habit-col">
                        <div class="habit-name">${habit.name}</div>
                        ${getHabitNoteMarkup(habit)}
                    </td>
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
                <td class="habit-col">
                    <div class="habit-name">${habit.name}</div>
                    ${getHabitNoteMarkup(habit)}
                </td>
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
    habitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = habitInput.value.trim();
        const frequency = frequencyInput ? canonicalizeFrequency(frequencyInput.value) : 'daily';
        const startDate = getTodayDateString();
        const targetDate = targetDateInput && targetDateInput.value ? targetDateInput.value : '';
        const notes = notesInput ? notesInput.value.trim() : '';

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
                notes,
                checkins: {}
            });
            habitInput.value = '';
            if (frequencyInput) {
                frequencyInput.value = 'daily';
            }
            if (targetDateInput) {
                targetDateInput.value = '';
            }
            if (notesInput) {
                notesInput.value = '';
            }
            await saveAndRender();
        }
    });
}

function setAuthMessage(message, isError = false) {
    const authMessage = document.getElementById('auth-message');
    if (!authMessage) {
        return;
    }

    authMessage.textContent = message;
    authMessage.classList.toggle('error', isError);
}

async function submitAuthForm(action) {
    const loginIdentifierInput = document.getElementById('auth-login-identifier');
    const loginPasswordInput = document.getElementById('auth-login-password');
    const registerEmailInput = document.getElementById('auth-register-email');
    const registerUsernameInput = document.getElementById('auth-register-username');
    const registerPasswordInput = document.getElementById('auth-register-password');

    if (action === 'register') {
        if (!registerEmailInput || !registerUsernameInput || !registerPasswordInput) {
            return;
        }

        const email = registerEmailInput.value.trim();
        const username = registerUsernameInput.value.trim();
        const password = registerPasswordInput.value;

        if (!email || !username || !password) {
            setAuthMessage('Enter an email, username, and password.', true);
            return;
        }

        setAuthMessage('');

        try {
            await apiRequest('/api/register', {
                method: 'POST',
                body: JSON.stringify({ email, username, password })
            });

            clearAuthInputs();
            setAuthMessage('Account created. Please log in.', false);
            window.location.href = '/login.html';
        } catch (error) {
            setAuthMessage(error.message || 'Unable to create account.', true);
        }

        return;
    }

    if (!loginIdentifierInput || !loginPasswordInput) {
        return;
    }

    const identifier = loginIdentifierInput.value.trim();
    const password = loginPasswordInput.value;

    if (!identifier || !password) {
        setAuthMessage('Enter a username or email and password.', true);
        return;
    }

    setAuthMessage('');

    try {
        const payload = await apiRequest('/api/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password })
        });

        currentUser = payload.user || { username: identifier };
        clearAuthInputs();
        await fetchHabitsFromServer();
        await migrateLocalHabitsIfNeeded();
        updateAuthLink();
        window.location.href = '/index.html';
    } catch (error) {
        setAuthMessage(error.message || 'Unable to sign in.', true);
    }
}

function setupLoginPage() {
    const loginForm = document.getElementById('auth-login-form');
    const registerForm = document.getElementById('auth-register-form');
    const showRegisterButton = document.getElementById('auth-show-register-btn');
    const showLoginButton = document.getElementById('auth-show-login-btn');
    const cardTitle = document.getElementById('auth-card-title');

    if (currentUser) {
        window.location.href = '/index.html';
        return;
    }

    if (!loginForm) {
        return;
    }

    const setAuthMode = (mode) => {
        const isRegisterMode = mode === 'register';
        clearAuthInputs();
        if (cardTitle) {
            cardTitle.textContent = isRegisterMode ? 'Create Account' : 'Login';
        }
        if (loginForm) {
            loginForm.hidden = isRegisterMode;
        }
        if (registerForm) {
            registerForm.hidden = !isRegisterMode;
        }
    };

    setAuthMode('login');

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        void submitAuthForm('login');
    });

    if (registerForm) {
        registerForm.addEventListener('submit', (event) => {
            event.preventDefault();
            void submitAuthForm('register');
        });
    }

    if (showRegisterButton) {
        showRegisterButton.addEventListener('click', () => {
            setAuthMode('register');
            setAuthMessage('');
        });
    }

    if (showLoginButton) {
        showLoginButton.addEventListener('click', () => {
            setAuthMode('login');
            setAuthMessage('');
        });
    }
}

function clearAuthInputs() {
    const inputs = [
        'auth-login-identifier',
        'auth-login-password',
        'auth-register-email',
        'auth-register-username',
        'auth-register-password'
    ];

    for (const inputId of inputs) {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = '';
        }
    }
}

function setProfileMessage(message, isError = false) {
    const profileMessage = document.getElementById('profile-message');
    if (!profileMessage) {
        return;
    }

    profileMessage.textContent = message;
    profileMessage.classList.toggle('error', isError);
}

function populateProfileForm(user) {
    const usernameInput = document.getElementById('profile-username');
    const emailInput = document.getElementById('profile-email');
    const passwordInput = document.getElementById('profile-password');
    const username = user?.username || '';
    const email = user?.email || '';

    if (usernameInput) {
        usernameInput.value = username;
        usernameInput.defaultValue = username;
    }
    if (emailInput) {
        emailInput.value = email;
        emailInput.defaultValue = email;
    }
    if (passwordInput) {
        passwordInput.value = '';
        passwordInput.defaultValue = '';
    }
}

async function submitProfileForm() {
    const usernameInput = document.getElementById('profile-username');
    const emailInput = document.getElementById('profile-email');
    const passwordInput = document.getElementById('profile-password');

    if (!usernameInput || !emailInput || !passwordInput) {
        return;
    }

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!username || !email) {
        setProfileMessage('Username and email are required.', true);
        return;
    }

    setProfileMessage('');

    try {
        const payload = await apiRequest('/api/me', {
            method: 'PUT',
            body: JSON.stringify({ username, email, password })
        });

        currentUser = payload.user || currentUser;
        populateProfileForm(currentUser);
        updateAuthLink();
        setProfileMessage('Profile updated.');
    } catch (error) {
        setProfileMessage(error.message || 'Unable to save profile changes.', true);
    }
}

async function deleteProfileAccount() {
    const confirmed = await showConfirmDialog({
        title: 'Delete account?',
        message: 'Delete your account and all habits permanently? This cannot be undone.',
        confirmLabel: 'Delete account'
    });

    if (!confirmed) {
        return;
    }

    try {
        await apiRequest('/api/me', { method: 'DELETE' });
        currentUser = null;
        habits = [];
        updateAuthLink();
        window.location.href = '/login.html';
    } catch (error) {
        setProfileMessage(error.message || 'Unable to delete account.', true);
    }
}

function setupProfilePage() {
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }

    const profileForm = document.getElementById('profile-form');
    const deleteButton = document.getElementById('profile-delete-btn');
    const cancelButton = document.getElementById('profile-cancel-btn');

    populateProfileForm(currentUser);
    updateAuthLink();

    if (profileForm) {
        profileForm.addEventListener('submit', (event) => {
            event.preventDefault();
            void submitProfileForm();
        });
    }

    if (deleteButton) {
        deleteButton.addEventListener('click', () => {
            void deleteProfileAccount();
        });
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            window.location.href = '/index.html';
        });
    }
}

async function initializeApp() {
    setupNavigation();
    ensureConfirmDialog();
    currentUser = await fetchCurrentUser();
    updateAuthLink();

    if (isLoginPage) {
        setupLoginPage();
        return;
    }

    if (isProfilePage) {
        setupProfilePage();
        return;
    }

    if (currentUser) {
        try {
            await fetchHabitsFromServer();
            await migrateLocalHabitsIfNeeded();
        } catch (error) {
            console.warn('Falling back to local habits because server habits could not be loaded.', error);
            currentUser = null;
            loadHabitsFromLocalStorage();
        }
    } else {
        loadHabitsFromLocalStorage();
    }

    if (habitList) {
        render();
    }
    setupMonthlyHabitsView();
    renderWeeklyTable();
}

initializeApp().catch((error) => {
    console.error(error);
    if (isLoginPage) {
        setAuthMessage('Unable to connect to the server.', true);
    } else {
        loadHabitsFromLocalStorage();
        if (habitList) {
            render();
        }
        setupMonthlyHabitsView();
        renderWeeklyTable();
    }
});