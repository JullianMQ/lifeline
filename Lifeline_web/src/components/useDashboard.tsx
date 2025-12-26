import { useNavigate } from "react-router-dom";
import { authClient } from "./auth-client";

export function useDashboard() {
  const navigate = useNavigate();

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
  };
}
