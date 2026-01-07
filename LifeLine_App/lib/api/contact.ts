import { API_BASE_URL } from "./config";

export interface Contact {
    id: number;
    name: string;
}

// Fetch contacts
export const getContacts = async (): Promise<Contact[]> => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/contacts`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });

        if (!res.ok) {
            console.warn("Failed to fetch contacts:", res.status);
            return [];
        }

        const data = await res.json();

        const contactsArray: Contact[] = Object.keys(data)
            .filter((key) => key.startsWith("emergency_contact"))
            .map((key, idx) => ({
                id: idx + 1,
                name: data[key],
            }))
            .filter((c) => c.name);

        return contactsArray;
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
