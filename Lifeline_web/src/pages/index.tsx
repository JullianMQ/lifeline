import { useState } from 'react'
import '../styles/index.css'
import { Link } from "react-router-dom";

function Index() {
  const [count, setCount] = useState(0)

  return (
    <main className='landing'>
      <div className='content'>
        <section className='left'>
          <article className='mobile'>
            <div className='logo'>
              <img src="src\assets\LifelineLogo.png" alt="Lifeline" className='lifeline-logo'/>
              <h3 className='lifeline-text head-title'>LIFELINE</h3>
            </div>
            <div className='btn'>
              <Link to="/login">
                <button className='pos-btn'>Login</button>
              </Link>
              <Link to="/signup">
                <button className='neg-btn'>Signup</button>
              </Link>
            </div>
          </article>
        </section>
        <section className='right'>
          <h1>LIFELINE</h1>
          <div className='context'>
            <h2>Download our mobile app now!</h2>
            <p>Your <strong>Lifeline</strong> in moments of uncertainty, ensuring help is ready the moment you feel unsafe.</p>
          </div>
          <button className='pos-btn'>
            Install Now
          </button>
        </section>
      </div>
    </main>
  )
}

export default Index
