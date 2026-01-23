import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'onboarding_complete';

export const setOnboardingComplete = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
};

export const clearOnboarding = async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
};

export const isOnboardingComplete = async (): Promise<boolean> => {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return val === 'true';
};
