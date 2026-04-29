import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadHabits, saveHabits } from '../utils/storage';
import {
  normalizeHabits, canonicalizeFrequency, formatDisplayDate,
  getActiveDays, isValidDateString,
} from '../utils/habitUtils';

const C = {
  bg: '#FEFAE6',
  primary: '#E87C3A',
  secondary: '#BE7961',
  border: '#F3C248',
  card: '#FFFFFF',
  navy: '#33659C',
};

export default function EditHabitsScreen() {
  const [habits, setHabits] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editFrequency, setEditFrequency] = useState('daily');

  useFocusEffect(
    useCallback(() => {
      loadHabits().then((data) => {
        setHabits(normalizeHabits(data));
        setEditingIndex(null);
      });
    }, [])
  );

  async function persist(updated) {
    setHabits(updated);
    await saveHabits(updated);
  }

  function beginEdit(index) {
    const h = habits[index];
    setEditName(h.name);
    setEditStartDate(h.startDate);
    setEditTargetDate(h.targetDate || '');
    setEditFrequency(h.frequency);
    setEditingIndex(index);
  }

  function cancelEdit() {
    setEditingIndex(null);
  }

  async function saveEdit() {
    const name = editName.trim();
    if (!name) { Alert.alert('Habit name cannot be empty.'); return; }
    if (!isValidDateString(editStartDate)) {
      Alert.alert('Start date must be in YYYY-MM-DD format.');
      return;
    }
    if (editTargetDate && !isValidDateString(editTargetDate)) {
      Alert.alert('Target date must be in YYYY-MM-DD format.');
      return;
    }
    const updated = habits.map((h, i) =>
      i !== editingIndex
        ? h
        : {
            ...h,
            name,
            frequency: canonicalizeFrequency(editFrequency),
            startDate: editStartDate,
            targetDate: editTargetDate,
          }
    );
    setEditingIndex(null);
    await persist(updated);
  }

  function deleteHabit(index) {
    Alert.alert('Delete Habit', `Delete "${habits[index].name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingIndex === index) setEditingIndex(null);
          persist(habits.filter((_, i) => i !== index));
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Habits</Text>

        {habits.length === 0 ? (
          <Text style={styles.emptyText}>
            No habits yet. Add one on the Home screen!
          </Text>
        ) : (
          habits.map((habit, index) => (
            <View key={index} style={styles.habitItem}>
              {editingIndex === index ? (
                /* ── Edit form ── */
                <View style={styles.editForm}>
                  <Text style={styles.editLabel}>Habit name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editName}
                    onChangeText={setEditName}
                  />

                  <Text style={styles.editLabel}>Start date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editStartDate}
                    onChangeText={setEditStartDate}
                    keyboardType="numbers-and-punctuation"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#BE7961"
                  />

                  <Text style={styles.editLabel}>
                    Target/end date (optional, YYYY-MM-DD)
                  </Text>
                  <TextInput
                    style={styles.editInput}
                    value={editTargetDate}
                    onChangeText={setEditTargetDate}
                    keyboardType="numbers-and-punctuation"
                    placeholder="Leave blank for no end date"
                    placeholderTextColor="#BE7961"
                  />

                  <Text style={styles.editLabel}>Frequency</Text>
                  <FrequencyPicker value={editFrequency} onChange={setEditFrequency} />

                  <View style={styles.editBtnRow}>
                    <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                      <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* ── Display row ── */
                <View style={styles.habitRow}>
                  <View style={styles.habitDetails}>
                    <Text style={styles.habitName}>{habit.name}</Text>
                    <Text style={styles.habitMeta}>
                      {formatDisplayDate(habit.startDate)} •{' '}
                      {getActiveDays(habit.startDate)}d • {habit.frequency}
                      {habit.targetDate
                        ? ` • ends ${formatDisplayDate(habit.targetDate)}`
                        : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => beginEdit(index)}
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deleteHabit(index)}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
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
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: C.secondary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.secondary, marginBottom: 12 },
  emptyText: { color: C.secondary, textAlign: 'center', paddingVertical: 16 },
  habitItem: {
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fafafa',
  },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  habitDetails: { flex: 1 },
  habitName: { fontSize: 14, color: C.secondary, fontWeight: '600' },
  habitMeta: { fontSize: 11, color: C.secondary, marginTop: 2 },
  editBtn: {
    backgroundColor: C.navy,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editBtnText: { color: '#FAF4BD', fontSize: 12, fontWeight: '700' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { color: '#d1d5db', fontSize: 18 },
  editForm: { gap: 4 },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8a5b47',
    marginTop: 10,
    marginBottom: 4,
  },
  editInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: C.secondary,
  },
  freqRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  freqBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  freqBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  freqBtnText: { fontSize: 12, color: C.secondary, fontWeight: '600' },
  freqBtnTextActive: { color: '#fff' },
  editBtnRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  saveBtn: {
    flex: 1,
    backgroundColor: C.navy,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FAF4BD', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#8b95a5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
