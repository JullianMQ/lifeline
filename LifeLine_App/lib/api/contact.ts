import { API_BASE_URL } from "./config";

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
            headers: {
                "Content-Type": "application/json",
            },
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

        console.log("Sending QR generate payload:", {
            email,
            name,
            callbackURL,
            newUserCallbackURL,
            errorCallbackURL,
        });

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

