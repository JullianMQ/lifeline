import * as SecureStore from "expo-secure-store";

const USER_KEY = "auth_user";
const TOKEN_KEY = "auth_token";

export async function saveUser(user: any) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getUser() {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
}

export async function clearUser() {
    await SecureStore.deleteItemAsync(USER_KEY);
}

// --- token helpers ---
export async function saveToken(token: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
    return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export default { saveUser, getUser, clearUser, saveToken, getToken, clearToken };
