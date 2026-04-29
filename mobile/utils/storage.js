import AsyncStorage from '@react-native-async-storage/async-storage';

const HABITS_KEY = 'habits';

export async function loadHabits() {
  try {
    const json = await AsyncStorage.getItem(HABITS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveHabits(habits) {
  try {
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  } catch {
    // ignore write failures silently
  }
}
