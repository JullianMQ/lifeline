import { useNavigate } from "react-router-dom";
import { authClient } from "./auth-client";
import { useWebSocket } from "./useWebSocket";
import { useState, useEffect, useMemo, useCallback } from "react";
import { API_BASE_URL } from "../config/api";
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

/** API response structure for locations */
interface LocationApiResponse {
  locations_by_user: {
    [userId: string]: {
      user_name: string;
      user_phone: string;
      locations: Array<{
        id: string;
        latitude: string;
        longitude: string;
        formatted_location: string | null;
        timestamp: string;
        created_at: string;
      }>;
    };
  };
}

/** Location data mapped by phone number for matching */
interface LocationsByPhone {
  [phoneNumber: string]: {
    current: LocationData;
    history: LocationData[];
  };
}

export function useDashboard(): UseDashboardReturn {
  const navigate = useNavigate();

  // REST API state
  const [user, setUser] = useState<User | null>(null);
  const [rawContacts, setRawContacts] = useState<RawContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // API locations state - fetched from /api/locations/contacts
  const [apiLocations, setApiLocations] = useState<LocationsByPhone>({});

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

  // Fetch locations from API
  const fetchLocations = useCallback(async () => {
    try {
      console.log("[useDashboard] Starting location fetch from:", `${API_BASE_URL}/api/locations/contacts`);
      const res = await fetch(`${API_BASE_URL}/api/locations/contacts`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch locations: ${res.status} ${res.statusText}`);
      }

      const data: LocationApiResponse = await res.json();
      console.log("[useDashboard] Raw API response:", data);
      console.log("[useDashboard] locations_by_user keys:", Object.keys(data.locations_by_user));

      // Transform API response into locations mapped by phone number
      const locationsByPhone: LocationsByPhone = {};
      let processedCount = 0;

      Object.entries(data.locations_by_user).forEach(([_userId, userData]) => {
        const phoneNumber = userData.user_phone;
        console.log(`[useDashboard] Processing user: ${userData.user_name} (${phoneNumber}), locations count: ${userData.locations.length}`);
        
        if (!phoneNumber) {
          console.warn("[useDashboard] Skipping user - no phone number");
          return;
        }
        
        if (!userData.locations || userData.locations.length === 0) {
          console.warn(`[useDashboard] Skipping ${phoneNumber} - no locations array or empty`);
          return;
        }

        // Sort locations by timestamp (most recent first)
        const sortedLocations = [...userData.locations].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        console.log(`[useDashboard] Sorted ${sortedLocations.length} locations for ${phoneNumber}:`, sortedLocations.map(l => ({ id: l.id, timestamp: l.timestamp })));

        // Convert to LocationData format
        const locationDataArray: LocationData[] = sortedLocations.map((loc) => ({
          userId: phoneNumber,
          userName: userData.user_name,
          roomId: "",
          coords: {
            lat: parseFloat(loc.latitude),
            lng: parseFloat(loc.longitude),
          },
          timestamp: loc.timestamp,
        }));

        // Store most recent as current and all as history
        locationsByPhone[phoneNumber] = {
          current: locationDataArray[0],
          history: locationDataArray,
        };
        
        console.log(`[useDashboard] Stored location for ${phoneNumber}:`, locationsByPhone[phoneNumber].current);
        processedCount++;
      });

      console.log(`[useDashboard] Processed ${processedCount} users, final locationsByPhone:`, locationsByPhone);
      setApiLocations(locationsByPhone);
    } catch (err) {
      console.error("[useDashboard] Failed to fetch locations:", err);
    }
  }, [])

  // Fetch locations on mount and periodically
  useEffect(() => {
    console.log("[useDashboard] Setting up location fetching");
    fetchLocations();

    // Fetch locations every 30 seconds
    const locationInterval = setInterval(() => {
      console.log("[useDashboard] Refreshing locations from API");
      fetchLocations();
    }, 30000);

    return () => {
      console.log("[useDashboard] Cleaning up location fetching");
      clearInterval(locationInterval);
    };
  }, [fetchLocations]);

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
    console.log("  - apiLocations:", apiLocations);
  }, [connectionStatus, locations, presence, alerts, rooms, stateVersion, apiLocations]);

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



  // Merge REST contact data with WebSocket real-time data AND API locations
  // Match by phone number since that's consistent across REST API, WebSocket and location API
  const contactCards: ContactCard[] = useMemo(() => {
    console.log("[useDashboard] Recalculating contactCards...");
    console.log("  - rawContacts count:", rawContacts.length);
    console.log("  - rawContacts:", rawContacts.map(c => ({ name: c.name, phone: c.phone_no })));
    console.log("  - locations size:", locations.size);
    console.log("  - locations keys:", Array.from(locations.keys()));
    console.log("  - apiLocations keys:", Object.keys(apiLocations));
    console.log("  - presence size:", presence.size);
    console.log("  - rooms size:", rooms.size);
    
    return rawContacts.map((contact) => {
      // Use phone number as the primary key for matching
      const contactPhone = contact.phone_no;
      const contactUserId = contact.user_id;
      const roomId = contact.room_id || null;
      // Get location - match by phone number
      let locationData: LocationData | null = null;
      
      console.log(`[useDashboard] Processing contact: ${contact.name} (phone: ${contactPhone})`);
      console.log(`  - Available apiLocations: ${JSON.stringify(Object.keys(apiLocations))}`);
      console.log(`  - contactPhone in apiLocations? ${contactPhone && apiLocations[contactPhone] ? "YES" : "NO"}`);
      
      // Try WebSocket locations first (in-memory, real-time) - keyed by phone number
      if (contactPhone && locations.has(contactPhone)) {
        locationData = locations.get(contactPhone) || null;
        console.log(`[useDashboard] Contact ${contact.name}: Found location in WebSocket state by phone ${contactPhone}`);
      }
      
      // Fall back to API locations - keyed by phone number
      if (!locationData && contactPhone && apiLocations[contactPhone]) {
        locationData = apiLocations[contactPhone].current;
        console.log(`[useDashboard] Contact ${contact.name}: Found location from API by phone ${contactPhone}:`, locationData);
      } else if (!locationData && contactPhone) {
        console.warn(`[useDashboard] Contact ${contact.name}: NO location found for phone ${contactPhone}`);
        console.log(`  - Checking if phone exists in apiLocations: ${Object.keys(apiLocations).includes(contactPhone)}`);
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
        id: contactUserId || contactPhone || `unknown-${contact.name}-${Math.random()}`,
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
  }, [rawContacts, locations, presence, rooms, alerts, stateVersion, apiLocations]);

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

    // Location history from API
    locationHistory: apiLocations,

    // Alerts
    activeAlerts,

    // User info
    user,

    // Actions
    handleLogout,
    acknowledgeAlert,
    manualReconnect,
    refreshContacts: displayContact,
    refreshLocations: fetchLocations,
    
  };
}
