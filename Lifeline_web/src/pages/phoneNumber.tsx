// CompletePhone.tsx
import { useState } from "react";
import "./../styles/PhoneNumber.css";
import "./../styles/signup.css";
import { API_BASE_URL } from "../config/api";

function phoneNumber() {
  const [phoneNo, setPhoneNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phoneNo) {
      setError("Phone number is required");
      return;
    }

    if (!/^09\d{9}$/.test(phoneNo)) {
      setError("Invalid phone number");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/update-user`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_no: phoneNo }),
      });
      if (!res.ok) {
        setError("Phone number already exists. Try again");
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="phoneNumber">
        <section className="login-card">
          <div className="card">
            <div className="login-logo">
                <img src="/images/LifelineLogo.png" alt="Lifeline" className="lifeline-logo-mini" />
                <h1 className="lifeline-text">SIGNUP</h1>
            </div>
            <form className="form" onSubmit={handleSubmit}>
              <div className="form-cont">
                <input type="tel" value={phoneNo}onChange={e => setPhoneNo(e.target.value)} placeholder="Phone Number"/>
                {error && <p className="error">{error}</p>}
              </div>

              <button className="pos-btn" type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Submit"}
              </button>
            </form>
          </div>
        </section>
      
    </main>
  );
}

export default phoneNumber;
