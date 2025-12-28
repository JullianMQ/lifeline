import { useState, useEffect } from 'react'
import '../styles/dashboard.css'
import { useDashboard } from "../components/useDashboard";


function Dashboard() {
  const { 
    handleLogout,
    handleSOS,
    message,
    time,
  } = useDashboard();
  return (
    <main className='dashboard'>
    <section>
      <h1>Dashboard</h1>
      <h3>Server Time: {time}</h3>
      <p>Server Message: {message}</p>
      <button onClick={handleSOS}>
        sos
      </button>
      <button onClick={handleLogout}>
        logout
      </button>
    </section>
    </main>
  )
}

export default Dashboard
