import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"

import "./main.css"
import Index from "./pages/index.tsx"
import Login from "./pages/login.tsx"
import Signup from "./pages/signup.tsx"
import PhoneNumber from "./pages/phoneNumber.tsx"
import Dashboard from "./pages/dashboard.tsx"
import AddContact from "./pages/addContact.tsx"
import Profile from "./pages/profile.tsx"
import { ProtectedRoutes } from "./scripts/ProtectedRoute"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<ProtectedRoutes mode="public"><Login /></ProtectedRoutes>} />
        <Route path="/signup" element={<ProtectedRoutes mode="public"><Signup /></ProtectedRoutes>} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<ProtectedRoutes mode="protected"><Dashboard /></ProtectedRoutes>} />
        <Route path="/phoneNumber" element={<ProtectedRoutes mode="protected"><PhoneNumber /></ProtectedRoutes>} />
        <Route path="/addContact" element={<ProtectedRoutes mode="protected"><AddContact /></ProtectedRoutes>} />
        <Route path="/profile" element={<ProtectedRoutes mode="protected"><Profile /></ProtectedRoutes>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
