import { useState } from "react";
import "../styles/dashboard.css";
import { useDashboard } from "../scripts/useDashboard";
import { useNavigate } from "react-router-dom";
import DashboardMap from "../components/DashboardMap";
import DashboardUser from "../components/DashboardUser";
import DashboardContact from "../components/DashboardContact";

function Dashboard() {
  const navigate = useNavigate();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const {
    user,
    handleLogout,
    contacts,
  } = useDashboard();

  return (
    <main className="dashboard">
      <header>
        <h2 className="head-title">Lifeline</h2>
        <button className="logout-btn" onClick={handleLogout}>
          LOGOUT
        </button>
      </header>

      <section className="dashboard-body">
        <div className="dashboard-content">
          {!selectedContact ? (
            <DashboardUser
              user={user}
              contacts={contacts}
              onSelectContact={setSelectedContact}
              onAddContact={() => navigate("/addContact")}
            />
          ) : (
            <DashboardContact
              contact={selectedContact}
              onBack={() => setSelectedContact(null)}
            />
          )}
        </div>

        <div className="map">
          <DashboardMap />
        </div>
      </section>
    </main>
  );
}

export default Dashboard;
