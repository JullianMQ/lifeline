import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/addContact.css";
import AddContactNew from "../components/addContactNew";
import AddContactExisting from "../components/addContactExisting";

function AddContact() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<null | "new" | "existing">(null);
    return (
        <main className="addContact">
            {!mode && (
                <section className="login-card">
                    <div className="card">
                        <div className="backHeader">
                            <h3>
                                <button type="button" className="backButton" aria-label="Go back" onClick={() => navigate(-1)} onKeyDown={(e) => e.key === 'Enter' && navigate(-1)}>
                                    &larr;
                                </button>
                            </h3>
                            <h3 aria-label="Add a family member">Add a family member</h3>
                        </div>
                        <img src="/images/connect.svg" alt="Connect" className="connect" />
                        <h3 aria-label="Connect with your emergency contacts now">Connect with your emergency contacts now</h3>
                    </div>
                    <div className="btn">
                        <button type="button" className="pos-btn" onClick={() => setMode("new")}>
                            Create New
                        </button>
                        <button type="button" className="neg-btn" onClick={() => setMode("existing")}>
                            Add Existing
                        </button>
                    </div>
                </section>
            )}
            {mode === "new" && <AddContactNew setMode={setMode} />}
            {mode === "existing" && <AddContactExisting setMode={setMode} />}
        </main>
    );
}

export default AddContact;
