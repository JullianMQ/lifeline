import { useNavigate } from "react-router-dom";

export function useDashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
    });

    localStorage.removeItem("lifeline_user");
    localStorage.removeItem("lifeline_google_token");
    localStorage.removeItem("loginID");
    localStorage.removeItem("userID");
    localStorage.removeItem("username");

      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return {
    handleLogout,
  };
}
