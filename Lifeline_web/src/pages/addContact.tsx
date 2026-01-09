import { useState } from "react";
import "../styles/addContact.css";
import AddContactNew from "../components/addContactNew";
import AddContactExisting from "../components/addContactExisting";

function AddContact() {
const [mode, setMode] = useState<null | "new" | "existing">(null);
  return (
    <main className="addContact">
          {!mode && (
            <section className="login-card">
              <div className="card">            
                <h2>Add a family member</h2>
                <img src="/images/connect.svg" alt="Connect" className="connect" />
                <h3>Connect with your emergency contacts now</h3>
              </div>
              <div className="btn">
                <button className="pos-btn" onClick={() => setMode("new")}>
                  Create New
                </button>
                <button className="neg-btn" onClick={() => setMode("existing")}>
                  Add Existing
                </button>   
              </div>
            </section>
          )}
          {mode === "new" && <AddContactNew setMode={setMode}/>}
          {mode === "existing" && <AddContactExisting setMode={setMode}/>}         
    </main>
  );
}

export default AddContact;
