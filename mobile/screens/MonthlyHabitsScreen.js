import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadHabits, saveHabits } from '../utils/storage';
import {
  normalizeHabits, getTodayDateString, getCurrentMonthString,
  getCalendarWeeks, getDateKey, isHabitActiveInMonth,
  isHabitActiveOnDate, isDateScheduledByFrequency,
} from '../utils/habitUtils';

const C = {
  bg: '#FEFAE6',
  primary: '#E87C3A',
  secondary: '#BE7961',
  border: '#F3C248',
  card: '#FFFFFF',
};

export default function MonthlyHabitsScreen() {
  const [habits, setHabits] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthString());

  useFocusEffect(
    useCallback(() => {
      loadHabits().then((data) => setHabits(normalizeHabits(data)));
    }, [])
  );

  async function toggleMonthCheck(habitIndex, dateKey) {
    const updated = habits.map((h, i) => {
      if (i !== habitIndex) return h;
      const next = !h.checkins[dateKey];
      const completed = dateKey === getTodayDateString() ? next : h.completed;
      return { ...h, completed, checkins: { ...h.checkins, [dateKey]: next } };
    });
    setHabits(updated);
    await saveHabits(updated);
  }

  function changeMonth(delta) {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${y}-${m}`);
  }

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const monthIndex = month - 1;
  const weekGroups = getCalendarWeeks(selectedMonth);
  const activeHabits = habits
    .map((habit, index) => ({ habit, index }))
    .filter(({ habit }) => isHabitActiveInMonth(habit, selectedMonth));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Month navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {weekGroups.map((weekDates, weekIndex) => {
        const inMonthDates = weekDates.filter((d) => d.getMonth() === monthIndex);
        if (inMonthDates.length === 0) return null;

        const weekHabits = activeHabits.filter(({ habit }) =>
          inMonthDates.some(
            (d) => isHabitActiveOnDate(habit, d) && isDateScheduledByFrequency(habit, d)
          )
        );
        const first = inMonthDates[0].getDate();
        const last = inMonthDates[inMonthDates.length - 1].getDate();

        return (
          <View key={weekIndex} style={styles.weekBlock}>
            <Text style={styles.weekTitle}>
              Week {weekIndex + 1} ({first}–{last})
            </Text>
            {weekHabits.length === 0 ? (
              <Text style={styles.emptyText}>No habits scheduled this week</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Header row */}
                  <View style={styles.tableRow}>
                    <View style={styles.habitNameCol}>
                      <Text style={styles.tableHead}>Habit</Text>
                    </View>
                    {weekDates.map((d, i) => {
                      const isInMonth = d.getMonth() === monthIndex;
                      return (
                        <View key={i} style={styles.dayCol}>
                          <Text style={[styles.tableHead, !isInMonth && styles.tableHeadMuted]}>
                            {d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                          </Text>
                          <Text style={[styles.tableHead, !isInMonth && styles.tableHeadMuted]}>
                            {d.getDate()}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {/* Habit rows */}
                  {weekHabits.map(({ habit, index }) => (
                    <View key={index} style={styles.tableRow}>
                      <View style={styles.habitNameCol}>
                        <Text style={styles.habitNameText} numberOfLines={2}>
                          {habit.name}
                        </Text>
                      </View>
                      {weekDates.map((d, dIdx) => {
                        const isInMonth = d.getMonth() === monthIndex;
                        if (!isInMonth) {
                          return (
                            <View key={dIdx} style={styles.dayCol}>
                              <View style={styles.checkCellInactive} />
                            </View>
                          );
                        }
                        const dk = getDateKey(d);
                        const eligible =
                          isHabitActiveOnDate(habit, d) && isDateScheduledByFrequency(habit, d);
                        const checked = habit.checkins[dk];
                        return (
                          <View key={dIdx} style={styles.dayCol}>
                            {eligible ? (
                              <TouchableOpacity
                                style={[styles.checkCell, checked && styles.checkCellChecked]}
                                onPress={() => toggleMonthCheck(index, dk)}
                              />
                            ) : (
                              <View style={styles.checkCellInactive} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: { padding: 12 },
  navBtnText: { fontSize: 32, color: C.primary, fontWeight: '300' },
  monthLabel: { fontSize: 17, fontWeight: '700', color: C.secondary },
  weekBlock: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    shadowColor: C.secondary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  weekTitle: { fontSize: 13, fontWeight: '700', color: '#8a5b47', marginBottom: 10 },
  emptyText: { color: C.secondary, textAlign: 'center', paddingVertical: 12, fontSize: 13 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f2dfb2',
  },
  habitNameCol: { width: 110, paddingVertical: 8, paddingRight: 8 },
  habitNameText: { fontSize: 12, color: C.secondary },
  tableHead: { fontSize: 11, color: '#8a5b47', fontWeight: '600', textAlign: 'center' },
  tableHeadMuted: { color: '#ccc5b5' },
  dayCol: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkCell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#d9a57d',
    backgroundColor: '#fff',
  },
  checkCellChecked: { backgroundColor: C.primary, borderColor: C.primary },
  checkCellInactive: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f5f0e3' },
});
