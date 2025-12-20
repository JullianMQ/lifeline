import { useNavigate } from "react-router-dom";
import "../styles/addContact.css";
import { useAddContact } from "../components/useAddContact";

function AddContact() {
  const navigate = useNavigate();

  const {
    step,
    setStep,
    selectedRole,
    setSelectedRole,
    formData,
    invalidFields,
    handleChange,
    nextFromStep3,
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
              <h2>Select a role for the member</h2>

              <form className="role-form">
                <div className="role-options">
                  <label className={`role-choice ${selectedRole === "mutual" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="role"
                      value="mutual"
                      checked={selectedRole === "mutual"}
                      onChange={() => setSelectedRole("mutual")}
                    />
                    <img src="src/assets/mutual-role.svg" alt="mutual" />
                    <h3>Mutual</h3>
                  </label>

                  <label className={`role-choice ${selectedRole === "dependent" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="role"
                      value="dependent"
                      checked={selectedRole === "dependent"}
                      onChange={() => setSelectedRole("dependent")}
                    />
                    <img src="src/assets/dependent-role.svg" alt="dependent" />
                    <h3>Dependent</h3>
                  </label>
                </div>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <h2>Fill up member details</h2>

              <form className="form">
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
              </form>
            </>
          )}

          {step === 4 && (
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
              <button className="pos-btn" onClick={() => setStep(3)}>Next</button>
              <button className="neg-btn" onClick={() => setStep(1)}>Back</button>
            </>
          )}

          {step === 3 && (
            <>
              <button className="pos-btn" onClick={nextFromStep3}>Next</button>
              <button className="neg-btn" onClick={() => setStep(2)}>Back</button>
            </>
          )}

          {step === 4 && (
            <>
              <button className="pos-btn" onClick={() => navigate("/dashboard")}>Finish</button>
              <button className="neg-btn" onClick={() => setStep(3)}>Back</button>
            </>
          )}
        </div>

      </section>
    </main>
  );
}

export default AddContact;
