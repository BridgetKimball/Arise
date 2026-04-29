export function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function canonicalizeFrequency(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'weekly' || normalized === 'once a week') return 'weekly';
  if (normalized === 'monthly' || normalized === 'once a month') return 'monthly';
  return 'daily';
}

export function normalizeHabits(habits) {
  const today = getTodayDateString();
  return habits.map((habit) => ({
    ...habit,
    frequency: canonicalizeFrequency(habit.frequency),
    startDate: habit.startDate || today,
    targetDate: habit.targetDate || '',
    checkins: habit.checkins && typeof habit.checkins === 'object' ? habit.checkins : {},
    completed: habit.completed || false,
  }));
}

export function isValidDateString(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const parsed = new Date(`${dateString}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

export function getDateKey(dateObject) {
  const year = dateObject.getFullYear();
  const month = String(dateObject.getMonth() + 1).padStart(2, '0');
  const day = String(dateObject.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentWeekDates() {
  const today = new Date();
  const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    return date;
  });
}

export function formatDisplayDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getActiveDays(startDateString) {
  const startDate = new Date(`${startDateString}T00:00:00`);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((todayMidnight - startDate) / (1000 * 60 * 60 * 24)));
}

export function isHabitActiveOnDate(habit, date) {
  const habitStart = new Date(`${habit.startDate}T00:00:00`);
  const habitTarget = habit.targetDate ? new Date(`${habit.targetDate}T00:00:00`) : null;
  if (date < habitStart) return false;
  if (habitTarget && date > habitTarget) return false;
  return true;
}

export function isDateScheduledByFrequency(habit, date) {
  const frequency = canonicalizeFrequency(habit.frequency);
  const habitStart = new Date(`${habit.startDate}T00:00:00`);
  if (frequency === 'daily') return true;
  if (frequency === 'weekly') return date.getDay() === habitStart.getDay();
  if (frequency === 'monthly') return date.getDate() === habitStart.getDate();
  return true;
}

export function getDatesInMonth(selectedMonth) {
  const [yearText, monthText] = selectedMonth.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => new Date(year, monthIndex, i + 1));
}

export function getCalendarWeeks(selectedMonth) {
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

export function isHabitActiveInMonth(habit, selectedMonth) {
  const [yearText, monthText] = selectedMonth.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const habitStart = new Date(`${habit.startDate}T00:00:00`);
  const habitTarget = habit.targetDate ? new Date(`${habit.targetDate}T00:00:00`) : null;
  if (habitStart > monthEnd) return false;
  if (habitTarget && habitTarget < monthStart) return false;
  return true;
}
