import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadHabits, saveHabits } from '../utils/storage';
import {
  normalizeHabits, getTodayDateString, getCurrentWeekDates,
  getDateKey, canonicalizeFrequency, getActiveDays, formatDisplayDate,
  isHabitActiveOnDate, isDateScheduledByFrequency,
} from '../utils/habitUtils';

const C = {
  bg: '#FEFAE6',
  primary: '#E87C3A',
  secondary: '#BE7961',
  border: '#F3C248',
  card: '#FFFFFF',
};

export default function HomeScreen() {
  const [habits, setHabits] = useState([]);
  const [habitName, setHabitName] = useState('');
  const [frequency, setFrequency] = useState('daily');

  useFocusEffect(
    useCallback(() => {
      loadHabits().then((data) => setHabits(normalizeHabits(data)));
    }, [])
  );

  async function persist(updated) {
    setHabits(updated);
    await saveHabits(updated);
  }

  function addHabit() {
    const name = habitName.trim();
    if (!name) {
      Alert.alert('Habit name cannot be empty.');
      return;
    }
    persist([
      ...habits,
      {
        name,
        frequency: canonicalizeFrequency(frequency),
        completed: false,
        startDate: getTodayDateString(),
        targetDate: '',
        checkins: {},
      },
    ]);
    setHabitName('');
    setFrequency('daily');
  }

  function toggleHabit(index) {
    const todayKey = getTodayDateString();
    persist(
      habits.map((h, i) => {
        if (i !== index) return h;
        const completed = !h.completed;
        return { ...h, completed, checkins: { ...h.checkins, [todayKey]: completed } };
      })
    );
  }

  function deleteHabit(index) {
    Alert.alert('Delete Habit', `Delete "${habits[index].name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => persist(habits.filter((_, i) => i !== index)),
      },
    ]);
  }

  function toggleWeekCheck(habitIndex, dateKey) {
    persist(
      habits.map((h, i) => {
        if (i !== habitIndex) return h;
        const next = !h.checkins[dateKey];
        const completed = dateKey === getTodayDateString() ? next : h.completed;
        return { ...h, completed, checkins: { ...h.checkins, [dateKey]: next } };
      })
    );
  }

  const total = habits.length;
  const completedCount = habits.filter((h) => h.completed).length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const weekDates = getCurrentWeekDates();
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Date and status */}
      <View style={styles.infoRow}>
        <Text style={styles.dateText}>{todayStr}</Text>
        <Text style={styles.statusText}>{completedCount}/{total} done</Text>
      </View>

      {/* Progress bar */}
      {total > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Today's Progress</Text>
            <Text style={styles.progressLabel}>{percent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
        </View>
      )}

      {/* Add habit card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add a new habit</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Drink 8 glasses of water"
          placeholderTextColor="#BE7961"
          value={habitName}
          onChangeText={setHabitName}
          returnKeyType="done"
          onSubmitEditing={addHabit}
        />
        <FrequencyPicker value={frequency} onChange={setFrequency} />
        <TouchableOpacity style={styles.addBtn} onPress={addHabit}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Weekly checkoff */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Checkoff</Text>
        {habits.length === 0 ? (
          <Text style={styles.emptyText}>No habits yet</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header row */}
              <View style={styles.tableRow}>
                <View style={styles.habitNameCol}>
                  <Text style={styles.tableHead}>Habit</Text>
                </View>
                {weekDates.map((d, i) => (
                  <View key={i} style={styles.dayCol}>
                    <Text style={styles.tableHead}>
                      {d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                    </Text>
                    <Text style={styles.tableHead}>{d.getDate()}</Text>
                  </View>
                ))}
              </View>
              {/* Habit rows */}
              {habits.map((habit, hIdx) => (
                <View key={hIdx} style={styles.tableRow}>
                  <View style={styles.habitNameCol}>
                    <Text style={styles.habitNameColText} numberOfLines={2}>
                      {habit.name}
                    </Text>
                  </View>
                  {weekDates.map((d, dIdx) => {
                    const dk = getDateKey(d);
                    const eligible =
                      isHabitActiveOnDate(habit, d) && isDateScheduledByFrequency(habit, d);
                    const checked = habit.checkins[dk];
                    return (
                      <View key={dIdx} style={styles.dayCol}>
                        {eligible ? (
                          <TouchableOpacity
                            style={[styles.weekCell, checked && styles.weekCellChecked]}
                            onPress={() => toggleWeekCheck(hIdx, dk)}
                          />
                        ) : (
                          <View style={styles.weekCellInactive} />
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

      {/* Habit list */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Habits</Text>
        {habits.length === 0 ? (
          <Text style={styles.emptyText}>No habits yet. Add one above to get started!</Text>
        ) : (
          habits.map((habit, index) => (
            <View key={index} style={[styles.habitItem, habit.completed && styles.habitItemDone]}>
              <TouchableOpacity
                style={[styles.checkBtn, habit.completed && styles.checkBtnDone]}
                onPress={() => toggleHabit(index)}
              >
                {habit.completed && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
              <View style={styles.habitDetails}>
                <Text
                  style={[styles.habitName, habit.completed && styles.habitNameDone]}
                  numberOfLines={2}
                >
                  {habit.name}
                </Text>
                <Text style={styles.habitMeta}>
                  {formatDisplayDate(habit.startDate)} • {getActiveDays(habit.startDate)}d •{' '}
                  {habit.frequency}
                </Text>
              </View>
              {habit.completed && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Done!</Text>
                </View>
              )}
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteHabit(index)}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function FrequencyPicker({ value, onChange }) {
  return (
    <View style={styles.freqRow}>
      {['daily', 'weekly', 'monthly'].map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.freqBtn, value === opt && styles.freqBtnActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.freqBtnText, value === opt && styles.freqBtnTextActive]}>
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: { fontSize: 13, color: C.secondary },
  statusText: { fontSize: 18, fontWeight: 'bold', color: C.primary },
  progressSection: { marginBottom: 16 },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 13, color: C.secondary },
  progressTrack: {
    height: 10,
    backgroundColor: '#FAF4BD',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 9999 },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: C.secondary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.secondary, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: C.secondary,
    marginBottom: 10,
  },
  freqRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  freqBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  freqBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  freqBtnText: { fontSize: 13, color: C.secondary, fontWeight: '600' },
  freqBtnTextActive: { color: '#fff' },
  addBtn: { backgroundColor: C.primary, borderRadius: 8, padding: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyText: { color: C.secondary, textAlign: 'center', paddingVertical: 16 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f2dfb2',
  },
  habitNameCol: { width: 110, paddingVertical: 8, paddingRight: 8 },
  habitNameColText: { fontSize: 12, color: C.secondary },
  tableHead: { fontSize: 12, color: '#8a5b47', fontWeight: '600', textAlign: 'center' },
  dayCol: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  weekCell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#d9a57d',
    backgroundColor: '#fff',
  },
  weekCellChecked: { backgroundColor: C.primary, borderColor: C.primary },
  weekCellInactive: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f5f0e3' },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  habitItemDone: { borderColor: C.primary, backgroundColor: '#f5f3ff' },
  checkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkBtnDone: { backgroundColor: C.primary, borderColor: C.primary },
  checkMark: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  habitDetails: { flex: 1 },
  habitName: { fontSize: 14, color: C.secondary },
  habitNameDone: { textDecorationLine: 'line-through', opacity: 0.7, color: C.primary },
  habitMeta: { fontSize: 11, color: C.secondary, marginTop: 2 },
  badge: {
    backgroundColor: '#ede9fe',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, color: C.primary, fontWeight: '700' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { color: '#d1d5db', fontSize: 18 },
});
