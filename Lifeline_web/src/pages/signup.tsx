import React from "react";
import "../styles/login.css";
import "../styles/signup.css";
import "../styles/profile.css";
import { Link } from "react-router-dom";
import { useSignup } from "../scripts/useSignup";
import { googleAuth } from "../scripts/googleAuth";
import { useState } from "react";
import TermsCondition from "../components/termsAndCondition";

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
  const { handleGoogleLogin } = googleAuth();

  const [tcModal, setTCModal] = useState(false);      
  const [tcAccepted, setTCAccepted] = useState(false);

  const openTCModal = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setTCModal(true);
  };

  const closeTCModal = () => setTCModal(false);

  const handleSubmitWithTC = (e: React.FormEvent<HTMLFormElement>) => {
    if (step === 2 && !tcAccepted) {
      e.preventDefault();
      return;
    }
    handleSubmit(e);
  };

  return (
    <main className="signup">
      {tcModal && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          onClick={closeTCModal}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <TermsCondition
              status={tcAccepted}
              setStatus={setTCAccepted}
              onClose={closeTCModal}
            />
          </div>
        </div>
      )}

      <section className="login-card">
        <div className="card">
          <div className="login-logo">
            <img src="/images/LifelineLogo.png" alt="Lifeline" className="lifeline-logo-mini"/>
            <h1 className="lifeline-text">SIGNUP</h1>
          </div>

          <form className="form" onSubmit={handleSubmitWithTC}>
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
                  <img src="/images/location.svg" alt="Location" />
                  <hr />
                </div>

                <button type="button" className="neg-btn" onClick={handleGoogleLogin} >
                  <img src="/images/google.svg" alt="Google-Logo"  className="google-logo"/>
                  Signup with Google
                </button>
              </>
            )}

            {step === 2 && (
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
                  className={
                    invalidFields.includes("confirmPassword") ? "invalid" : ""
                  }
                />
                {error && <p className="error">{error}</p>}
              </>
            )}

            {/* Buttons */}
            <div className="btn">
              {step === 2 && (
                <>
                  <button type="submit" className="pos-btn" disabled={loading || !tcAccepted} title={!tcAccepted ? "Please agree to Terms and Conditions." : ""}>
                    {loading ? "Signing up..." : "Signup"}
                  </button>

                  <button type="button" className="neg-btn" onClick={() => setStep((prev) => prev - 1)} disabled={loading}>
                    Back
                  </button>
                  <label htmlFor="terms-checkbox" className="termsConditions">
                    <input type="checkbox" id="terms-checkbox" checked={tcAccepted} onChange={(e) => setTCAccepted(e.target.checked)}/>
                      <p>I agree to the{" "} <a href="#" onClick={openTCModal}> Terms and Conditions</a></p>
                  </label>
                </>
              )}
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
