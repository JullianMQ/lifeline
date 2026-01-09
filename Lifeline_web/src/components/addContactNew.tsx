import { useNavigate } from "react-router-dom";
import { useAddContact } from "../scripts/useAddContact";
import QRCode from "react-qr-code";

interface Props {
  setMode: React.Dispatch<React.SetStateAction<"new" | "existing" | null>>;
}

function AddContactNew({ setMode }: Props) {
  const navigate = useNavigate();
  const {
    step,
    setStep,
    createForm,
    invalidFields,
    error,
    loading,
    handleChange,
    handleCreate,
    qrUrl
  } = useAddContact();

  return (
    <main className="login-card">
        <div className="card">
            {step === 1 && (
              <section className="role-form">
                <h2>Select a role for the member</h2>
                
                <div className="role-options">

                  <label className={`role-choice ${createForm.role === "mutual" ? "selected" : ""}`}>
                    <input type="radio" name="role" value="mutual" className="roles" checked={createForm.role === "mutual"} onChange={handleChange} />
                    <img src="/images/mutual-role.svg" alt="mutual" className="role-img"/>
                    <h3>Mutual</h3>
                  </label>

                  <label className={`role-choice ${createForm.role === "dependent" ? "selected" : ""}`}>
                    <input type="radio" name="role" value="dependent" className="roles" checked={createForm.role  === "dependent"} onChange={handleChange}/>
                    <img src="/images/dependent-role.svg" alt="dependent" className="role-img"/>
                    <h3>Dependent</h3>
                  </label>
                
                </div>
              </section>
            )}
            {step === 2 && (
                <form className="form" onSubmit={handleCreate}>
                    <h2>Fill up member details</h2>
                    
                    <input 
                    type="text"
                    name="firstName"
                    placeholder="First Name"
                    value={createForm.firstName}
                    onChange={handleChange}
                    className={invalidFields.includes("firstName") ? "invalid" : ""}
                    />
                    <input
                    type="text"
                    name="lastName"
                    placeholder="Last Name"
                    value={createForm.lastName}
                    onChange={handleChange}
                    className={invalidFields.includes("lastName") ? "invalid" : ""}
                    />
                    <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={createForm.email}
                    onChange={handleChange}
                    className={invalidFields.includes("email") ? "invalid" : ""}
                    />
                    <input
                    type="tel"
                    name="phoneNo"
                    placeholder="Phone Number"
                    value={createForm.phoneNo}
                    onChange={handleChange}
                    className={invalidFields.includes("phoneNo") ? "invalid" : ""}
                    />
                    <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={createForm.password}
                    onChange={handleChange}
                    className={invalidFields.includes("password") ? "invalid" : ""}
                    />
                    <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={createForm.confirmPassword}
                    onChange={handleChange}
                    className={invalidFields.includes("confirmPassword") ? "invalid" : ""}
                    />
                {error && <p className="error">{error}</p>}
            </form>
          )}

          {step === 3 && (
            <>
              <h2>Scan QR</h2>
              {qrUrl ? (
                <QRCode
                  size={200}
                  value={qrUrl}
                  viewBox="0 0 256 256"
                />
              ) : (
                <p>Generating QR…</p>
              )}
              <p>Scan me to login as <strong>{createForm.firstName+" "+createForm.lastName}</strong></p>
            </>
          )}

        </div>

        <div className="btn">
            {/* Red Buttons */}
            {step === 1 && (   //step 1
                <button className="pos-btn" onClick={() => setStep(prev => prev + 1)} disabled={step === 1 && (loading || !createForm.role)}>
                    Next
                </button>
            )}
            {(step === 2) && (  //step 2
                <button className="pos-btn" disabled={loading} onClick={handleCreate}>
                {loading ? "Creating Account..." : "Submit"}
                </button>   
            )}
            {(step === 3) && (  //step 3
                <button className="pos-btn" onClick={() => setMode(null)}>
                Add another
                </button>   
            )}

            {/* Black Buttons */}
            {step === 1  && (    //step 1
                <button className="neg-btn" onClick={() => setMode(null)}>
                    Back
                </button>
            )}
            {step === 2 && (  //step 2
                <button className="neg-btn" onClick={() => setStep(prev => prev - 1)}>
                    Back
                </button>
            )}
            {step === 3 && (  //step 3
                <button className="neg-btn" onClick={() => navigate("/dashboard")}>
                Skip
                </button>
            )}

        </div>
    </main>
  );
}

export default AddContactNew;
