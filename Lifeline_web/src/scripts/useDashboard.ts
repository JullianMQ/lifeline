import { useNavigate } from "react-router-dom";
import { authClient } from "./auth-client";
import { connectMessage } from "./useWebSocket";
import { useState, useEffect } from 'react'
import { API_BASE_URL } from "../config/api";
import type { User, Contact } from "../types";

// TODO: remove when ws is implemented
const contloc = [//contacts
    { lat: 15.135924992274758, lng: 120.58057235415056},
    { lat: 15.134754688327266, lng: 120.59033559494401}
];
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

            const userContacts: Array<{  
                name: string;  
                email?: string;  
                phone_no: string;  
                image?: string;  
                role: string;  
            }> = [  
                ...(data.emergency_contacts || []),  
                ...(data.dependent_contacts || []),  
            ];  
            
            const formatted: Contact[] = userContacts.map((user, index) => ({
                name: user.name,
                email: user.email,
                phone: user.phone_no,
                image: user.image,
                role: user.role as "mutual" | "dependent",
                location: contloc[index], 
            }));
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
    };
}
