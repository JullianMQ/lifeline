import { useState, useEffect, useMemo, useRef } from "react";
import "../styles/dashboard.css";
import "../styles/alertMode.css";
import { useDashboard } from "../scripts/useDashboard";
import { useNavigate } from "react-router-dom";
import DashboardMap, { DEFAULT_MAP_CENTER } from "../components/DashboardMap";
import DashboardUser from "../components/DashboardUser";
import DashboardContact from "../components/DashboardContact";
import { useMap } from "../scripts/useMap";
import type { ContactCard } from "../types/realtime";

/** Alert Modal Component */
function AlertModal({
  alerts,
  contactCards,
  onAcknowledge,
  onViewContact,
  onClose,
}: {
  alerts: Array<{
    id: string;
    emergencyUserId: string;
    emergencyUserName: string;
    message: string;
    timestamp?: string;
  }>;
  contactCards: ContactCard[];
  onAcknowledge: (alertId: string) => void;
  onViewContact: (contact: ContactCard) => void;
  onClose: () => void;
}) {
  if (alerts.length === 0) return null;

  // Find contact by matching emergencyUserId with contact.id or by phone
  const findContactForAlert = (alert: {
    emergencyUserId: string;
    emergencyUserName: string;
  }) => {
    // First try to find by user ID
    let contact = contactCards.find((c) => c.id === alert.emergencyUserId);

    // If not found, try to find by matching the roomId pattern (which contains phone)
    if (!contact) {
      contact = contactCards.find((c) => c.name === alert.emergencyUserName);
    }

    return contact;
  };

  return (
    <div className="alert-modal-overlay" onClick={onClose}>
      <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal-header">
          <span className="alert-modal-header-icon">!</span>
          <h2>Emergency Alert{alerts.length > 1 ? "s" : ""}</h2>
        </div>
        <div className="alert-modal-body">
          {alerts.map((alert) => {
            const contact = findContactForAlert(alert);

            return (
              <div key={alert.id} className="alert-modal-item">
                <div className="alert-modal-item-icon">
                  {alert.emergencyUserName.charAt(0).toUpperCase()}
                </div>
                <div className="alert-modal-item-content">
                  <span className="alert-modal-item-name">
                    {alert.emergencyUserName}
                  </span>
                  <span className="alert-modal-item-message">
                    {alert.message}
                  </span>
                  {contact?.phone && (
                    <span className="alert-modal-item-phone">
                      {contact.phone}
                    </span>
                  )}
                  {alert.timestamp && (
                    <span className="alert-modal-item-time">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <div className="alert-modal-item-actions">
                  <button
                    className="alert-view-btn"
                    onClick={() => {
                      if (contact) {
                        console.log(
                          "[AlertModal] Viewing contact:",
                          contact.id,
                          contact.name,
                          contact.phone,
                        );
                        onViewContact(contact);
                        onClose();
                      } else {
                        console.warn(
                          "[AlertModal] Could not find contact for alert:",
                          alert,
                        );
                      }
                    }}
                    disabled={!contact}
                  >
                    View
                  </button>
                  <button
                    className="alert-acknowledge-btn"
                    onClick={() => onAcknowledge(alert.id)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="alert-modal-footer">
          <button className="alert-modal-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  // Store only the contact ID, not the whole object - this ensures we always get fresh data
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null,
  );
  const [history, setHistory] = useState<
    Record<string, { time: string; lat: number; lng: number }[]>
  >({});
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [userClosedAlertModal, setUserClosedAlertModal] = useState(false);
  const [hoveredHistoryLocation, setHoveredHistoryLocation] = useState<{ lat: number; lng: number; image: string } | null>(null);
  const [selectedHistoryLocation, setSelectedHistoryLocation] = useState<{ lat: number; lng: number; image: string } | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const prevAlertsSignature = useRef<string>("");

  const {
    handleLocation,
    getGeocode,
    setAddress,
    address,
  } = useMap();
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

  // Show modal automatically when new alerts come in
  useEffect(() => {
    const signature = activeAlerts
      .map((alert) => `${alert.id}:${alert.timestamp ?? ""}:${alert.message}`)
      .join("|");

    if (activeAlerts.length > 0 && signature !== prevAlertsSignature.current) {
      if (!userClosedAlertModal) {
        setShowAlertModal(true);
      }
      prevAlertsSignature.current = signature;
      if (userClosedAlertModal) {
        setUserClosedAlertModal(false);
      }
    }
  }, [activeAlerts, userClosedAlertModal]);

  // Derive selectedContact from contactCards using the stored ID
  // This ensures we always have the latest data when contactCards updates
  const selectedContact = useMemo(() => {
    if (!selectedContactId) return null;
    const contact = contactCards.find((c) => c.id === selectedContactId);
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
    // setAddress("");
  };

  // Handle going back - clear the selected contact ID
  const handleBack = () => {
    console.log("[Dashboard] Going back, clearing selectedContactId");
    setSelectedContactId(null);
    setAddress("");
    setSelectedRowIndex(null);
    setSelectedHistoryLocation(null);
  };

  // Handle location markers for user and contacts
  useEffect(() => {
    console.log("[Dashboard] Updating markers - contactCards changed");
    console.log(
      "[Dashboard] contactCards:",
      contactCards.map((c) => ({
        id: c.id,
        name: c.name,
        hasLocation: !!c.location,
        coords: c.location?.coords,
      })),
    );

    if (!contactCards) return;

    // Update markers for all contacts with locations
    contactCards.forEach((c) => {
      if (c.location?.coords) {
        console.log(
          "[Dashboard] Updating marker for",
          c.name,
          c.location.coords,
        );
        handleLocation({
          id: c.id,
          name: c.name,
          phone: c.phone,
          location: { lat: c.location.coords.lat, lng: c.location.coords.lng },
          image: c.image,
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
      console.log(
        "[Dashboard] Selected contact has no location:",
        selectedContact.name,
      );
      return;
    }

    const lat = selectedContact.location.coords.lat;
    const lng = selectedContact.location.coords.lng;
    const isOnline = selectedContact.presence?.status === "online";

    console.log("[Dashboard] Selected contact location changed:", {
      name: selectedContact.name,
      lat,
      lng,
      isOnline,
    });

    const updateAddress = async () => {
      console.log("[Dashboard] Fetching geocode for", lat, lng);
      const res = await getGeocode(lat, lng);
      const timestamp = new Date().toLocaleTimeString();
      console.log("[Dashboard] Geocode result:", res);
      setAddress(res);
      
      if (isOnline) {
        setHistory((prev) => ({
          ...prev,
          [selectedContact.phone]: [
            { time: timestamp, lat, lng },
            ...(prev[selectedContact.phone] || []).slice(0, 49), // Keep last 50 entries
          ],
        }));
      }
    };

    setHistory((prev) => {
      const existingHistory = prev[selectedContact.phone] || [];
      const locationExists = existingHistory.some(
        (h) => h.lat === lat && h.lng === lng
      );
      if (!locationExists && existingHistory.length === 0) {
        const timestamp = new Date().toLocaleTimeString();
        return {
          ...prev,
          [selectedContact.phone]: [
            { time: timestamp, lat, lng },
            ...existingHistory,
          ],
        };
      }
      return prev;
    });

    let interval: NodeJS.Timeout | null = null;
    
    if (isOnline) {
      updateAddress();
      interval = setInterval(() => {
        if (selectedContact.location?.coords) {
          updateAddress();
        }
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    selectedContact?.id,
    selectedContact?.location?.coords?.lat,
    selectedContact?.location?.coords?.lng,
    selectedContact?.presence?.status,
  ]);

  const handleViewAlertContact = (contact: ContactCard) => {
    console.log(
      "[Dashboard] handleViewAlertContact:",
      contact.id,
      contact.name,
      contact.phone,
    );
    if (contact) {
      handleSelectContact(contact);
    }
  };

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

  const getMapCenter = () => {
    if (selectedContact?.location?.coords) {
      return {
        lat: selectedContact.location.coords.lat,
        lng: selectedContact.location.coords.lng,
      };
    }
    const contactWithLocation = contactCards.find((c) => c.location?.coords);
    if (contactWithLocation?.location?.coords) {
      return {
        lat: contactWithLocation.location.coords.lat,
        lng: contactWithLocation.location.coords.lng,
      };
    }
    return user?.location || DEFAULT_MAP_CENTER;
  };

  return (
    <main className={`dashboard ${selectedContact?.hasActiveAlert ? "alert" : ""}`}>
      {/* Emergency Alert Modal */}
      {showAlertModal && activeAlerts.length > 0 && (
        <AlertModal
          alerts={activeAlerts}
          contactCards={contactCards}
          onAcknowledge={acknowledgeAlert}
          onViewContact={handleViewAlertContact}
          onClose={() => {
            setShowAlertModal(false);
            setUserClosedAlertModal(true);
          }}
        />
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
            {(connectionStatus === "error" ||
              connectionStatus === "disconnected") && (
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
          {activeAlerts.length > 0 && !showAlertModal && (
            <button
              className="alert-indicator-btn"
              onClick={() => {
                console.log("activeAlerts:", activeAlerts);
                setShowAlertModal(true);
                setUserClosedAlertModal(false);
              }}
              title={`${activeAlerts.length} active alert${activeAlerts.length > 1 ? "s" : ""}`}
            >
              <span className="alert-indicator-icon">!</span>
              <span>{activeAlerts.length}</span>
            </button>
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
              onHistoryHover={setHoveredHistoryLocation}
              onHistoryClick={(location, index) => {
                setSelectedHistoryLocation(selectedRowIndex === index ? null : location);
                setSelectedRowIndex(selectedRowIndex === index ? null : index);
              }}
              selectedRowIndex={selectedRowIndex}
            />
          )}
        </div>

        <div className="map">
          <DashboardMap
            center={getMapCenter()}
            onSelectContact={handleSelectContact}
            contacts={contactCards}
            hoveredLocation={hoveredHistoryLocation}
            selectedLocation={selectedHistoryLocation}
          />
        </div>
      </section>
      <footer></footer>
    </main>
  );
}

export default Dashboard;
