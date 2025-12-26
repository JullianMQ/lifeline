import { useState } from 'react'
import '../styles/dashboard.css'
import { useDashboard } from "../components/useDashboard.tsx";


function Dashboard() {
  const [count, setCount] = useState(0)
  const { 
    handleLogout, 
  } = useDashboard();
  return (
    <main className='dashboard'>
    <section>
      <h1>Dashboard</h1>
      <button onClick={handleLogout}>
        logout
      </button>
    </section>
    </main>
  )
}

export default Dashboard
