import { useState, useEffect } from "react";
import "../styles/dashboard.css";
import { useDashboard } from "../scripts/useDashboard";
import { useNavigate } from "react-router-dom";
import DashboardMap from "../components/DashboardMap";
import DashboardUser from "../components/DashboardUser";
import DashboardContact from "../components/DashboardContact";
import { useMap } from "../scripts/useMap";
import type { Contact, LatLng } from "../types";

function Dashboard() {
  const navigate = useNavigate();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [location, setLocation] = useState<LatLng | undefined>(undefined);
  // const [time, setTime] = useState<string>("");
  const [history, setHistory] = useState<{ time: string; lat: number; lng: number }[]>([]);

  const { markers, loading, handleLocation, getGeocode, setAddress, address } = useMap();
  const { user, handleLogout, contacts } = useDashboard();
  
  useEffect(() => {
     if (!user || !contacts) return;
     handleLocation(user);
     contacts.forEach(c => handleLocation(c));
   }, [user, contacts]);
   
  useEffect(() => {
    if (!selectedContact) return;
    const { lat, lng } = selectedContact.location!;

    const updateAddress = async () => {
      const res = await getGeocode(lat, lng);
      const timestamp = new Date().toLocaleTimeString();
      // setTime(timestamp);
      setLocation(selectedContact.location);
      setAddress(res);
      setHistory(prev => [
      { time: timestamp, lat, lng },
      ...prev,
    ]);
    };
    
    updateAddress();
  
    const interval = setInterval(() => {
      updateAddress();
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedContact]);

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
              geocode={address}
              location={location}
              history={history}
            />
          )}
        </div>

        <div className="map">
           <DashboardMap markers={markers} loading={loading} center={selectedContact?.location || user?.location} />
        </div>
      </section>
      <footer></footer>
    </main>
  );
}

export default Dashboard;
