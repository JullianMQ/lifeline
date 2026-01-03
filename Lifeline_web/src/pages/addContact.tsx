import { useNavigate } from "react-router-dom";
import "../styles/addContact.css";
import { useAddContact } from "../components/useAddContact";

function AddContact() {
  const navigate = useNavigate();

  const {
    step,
    setStep,
    memberForm,
    invalidFields,
    error,
    loading,
    handleChange,
    handleSubmit,
    selectedRole,
    setSelectedRole,
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
              <section className="role-form">
                <h2>Select a role for the member</h2>
                
                <div className="role-options">

                  <label className={`role-choice ${memberForm.role === "mutual" ? "selected" : ""}`}>
                    <input type="radio" name="role" value="mutual" className="roles" checked={memberForm.role === "mutual"} onChange={handleChange} />
                    <img src="src/assets/mutual-role.svg" alt="mutual" className="role-img"/>
                    <h3>Mutual</h3>
                  </label>

                  <label className={`role-choice ${memberForm.role === "dependent" ? "selected" : ""}`}>
                    <input type="radio" name="role" value="dependent" className="roles" checked={memberForm.role  === "dependent"} onChange={handleChange}/>
                    <img src="src/assets/dependent-role.svg" alt="dependent" className="role-img"/>
                    <h3>Dependent</h3>
                  </label>
                
                </div>
              </section>
            )}
            {step === 3 && (
                <form className="form" onSubmit={handleSubmit}>
              <>
                <h2>Fill up member details</h2>
                
                <input type="text"
                  name="firstName"
                  placeholder="First Name"
                  value={memberForm.firstName}
                  onChange={handleChange}
                  className={invalidFields.includes("firstName") ? "invalid" : ""}
                />
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={memberForm.lastName}
                  onChange={handleChange}
                  className={invalidFields.includes("lastName") ? "invalid" : ""}
                  />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={memberForm.email}
                  onChange={handleChange}
                  className={invalidFields.includes("email") ? "invalid" : ""}
                  />
                <input
                  type="tel"
                  name="phoneNo"
                  placeholder="Phone Number"
                  value={memberForm.phoneNo}
                  onChange={handleChange}
                  className={invalidFields.includes("phoneNo") ? "invalid" : ""}
                  />
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={memberForm.password}
                  onChange={handleChange}
                  className={invalidFields.includes("password") ? "invalid" : ""}
                  />
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={memberForm.confirmPassword}
                  onChange={handleChange}
                  className={invalidFields.includes("confirmPassword") ? "invalid" : ""}
                />
                {error && <p className="error">{error}</p>}
              </>
          </form>
          )}

          {step === 4 && (
            <>
              <h2>Show QR</h2>
              {/* QR component or image goes here later */}
            </>
          )}

        </div>

        <div className="btn">

          {/* Red Buttons */}
          {step <= 2 && (   //step 1-2
            <button className="pos-btn" onClick={() => setStep(prev => prev + 1)} disabled={step === 2 && (loading || !memberForm.role)}>
              Next
            </button>
          )}
          {(step === 3) && (  //step 3
            <button className="pos-btn" disabled={loading} onClick={handleSubmit}>
              {loading ? "Creating Account..." : "Submit"}
            </button>   
          )}
          {(step === 4) && (  //step 4
            <button className="pos-btn" onClick={() => navigate("/addContact")}>
              Add another
            </button>   
          )}

          {/* Black Buttons */}
          {(step === 1 || step === 4) && (  //step 1 & 4
            <button className="neg-btn" onClick={() => navigate("/dashboard")}>
              Skip
            </button>
          )}
          {(step === 2 || step === 3) && (    //step 2 & 3
            <button className="neg-btn" onClick={() => setStep(prev => prev - 1)}>Back</button>
          )}

        </div>
      </section>
    </main>
  );
}

export default AddContact;
