const BASE_URL = "http://localhost:5678/webhook-test/contacts";

export const getContacts = async (token: string) => {
    const res = await fetch(BASE_URL, {
        headers: {
            "Authorization": `Bearer ${token}`,
        },
    });

    return await res.json();
};

export const saveContacts = async (contacts: any, token: string) => {
    const res = await fetch(BASE_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(contacts),
    });

    return await res.json();
};
