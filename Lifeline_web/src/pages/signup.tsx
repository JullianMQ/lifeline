import "../styles/login.css";
import { Link } from "react-router-dom";
import { useSignup } from "../components/useSignup.tsx";

function Signup() {
  const {
    step,
    formData,
    setStep,
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

          {(step === 1 || step === 3) && (
            <div className="login-logo">
              <img
                src="src/assets/LifelineLogo.png"
                alt="Lifeline"
                className="lifeline-logo-mini"
              />
              <h1 className="lifeline-text">SIGNUP</h1>
            </div>
          )}

          <form className={`form ${step === 2 ? "full" : ""}`} onSubmit={handleSubmit}>
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
                  onChange={(e) => {
                    console.log("Email input changed:", e.target.value); // DEBUG
                    handleChange(e);
                  }}
                  className={invalidFields.includes("email") ? "invalid" : ""}
                />
                {step === 1 && error && <p className="error">{error}</p>}

                <button type="submit" className="pos-btn" disabled={loading}>
                  {loading ? "Checking..." : "Next"}
                </button>

                <div className="line">
                  <hr />
                  <img src="src/assets/location.svg" alt="Location" />
                  <hr />
                </div>

                <button type="button" className="neg-btn">
                  <img
                    src="src/assets/google.svg"
                    alt="Google-Logo"
                    className="google-logo"
                  />
                  <p>Signup with Google</p>
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <section className="role-form">
                <h2>Select a role for the member</h2>
                  <div className="role-options">
                    <label className={`role-choice ${formData.role === "mutual" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="role"
                        value="mutual"
                        className="roles"
                        checked={formData.role === "mutual"}
                        onChange={handleChange}
                      />
                      <img src="src/assets/mutual-role.svg" alt="mutual" className="role-img"/>
                      <h3>Mutual</h3>
                    </label>

                    <label className={`role-choice ${formData.role === "dependent" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="role"
                        value="dependent"
                        className="roles"
                        checked={formData.role  === "dependent"}
                        onChange={handleChange}
                      />
                      <img src="src/assets/dependent-role.svg" alt="dependent" className="role-img"/>
                      <h3>Dependent</h3>
                    </label>
                  </div>
                </section>
              </>
            )}
            {step === 3 && (
              <>
                <input
                  type="tel"
                  name="phoneNo"
                  placeholder="Phone Number"
                  value={formData.phoneNo}
                  onChange={handleChange}
                  className={invalidFields.includes("phoneNo") ? "invalid" : ""}
                />
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
                {error && <p className="error">{error}</p>}
              </>
            )}  

            {/* Buttons */}

            <div className="btn">
              {(step === 2) && (
                  <button type="button" className="pos-btn" onClick={() => {setStep((prev) => prev + 1);}} disabled={loading || !formData.role}>
                    Next
                  </button>   
              )}
              {(step === 3) && (
                  <button type="submit" className="pos-btn" disabled={loading}>
                    {loading ? "Signing up..." : "Signup"}
                  </button>   
              )}
              {(step === 2 || step === 3) && (
                  <button type="button" className="neg-btn" onClick={() => setStep((prev) => prev - 1)} disabled={loading}>
                    Back
                  </button>
              )}
            </div>

          </form>
        </div>
        {(step === 1 || step === 3) && (
          <div className="switch">
            <p>
              Already have an account? <Link to="/login">Login</Link>
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default Signup;
