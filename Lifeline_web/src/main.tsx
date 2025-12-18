import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";

import './main.css'
import Index from './pages/index.tsx'
import Login from './pages/login.tsx'
import Signup from './pages/signup.tsx'
import Dashboard from './pages/dashboard.tsx'
import AddContact from './pages/addContact.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/addContact" element={<AddContact />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
