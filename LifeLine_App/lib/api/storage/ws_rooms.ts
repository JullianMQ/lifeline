import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persist the "owner roomId" per user so switching accounts on the same device
 * can re-join the same owner room (instead of creating duplicate rooms).
 *
 * Room IDs are not secrets, so AsyncStorage is appropriate.
 */

const KEY_PREFIX = "lifeline:ws:ownerRoomId:";

function keyFor(userId: string) {
    return `${KEY_PREFIX}${userId}`;
}

export async function getOwnerRoomId(userId: string): Promise<string | null> {
    try {
        const v = await AsyncStorage.getItem(keyFor(userId));
        const id = (v ?? "").trim();
        return id ? id : null;
    } catch {
        return null;
    }
}

export async function setOwnerRoomId(userId: string, roomId: string): Promise<void> {
    const id = (roomId ?? "").trim();
    if (!id) return;

    try {
        await AsyncStorage.setItem(keyFor(userId), id);
    } catch {
        // ignore
    }
}

export async function clearOwnerRoomId(userId: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(keyFor(userId));
    } catch {
        // ignore
    }
}
