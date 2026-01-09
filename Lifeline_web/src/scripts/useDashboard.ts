import { useNavigate } from "react-router-dom";
import { authClient } from "./auth-client";
import { connectMessage, disconnectTWS } from "./useWebSocket";
import { useState, useEffect } from 'react'

import type { User, Contact } from "../types";

export function useDashboard() {
  const navigate = useNavigate();
  
  const [message, setMessage] = useState("")
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    
    return () => disconnectTWS();
  }, []);

  const getUserInfo = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/auth/get-session", {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok || !data.user) {
        throw new Error("Not authenticated");
      }

      const firstName = data.user.name?.split(" ")[0] || "User";

      setUser({
        ...data.user,
        name: firstName,
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
      localStorage.removeItem("lifeline_user");
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const displayContact = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:3000/api/contacts/users", {
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

        if (name && phone) {
          formatted.push({ name, email, phone });
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
  };
}
