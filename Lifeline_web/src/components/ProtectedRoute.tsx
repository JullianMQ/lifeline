import { Navigate } from "react-router-dom";

type ProtectedRouteProps = {
  children: JSX.Element;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isLoggedIn = !!localStorage.getItem("lifeline_user"); 

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
