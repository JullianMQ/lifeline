import { useState } from 'react'
import '../styles/dashboard.css'
import { useDashboard } from "../components/useDashboard.tsx";


function Dashboard() {
  const [count, setCount] = useState(0)
  const { handleLogout } = useDashboard()
  return (
    <main className='dashboard'>
      <header>
        <h2 className='head-title'>Lifeline</h2>
        <button className='logout-btn'  onClick={handleLogout}>
          LOGOUT
        </button>
      </header>
      
      <section className='dashboard-body'>
        <div className='dashboard-content'>
          <div className='dashboard-user'>
            <img src="src\assets\user-example.svg" alt="" />
            <div className="dashboard-user-info">
              <p>Hey there,</p>
              <h1>John Doe</h1>
            </div>
          </div>

          <div className='dashboard-contacts'>
            <ul>
              <li className='dashboard-card'>
                <img src="src\assets\user-example.svg" alt="" />
                <h3>John Doe</h3>
              </li>
              <li className='dashboard-card'>
                <img src="src\assets\user-example.svg" alt="" />
                <h3>John Doe</h3>
              </li>
              <li className='dashboard-card'>
                <img src="src\assets\user-example.svg" alt="" />
                <h3>John Doe</h3>
              </li>
            </ul>
          </div>
        </div>
        <div className="map">

        </div>
      </section>
      
      <footer>
        
      </footer>
    </main>
  )
}

export default Dashboard
