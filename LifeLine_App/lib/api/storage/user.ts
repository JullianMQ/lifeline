import * as SecureStore from "expo-secure-store";

const USER_KEY = "auth_user";

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

export default { saveUser, getUser, clearUser };