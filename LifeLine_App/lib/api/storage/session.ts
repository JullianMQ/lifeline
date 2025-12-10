import * as SecureStore from 'expo-secure-store';

export async function saveToken(token: string) {
    await SecureStore.setItemAsync('token', String(token));
}

export async function getToken() {
    return await SecureStore.getItemAsync('token');
}

export async function removeToken() {
    await SecureStore.deleteItemAsync('token');
}

export async function isAuthenticated(): Promise<boolean> {
    // Returns true if a token exists, false otherwise
    return !!(await SecureStore.getItemAsync('token'));
}