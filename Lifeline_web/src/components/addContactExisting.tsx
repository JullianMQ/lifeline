import { useNavigate } from "react-router-dom";
import "../styles/addContact.css";
import { useAddContact } from "../scripts/useAddContact";

interface Props {
  setMode: React.Dispatch<React.SetStateAction<"new" | "existing" | null>>;
}

function AddContactExisting({ setMode }: Props) {
    const navigate = useNavigate();
    const {
        step,
        setStep,
        addForm,
        fetchedUser,
        invalidFields,
        error,
        loading,
        handleChange,
        validateNumber,
        handleAdd
    } = useAddContact();

    return (
        <main  className="login-card">
            <div className="card">
                {step === 1 && (
                    <form className="form" onSubmit={validateNumber}>
                        <h3>Fill up contact details</h3>
                        <input
                        type="tel"
                        name="phoneNo"
                        placeholder="Phone Number"
                        value={addForm.phoneNo}
                        onChange={handleChange}
                        className={invalidFields.includes("phoneNo") ? "invalid" : ""}
                        />
                        {error && <p className="error">{error}</p>}
                    </form>
                )}
                {step === 2 && (
                    <>
                        <h2>Add this account?</h2>
                        <div className="add-cont">
                            <img src={fetchedUser.image || "../images/user-example.svg"} alt={fetchedUser.name}/>
                            <h3>{fetchedUser.name}</h3>
                        </div>
                    </>
                )}    
                {step === 3 && (
                    <>
                        <h2>Added Successfully!</h2>
                        <img src="/images/check.svg" alt="success" />
                        <p>Would you like to add another contact?</p>
                    </>
                )}
            </div>

            <div className="btn">
                {/* Red Buttons */}
                {step === 1 && (   //step 1
                    <button className="pos-btn" disabled={loading} onClick={() => validateNumber}>
                        {loading ? "Creating Account..." : "Confirm"}
                    </button>
                )}
                {(step === 2) && (  //step 2
                    <button className="pos-btn" disabled={loading} onClick={() => handleAdd()}>
                        {loading ? "Creating Account..." : "Confirm"}
                    </button>
                )}
                {(step === 3) && (  //step 3
                    <button className="pos-btn" onClick={() => setMode(null)}>
                    Add
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

export default AddContactExisting;
