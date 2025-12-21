import { useState } from 'react';
import '../styles/login.css';
import { Link } from "react-router-dom";
import { useLogin } from '../components/useLogin.tsx';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, invalidFields } = useLogin();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await login({ email, password });

    if (result) {
      window.location.href = '/dashboard';
    }
  };

  return (
    <main className='login'>
      <section className='login-card'>
        <div className="card">

          <div className="login-logo">
            <img src="src/assets/LifelineLogo.png" alt="Lifeline" className='lifeline-logo-mini'/>
            <h1 className='lifeline-text'>LOGIN</h1>
          </div>

          <form className="form" onSubmit={handleLogin}>
            <input 
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={invalidFields.includes("email") ? "invalid" : ""}
            />
            <input 
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={invalidFields.includes("password") ? "invalid" : ""}
            />

            {error && <p className="error-text">{error}</p>}

            <button className='pos-btn' type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <div className="line">
              <hr />
              <img src="src/assets/location.svg" alt="Location" />
              <hr />
            </div>

            <div className="google">
              <button className='neg-btn' type="button">
                <img src="src/assets/google.svg" alt="Google-Logo" className='google-logo' />
                <p>Login with Google</p>
              </button>
            </div>

          </form>
        </div>

        <div className='switch'>
          <p>Don’t have an account yet?<Link to="/signup"> Signup</Link></p>
        </div>
      </section>
    </main>
  );
}

export default Login;