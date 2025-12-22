import { useNavigate } from "react-router-dom";
import "../styles/addContact.css";
import { useAddContact } from "../components/useAddContact";

function AddContact() {
  const navigate = useNavigate();

  const {
    step,
    setStep,
    formData,
    invalidFields,
    error,
    loading,
    handleChange,
    handleSubmit,
  } = useAddContact();

  return (
    <main className="addContact">
      <section className="login-card">
        <div className="card">

          {step === 1 && (
            <>
              <h2>Add a family member</h2>
              <img src="src/assets/connect.svg" alt="Connect" className="connect" />
              <h3>Connect with your emergency contacts now</h3>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Fill up member details</h2>

              <form className="form" onSubmit={handleSubmit}>
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
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <h2>Show QR</h2>
              {/* QR component or image goes here later */}
            </>
          )}

        </div>

        <div className="btn">
          {step === 1 && (
            <>
              <button className="pos-btn" onClick={() => setStep(2)}>Next</button>
              <button className="neg-btn" onClick={() => navigate("/dashboard")}>Skip</button>
            </>
          )}

          {step === 2 && (
            <>
              <button className="pos-btn" onClick={handleSubmit}>Next</button>
              <button className="neg-btn" onClick={() => setStep(1)}>Back</button>
            </>
          )}

          {step === 3 && (
            <>
              <button type="submit" className="pos-btn" disabled={loading}>
                {loading ? "Creating Account..." : "Finish"}
              </button>
              <button className="neg-btn" onClick={() => setStep(2)}>Back</button>
            </>
          )}
        </div>

      </section>
    </main>
  );
}

export default AddContact;
