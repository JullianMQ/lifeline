import { useNavigate } from "react-router-dom";
import { authClient } from "./auth-client";
import { useWebSocket } from "./useWebSocket";
import { useState, useEffect, useMemo, useCallback } from "react";
import { API_BASE_URL } from "../config/api";
import { 
  getStoredLocations, 
  subscribeToLocationUpdates,
  type StoredLocation,
  type LocationStore 
} from "./locationStorage";
import type { User } from "../types";
import type { UseDashboardReturn, ContactCard, EmergencyAlert, LocationData } from "../types/realtime";

/** Raw contact data from REST API */
interface RawContact {
  id?: string;
  user_id?: string;
  name: string;
  email?: string | null;
  phone_no: string;
  image?: string;
  role: string;
  room_id?: string;
}

export function useDashboard(): UseDashboardReturn {
  const navigate = useNavigate();

  // REST API state
  const [user, setUser] = useState<User | null>(null);
  const [rawContacts, setRawContacts] = useState<RawContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // localStorage locations state - this triggers re-renders when locations change
  const [storedLocations, setStoredLocations] = useState<LocationStore>(() => getStoredLocations());

  // WebSocket hook for real-time data
  const {
    connectionStatus,
    lastError: connectionError,
    locations,
    presence,
    alerts,
    rooms,
    stateVersion,
    manualReconnect,
    acknowledgeAlert,
  } = useWebSocket();

  // Subscribe to localStorage location updates
  useEffect(() => {
    console.log("[useDashboard] Setting up localStorage subscription");
    
    // Load initial locations
    setStoredLocations(getStoredLocations());
    
    // Subscribe to updates
    const unsubscribe = subscribeToLocationUpdates((location: StoredLocation) => {
      console.log("[useDashboard] Received localStorage location update:", location);
      setStoredLocations(prev => ({
        ...prev,
        [location.userId]: location,
      }));
    });
    
    return () => {
      console.log("[useDashboard] Cleaning up localStorage subscription");
      unsubscribe();
    };
  }, []);

  // Debug: Log whenever WebSocket state changes
  useEffect(() => {
    console.log("[useDashboard] WebSocket state changed (stateVersion:", stateVersion, "):");
    console.log("  - connectionStatus:", connectionStatus);
    console.log("  - locations size:", locations.size);
    console.log("  - locations entries:", Array.from(locations.entries()));
    console.log("  - presence size:", presence.size);
    console.log("  - rooms size:", rooms.size);
    console.log("  - rooms entries:", Array.from(rooms.entries()));
    console.log("  - alerts count:", alerts.length);
    console.log("  - storedLocations:", storedLocations);
  }, [connectionStatus, locations, presence, alerts, rooms, stateVersion, storedLocations]);

  // Fetch user session info via REST API
  const getUserInfo = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok || !data.user) {
        throw new Error("Not authenticated");
      }

      setUser({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        image: data.user.image,
        role: data.user.role,
        phone_no: data.user.phone_no,
        // Location will come from WebSocket if user is sharing
      });
    } catch (err) {
      console.error("Failed to get user info:", err);
      navigate("/login");
    }
  };

  // Fetch contacts via REST API
  const displayContact = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/contacts/users`, {
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load contacts");
      }

      // Store raw contacts for merging with WebSocket data
      const userContacts: RawContact[] = [
        ...(data.emergency_contacts || []),
        ...(data.dependent_contacts || []),
      ];
      setRawContacts(userContacts);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load contacts";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      window.location.reload();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Helper function to convert StoredLocation to LocationData
  const storedLocationToLocationData = useCallback((stored: StoredLocation, roomId?: string | null): LocationData => {
    return {
      userId: stored.visiblePhone, // Use phone number as ID
      userName: stored.userName,
      roomId: roomId || "",
      coords: {
        lat: stored.latitude,
        lng: stored.longitude,
      },
      accuracy: stored.accuracy,
      timestamp: stored.timestamp,
    };
  }, []);

  // Merge REST contact data with WebSocket real-time data AND localStorage
  // Match by phone number since that's consistent across REST API and WebSocket
  const contactCards: ContactCard[] = useMemo(() => {
    console.log("[useDashboard] Recalculating contactCards...");
    console.log("  - rawContacts count:", rawContacts.length);
    console.log("  - rawContacts:", rawContacts.map(c => ({ name: c.name, phone: c.phone_no })));
    console.log("  - locations size:", locations.size);
    console.log("  - locations keys:", Array.from(locations.keys()));
    console.log("  - storedLocations keys:", Object.keys(storedLocations));
    console.log("  - presence size:", presence.size);
    console.log("  - rooms size:", rooms.size);
    
    return rawContacts.map((contact) => {
      // Use phone number as the primary key for matching
      const contactPhone = contact.phone_no;
      const contactUserId = contact.user_id;
      const roomId = contact.room_id || null;
      // Get real-time location - match by phone number
      let locationData: LocationData | null = null;
      
      // Try WebSocket locations first (in-memory) - keyed by phone number
      if (contactPhone && locations.has(contactPhone)) {
        locationData = locations.get(contactPhone) || null;
        console.log(`[useDashboard] Contact ${contact.name}: Found location in WebSocket state by phone ${contactPhone}`);
      }
      
      // Fall back to localStorage - keyed by phone number (visiblePhone)
      if (!locationData && contactPhone && storedLocations[contactPhone]) {
        const stored = storedLocations[contactPhone];
        locationData = storedLocationToLocationData(stored, roomId);
        console.log(`[useDashboard] Contact ${contact.name}: Found location in localStorage by phone ${contactPhone}`);
      }

      // Get presence info from WebSocket (still by userId if available, or phone)
      let presenceInfo = null;
      if (contactUserId && presence.has(contactUserId)) {
        presenceInfo = presence.get(contactUserId) || null;
      } else if (contactPhone && presence.has(contactPhone)) {
        presenceInfo = presence.get(contactPhone) || null;
      }

      // Check for active alerts for this contact
      const activeAlert = alerts.find(
        (alert) =>
          !alert.acknowledged &&
          (alert.emergencyUserId === contactUserId ||
            alert.emergencyUserId === contactPhone ||
            (roomId && alert.roomId === roomId))
      ) || null;

      console.log(`[useDashboard] Contact ${contact.name}:`, {
        contactPhone,
        contactUserId,
        roomId,
        hasLocation: !!locationData,
        locationData,
        hasPresence: !!presenceInfo,
        presenceInfo,
        hasActiveAlert: activeAlert !== null,
      });

      return {
        id: contactUserId || contactPhone || "",
        name: contact.name,
        phone: contact.phone_no,
        email: contact.email,
        image: contact.image,
        role: contact.role as "mutual" | "dependent",
        location: locationData,
        presence: presenceInfo,
        hasActiveAlert: activeAlert !== null,
        activeAlert,
        roomId,
      };
    });
  }, [rawContacts, locations, presence, rooms, alerts, stateVersion, storedLocations, storedLocationToLocationData]);

  // Get active (unacknowledged) alerts
  const activeAlerts: EmergencyAlert[] = useMemo(() => {
    return alerts.filter((alert) => !alert.acknowledged);
  }, [alerts]);

  // Fetch data on mount
  useEffect(() => {
    getUserInfo();
    displayContact();
  }, []);

  return {
    // Connection info
    connectionStatus,
    connectionError,

    // Contact data
    contactCards,
    loading,
    error,

    // Alerts
    activeAlerts,

    // User info
    user,

    // Actions
    handleLogout,
    acknowledgeAlert,
    manualReconnect,
    refreshContacts: displayContact,
    
  };
}
