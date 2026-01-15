import { useNavigate } from "react-router-dom";
import { authClient } from "./auth-client";
import { connectMessage } from "./useWebSocket";
import { useState, useEffect } from 'react'
import { API_BASE_URL } from "../config/api";
import type { User, Contact } from "../types";

//hard coded for testing
const contloc = { //contacts
  contact2_location: { lat: 15.135924992274758, lng: 120.58057235415056},
  contact3_location: { lat: 15.134754688327266, lng: 120.59033559494401},
};
const userloc = { //user
  lat: 15.12080856539815,
  lng: 120.60186959586032,
};

export function useDashboard() {
    const navigate = useNavigate();

    const [user, setUser] = useState<User | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState("")

    const getUserInfo = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
                credentials: "include",
            });

            const data = await res.json();

            if (!res.ok || !data.user) {
                throw new Error("Not authenticated");
            }

            setUser({
                ...data.user,
                name: data.user.name,
                location: userloc,
            });
        } catch (err) {
            console.error("Failed to get user info:", err);
            navigate("/login");
        }
    };
    const handleSOS = () => {
        const wsMsg = connectMessage(setMessage);

        const message = "SOS pressed! Help needed.";

        if (wsMsg.readyState === WebSocket.OPEN) {
            wsMsg.send(message);
        } else {
            wsMsg.onopen = () => wsMsg.send(message);
        }

        wsMsg.onmessage = (event) => {
            setMessage(event.data);
        };
    };

    const handleLogout = async () => {
        try {
            await authClient.signOut();
            window.location.reload();
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };

    const displayContact = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE_URL}/api/contacts/users`, {
                credentials: "include",
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "Failed to load contacts");
            }

            const formatted: Contact[] = [];

            for (let i = 1; i <= 5; i++) {
                const name = data[`contact${i}_name`];
                const email = data[`contact${i}_email`];
                const phone = data[`contact${i}_phone`];
                const location = (contloc as any)[`contact${i}_location`];
                // const image = data[`contact${i}_phone`];
                if (name && phone) {
                    formatted.push({ name, email, phone, location });
                }
            }

            setContacts(formatted);
        } catch (err: any) {
            setError(err.message || "Failed to load contacts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getUserInfo();
        displayContact();
    }, []);

    return {
        user,
        handleLogout,
        handleSOS,
        message,
        contacts,
        loading,
        error,
        displayContact,
        history
    };
}
