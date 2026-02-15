import { API_BASE_URL } from "./config";
import { getUser, saveUser } from "./storage/user";

export interface Contact {
    id: string;
    name: string;
    phone_no: string;
    email: string;
    role: "mutual" | "dependent";
    image: string | null;
    type: "emergency" | "dependent";
}

const mapContact = (
    c: any,
    index: number,
    prefix: string,
    type: "emergency" | "dependent"
): Contact => ({
    id: `${prefix}-${index}`,
    name: String(c.name),
    phone_no: String(c.phone_no),
    email: String(c.email),
    role: c.role,
    image: c.image,
    type,
});

// Small helper: safely parse response body that might be JSON or plain text
const readAsJsonOrText = async (res: Response) => {
    const text = await res.text();
    if (!text) return { text: "", json: null as any };

    try {
        return { text, json: JSON.parse(text) };
    } catch {
        return { text, json: null as any };
    }
};

// Fetch contacts
export const getContacts = async (): Promise<Contact[]> => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/contacts/users`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        });

        if (!res.ok) return [];

        const data = await res.json();

        const emergencyContacts = (data.emergency_contacts ?? []).map(
            (c: any, index: number) => mapContact(c, index, "em", "emergency")
        );
        const dependentContacts = (data.dependent_contacts ?? []).map(
            (c: any, index: number) => mapContact(c, index, "dep", "dependent")
        );
        return [...emergencyContacts, ...dependentContacts];
    } catch (error) {
        console.error("Error fetching contacts:", error);
        return [];
    }
};

// Save contacts
export const saveContacts = async (contacts: any) => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/contacts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(contacts),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to save contacts");
        }

        return await res.json();
    } catch (err) {
        throw new Error("Failed to save contacts: " + err);
    }
};

// get user by number
export const getUserByPhone = async (phone: string): Promise<Contact | null> => {
    try {
        console.log("Fetching user by phone:", phone);

        const res = await fetch(`${API_BASE_URL}/api/contacts/${encodeURIComponent(phone)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        });

        console.log("Fetch response status:", res.status);

        if (res.status === 404) {
            console.log("User not found (404)");
            return null;
        }

        if (!res.ok) {
            const text = await res.text();
            console.log("Fetch failed, response:", text);
            throw new Error("Failed to fetch user");
        }

        const data = await res.json();
        console.log("User data received:", data);
        return data;
    } catch (err) {
        console.error("getUserByPhone error:", err);
        throw err;
    }
};

export const checkPhone = async (phone: string) => {
    const res = await fetch(`${API_BASE_URL}/api/check/phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone }),
    });

    const { text, json } = await readAsJsonOrText(res);

    if (!res.ok) {
        const msg = json?.message || json?.error || text || "Phone number already in use";
        throw new Error(msg);
    }

    return json ?? text;
};

export const generateMagicLinkQr = async ({
    email,
    name,
    callbackURL = "lifeline://landing",
    newUserCallbackURL = "lifeline://landing",
    errorCallbackURL = "lifeline://landing",
}: {
    email: string;
    name: string;
    callbackURL: string;
    newUserCallbackURL?: string;
    errorCallbackURL?: string;
}): Promise<string> => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/magic-link/qr`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                name,
                callbackURL,
                newUserCallbackURL,
                errorCallbackURL,
            }),
        });

        const text = await res.text();
        console.log("Raw QR API response:", text);

        if (!res.ok) {
            throw new Error(`Server error: ${text}`);
        }

        const data = JSON.parse(text);

        if (!data.url) {
            throw new Error("Failed to generate QR: missing URL");
        }

        return data.url;
    } catch (err: any) {
        console.error("QR generation failed:", err);
        throw err;
    }
};

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    emailVerified?: boolean;
    image: string | null;
    role: "mutual" | "dependent";
    phone_no: string;
    createdAt?: string;
    updatedAt?: string;
}

export type UpdateProfilePayload = {
    name?: string;
    phone_no?: string;
    role?: "mutual" | "dependent" | "";
    image?: string;
};
export const getMyProfile = async (): Promise<UserProfile> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const { text, json } = await readAsJsonOrText(res);

    if (!res.ok) {
        const msg = json?.message || json?.error || text || "Failed to fetch profile";
        throw new Error(msg);
    }

    const user = json?.user;
    if (!user) throw new Error("Invalid session response: missing user");

    return {
        id: String(user.id),
        name: String(user.name ?? ""),
        email: String(user.email ?? ""),
        emailVerified: user.emailVerified,
        image: user.image ?? null,
        role: user.role,
        phone_no: String(user.phone_no ?? ""),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};

export const updateMyProfile = async (payload: UpdateProfilePayload) => {
    const body: any = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.phone_no !== undefined) body.phone_no = payload.phone_no;
    if (payload.role !== undefined) body.role = payload.role;

    const res = await fetch(`${API_BASE_URL}/api/update-user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
    });

    const { text, json } = await readAsJsonOrText(res);

    if (!res.ok) {
        const msg = json?.message || json?.error || text || "Failed to update profile";
        throw new Error(msg);
    }

    const current = await getUser();
    const merged: UserProfile = {
        ...(current ?? {}),
        ...body,
        image: (current?.image ?? null),
    };

    await saveUser(merged);

    return json ?? merged;
};
