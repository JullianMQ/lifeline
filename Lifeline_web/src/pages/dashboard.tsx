import { useState, useEffect, useMemo } from "react";
import "../styles/dashboard.css";
import { useDashboard } from "../scripts/useDashboard";
import { useNavigate } from "react-router-dom";
import DashboardMap, { DEFAULT_MAP_CENTER } from "../components/DashboardMap";
import DashboardUser from "../components/DashboardUser";
import DashboardContact from "../components/DashboardContact";
import { useMap } from "../scripts/useMap";
import type { ContactCard } from "../types/realtime";

function Dashboard() {
  const navigate = useNavigate();
  // Store only the contact ID, not the whole object - this ensures we always get fresh data
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, { time: string; lat: number; lng: number }[]>>({});

  const { markers, loading, handleLocation, getGeocode, setAddress, address, updateMarker } = useMap();
  const {
    user,
    handleLogout,
    contactCards,
    connectionStatus,
    connectionError,
    activeAlerts,
    acknowledgeAlert,
    manualReconnect,
  } = useDashboard();

  // Derive selectedContact from contactCards using the stored ID
  // This ensures we always have the latest data when contactCards updates
  const selectedContact = useMemo(() => {
    if (!selectedContactId) return null;
    const contact = contactCards.find(c => c.id === selectedContactId);
    console.log("[Dashboard] Derived selectedContact:", {
      selectedContactId,
      found: !!contact,
      hasLocation: !!contact?.location,
      location: contact?.location,
    });
    return contact || null;
  }, [selectedContactId, contactCards]);

  // Handle selecting a contact - store the ID, not the object
  const handleSelectContact = (contact: ContactCard) => {
    console.log("[Dashboard] Selecting contact:", contact.id, contact.name);
    setSelectedContactId(contact.id);
    // Reset address when selecting new contact
    setAddress("");
  };

  // Handle going back - clear the selected contact ID
  const handleBack = () => {
    console.log("[Dashboard] Going back, clearing selectedContactId");
    setSelectedContactId(null);
    setAddress("");
  };

  // Handle location markers for user and contacts
  useEffect(() => {
    console.log("[Dashboard] Updating markers - contactCards changed");
    console.log("[Dashboard] contactCards:", contactCards.map(c => ({
      id: c.id,
      name: c.name,
      hasLocation: !!c.location,
      coords: c.location?.coords,
    })));
    
    if (!contactCards) return;
    
    // Update markers for all contacts with locations
    contactCards.forEach((c) => {
      if (c.location?.coords) {
        console.log("[Dashboard] Updating marker for", c.name, c.location.coords);
        handleLocation({
          id: c.id,
          name: c.name,
          phone: c.phone,
          location: { lat: c.location.coords.lat, lng: c.location.coords.lng },
        });
      }
    });
    
    // Also update user marker if available
    if (user?.location) {
      handleLocation(user);
    }
  }, [contactCards, user]);

  // Update address and history when selected contact's location changes
  useEffect(() => {
    if (!selectedContact) {
      console.log("[Dashboard] No selected contact, skipping address update");
      return;
    }
    if (!selectedContact.location?.coords) {
      console.log("[Dashboard] Selected contact has no location:", selectedContact.name);
      return;
    }

    const lat = selectedContact.location.coords.lat;
    const lng = selectedContact.location.coords.lng;
    
    console.log("[Dashboard] Selected contact location changed:", {
      name: selectedContact.name,
      lat,
      lng,
    });

    const updateAddress = async () => {
      console.log("[Dashboard] Fetching geocode for", lat, lng);
      const res = await getGeocode(lat, lng);
      const timestamp = new Date().toLocaleTimeString();
      console.log("[Dashboard] Geocode result:", res);
      setAddress(res);
      setHistory((prev) => ({
        ...prev,
        [selectedContact.phone]: [
          { time: timestamp, lat, lng },
          ...(prev[selectedContact.phone] || []).slice(0, 49), // Keep last 50 entries
        ],
      }));
    };

    updateAddress();

    // Only poll for address updates, not location updates (WebSocket handles that)
    const interval = setInterval(() => {
      // Re-fetch geocode in case the location has changed
      if (selectedContact.location?.coords) {
        updateAddress();
      }
    }, 30000); // Poll less frequently since WebSocket provides real-time updates

    return () => clearInterval(interval);
  }, [selectedContact?.id, selectedContact?.location?.coords?.lat, selectedContact?.location?.coords?.lng]);

  // Get connection status indicator
  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case "connected":
        return { color: "#22c55e", text: "Connected" };
      case "connecting":
        return { color: "#eab308", text: "Connecting..." };
      case "reconnecting":
        return { color: "#f97316", text: "Reconnecting..." };
      case "error":
        return { color: "#ef4444", text: "Connection Error" };
      case "disconnected":
        return { color: "#6b7280", text: "Disconnected" };
      default:
        return { color: "#6b7280", text: "Unknown" };
    }
  };

  const connectionIndicator = getConnectionIndicator();

  // Get map center based on selected contact or user location
  const getMapCenter = () => {
    if (selectedContact?.location?.coords) {
      return { lat: selectedContact.location.coords.lat, lng: selectedContact.location.coords.lng };
    }
    // Try to get first contact with location
    const contactWithLocation = contactCards.find(c => c.location?.coords);
    if (contactWithLocation?.location?.coords) {
      return { lat: contactWithLocation.location.coords.lat, lng: contactWithLocation.location.coords.lng };
    }
    // Fall back to user location or default
    return user?.location || DEFAULT_MAP_CENTER;
  };

  return (
    <main className="dashboard">
      {/* Global Emergency Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div className="alert-banner">
          {activeAlerts.map((alert) => (
            <div key={alert.id} className="alert-item">
              <span className="alert-icon">!</span>
              <span className="alert-message">
                <strong>Emergency Alert:</strong> {alert.emergencyUserName} - {alert.message}
              </span>
              <button
                className="alert-dismiss"
                onClick={() => acknowledgeAlert(alert.id)}
                aria-label="Acknowledge alert"
              >
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

      <header>
        <h2 className="head-title">Lifeline</h2>
        <div className="header-right">
          {/* Connection Status Indicator */}
          <div className="connection-status">
            <span
              className="status-dot"
              style={{ backgroundColor: connectionIndicator.color }}
            />
            <span className="status-text">{connectionIndicator.text}</span>
            {(connectionStatus === "error" || connectionStatus === "disconnected") && (
              <button className="reconnect-btn" onClick={manualReconnect}>
                Reconnect
              </button>
            )}
          </div>
          {connectionError && (
            <span className="connection-error" title={connectionError}>
              {connectionError}
            </span>
          )}
          <p className="uline-btn" onClick={handleLogout}>
            LOGOUT
          </p>
          <img
            src={user?.image || "/images/user-example.svg"}
            alt="user-img"
            className="dashboard-img"
            onClick={() => navigate("/profile")}
          />
        </div>
      </header>

      <section className="dashboard-body">
        <div className="dashboard-content">
          {!selectedContact ? (
            <DashboardUser
              user={user}
              contactCards={contactCards}
              onSelectContact={handleSelectContact}
              onAddContact={() => navigate("/addContact")}
            />
          ) : (
            <DashboardContact
              contact={selectedContact}
              onBack={handleBack}
              geocode={address}
              history={history[selectedContact.phone] || []}
              onAcknowledgeAlert={acknowledgeAlert}
            />
          )}
        </div>

        <div className="map">
          <DashboardMap markers={markers} loading={loading} center={getMapCenter()} />
        </div>
      </section>
      <footer></footer>
    </main>
  );
}

export default Dashboard;
