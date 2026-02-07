import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/unauthorized.css';

function Unauthorized() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <main className='unauthorized'>
      <div className='unauthorized-content'>
        <div className='unauthorized-card'>
          <div className='unauthorized-icon'>
            <img src="/images/LifelineLogo.png" alt="Lifeline" className='unauthorized-logo' />
          </div>
          <h1>Access Restricted</h1>
          <div className='unauthorized-message'>
            <h3>This area is for guardians only</h3>
            <p>
              The web dashboard is designed for guardians to manage their contacts and settings. 
              As a dependent, you can access all features through our mobile app.
            </p>
          </div>
          <div className='redirect-info'>
            <p>Redirecting to login in <strong>{countdown}</strong> second{countdown !== 1 ? 's' : ''}...</p>
            <button className='pos-btn' onClick={() => navigate('/login')}>
              Go to Login Now
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Unauthorized;
