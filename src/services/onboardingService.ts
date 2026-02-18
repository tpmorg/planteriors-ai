import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY = '@planterior_onboarding_completed';

const setOnboardingCompletedValue = async (completed: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, completed ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to store onboarding completion status:', error);
  }
};

export const onboardingService = {
  async isCompleted(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Failed to read onboarding completion status:', error);
      return false;
    }
  },

  async markCompleted(): Promise<void> {
    await setOnboardingCompletedValue(true);
  },

  async setCompleted(completed: boolean): Promise<void> {
    await setOnboardingCompletedValue(completed);
  },
};
