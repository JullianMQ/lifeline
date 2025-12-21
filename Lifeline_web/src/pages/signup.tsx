import "../styles/login.css";
import { Link } from "react-router-dom";
import { useSignup } from "../components/useSignup.tsx";

function Signup() {
  const {
    step,
    formData,
    invalidFields,
    error,
    loading,
    handleChange,
    handleSubmit,
  } = useSignup();

  return (
    <main className="signup">
      <section className="login-card">
        <div className="card">
          <div className="login-logo">
            <img
              src="src/assets/LifelineLogo.png"
              alt="Lifeline"
              className="lifeline-logo-mini"
            />
            <h2 className="lifeline-text">SIGNUP</h2>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            {step === 1 && (
              <>
                <input
                  type="text"
                  name="firstName"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={invalidFields.includes("firstName") ? "invalid" : ""}
                />
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={invalidFields.includes("lastName") ? "invalid" : ""}
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleChange}
                  className={invalidFields.includes("email") ? "invalid" : ""}
                />
                <input
                  type="tel"
                  name="phoneNo"
                  placeholder="Phone Number"
                  value={formData.phoneNo}
                  onChange={handleChange}
                  className={invalidFields.includes("phoneNo") ? "invalid" : ""}
                />
                <button type="submit" className="pos-btn">
                  Next
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  className={invalidFields.includes("password") ? "invalid" : ""}
                />
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={invalidFields.includes("confirmPassword") ? "invalid" : ""}
                />
                {error && <p className="error-text">{error}</p>}
                <button type="submit" className="pos-btn" disabled={loading}>
                  {loading ? "Signing up..." : "Signup"}
                </button>
              </>
            )}

            <div className="line">
              <hr />
              <img src="src/assets/location.svg" alt="Location" />
              <hr />
            </div>

            <div className="google">
              <button type="button" className="neg-btn">
                <img
                  src="src/assets/google.svg"
                  alt="Google-Logo"
                  className="google-logo"
                />
                <p>Signup with Google</p>
              </button>
            </div>
          </form>
        </div>

        <div className="switch">
          <p>
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Signup;
