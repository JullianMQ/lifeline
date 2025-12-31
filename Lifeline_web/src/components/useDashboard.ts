import { useNavigate } from "react-router-dom";
import { authClient } from "./auth-client";
import { connectTime, connectMessage, disconnectTWS } from "./useWebSocket";
import { useState, useEffect } from 'react'

export function useDashboard() {
  const navigate = useNavigate();
  const [time, setTime] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const wsTime = connectTime(setTime);
    return () => disconnectTWS();
  }, []);

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

  return {
    handleLogout,
    handleSOS,
    message,
    time,
  };
}
