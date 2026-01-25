import { useState } from 'react';
import '../styles/login.css';
import { Link } from "react-router-dom";
import { useLogin } from '../scripts/useLogin';
import { googleAuth } from "../scripts/googleAuth";
import { API_BASE_URL } from '../config/api';

function Login() {
    // TODO: DELETE CONSOLE LOGS
    // console.log(API_BASE_URL)
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, loading, error, invalidFields } = useLogin();
    const { handleGoogleLogin } = googleAuth();

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
                        <img src="/images/LifelineLogo.png" alt="Lifeline" className='lifeline-logo-mini' />
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

                        {error && <p className="error">{error}</p>}

                        <button className='pos-btn' type="submit" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login'}
                        </button>

                        <div className="line">
                            <hr />
                            <img src="/images/location.svg" alt="Location" />
                            <hr />
                        </div>

                        <div className="google">
                            <button className='neg-btn' type="button" onClick={handleGoogleLogin}>
                                <img src="/images/google.svg" alt="Google-Logo" className='google-logo' />
                                Login with Google
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
