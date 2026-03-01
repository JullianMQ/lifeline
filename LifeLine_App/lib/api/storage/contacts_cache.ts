import AsyncStorage from "@react-native-async-storage/async-storage";

// Cache contacts locally so SMS fallback can still access emergency numbers
// when the network/API is unavailable.

const KEY_CONTACTS_CACHE = "contacts_cache_v1";

export type CachedContact = {
    id: string;
    name: string;
    phone_no: string;
    email?: string;
    role?: "mutual" | "dependent";
    image?: string | null;
    type?: "emergency" | "dependent";
};

export async function cacheContacts(contacts: CachedContact[]) {
    try {
        await AsyncStorage.setItem(KEY_CONTACTS_CACHE, JSON.stringify({
            t: Date.now(),
            contacts,
        }));
    } catch {
        // ignore cache failures
    }
}

export async function getCachedContacts(): Promise<CachedContact[]> {
    try {
        const raw = await AsyncStorage.getItem(KEY_CONTACTS_CACHE);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.contacts) ? parsed.contacts : [];
    } catch {
        return [];
    }
}

export async function getCachedEmergencyPhoneNumbers(): Promise<string[]> {
    const contacts = await getCachedContacts();
    const nums = contacts
        .filter((c) => (c as any).type === "emergency")
        .map((c) => String(c.phone_no || "").trim())
        .filter((p) => !!p);

    // de-dupe
    return Array.from(new Set(nums));
}
