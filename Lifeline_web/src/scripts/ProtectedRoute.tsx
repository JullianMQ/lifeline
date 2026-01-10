import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { API_BASE_URL } from "../config/api";

type ProtectedRouteProps = {
  children: ReactNode;
  mode?: "protected" | "public"; // default to protected
};

export function ProtectedRoutes({ children, mode = "protected" }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/get-session`, { credentials: "include" });
        const data = await res.json();
        setSession(data.user || null);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (mode === "protected") {
    if (!session) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    if (!session.phone_no && location.pathname !== "/phoneNumber") {
      return <Navigate to="/phoneNumber" state={{ from: location }} replace />;
    }
    return <>{children}</>;
  }

  if (mode === "public") {
    if (session) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  return null;
}
