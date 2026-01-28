import { useState, useEffect, useCallback } from "react";
import type { LatLng } from "../types";

interface MarkerData extends LatLng {
  id?: string;
  name?: string;
}

export function useMap() {
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  
  const getGeocode = useCallback(async (lat: number, lng: number) => {
    setLoading(true);

    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${import.meta.env.VITE_GEOCODING_API_KEY}`
      );

      if (!res.ok) {
        throw new Error(`Geocoding request failed: ${res.status}`);
      }

      const data = await res.json();

      if (data.status !== "OK") {
        throw new Error(data.error_message || data.status);
      }

      return data.results?.[0]?.formatted_address ?? "Unknown location";
    } finally {
      setLoading(false);
    }
  }, []);

  // Add or update a marker based on id
  const handleLocation = useCallback((contact: { id?: string; name?: string; location?: { lat: number; lng: number } }) => {
    if (!contact?.location) {
      console.log("[useMap] handleLocation called without location:", contact);
      return;
    }
    
    const { lat, lng } = contact.location;
    const id = contact.id || contact.name || `${lat},${lng}`;
    
    console.log("[useMap] handleLocation:", { id, name: contact.name, lat, lng });
    
    setMarkers((prev) => {
      const existingIndex = prev.findIndex(p => p.id === id);
      
      if (existingIndex >= 0) {
        // Update existing marker
        const existing = prev[existingIndex];
        if (existing.lat === lat && existing.lng === lng) {
          console.log("[useMap] Marker unchanged for", id);
          return prev; // No change needed
        }
        
        console.log("[useMap] Updating marker for", id, "from", existing.lat, existing.lng, "to", lat, lng);
        const updated = [...prev];
        updated[existingIndex] = { ...existing, lat, lng };
        return updated;
      }
      
      // Add new marker
      console.log("[useMap] Adding new marker for", id);
      return [...prev, { id, name: contact.name, lat, lng }];
    });
  }, []);

  // Update a specific marker by id
  const updateMarker = useCallback((id: string, lat: number, lng: number) => {
    console.log("[useMap] updateMarker:", { id, lat, lng });
    setMarkers((prev) => {
      const existingIndex = prev.findIndex(p => p.id === id);
      if (existingIndex < 0) {
        console.log("[useMap] Marker not found for update:", id);
        return prev;
      }
      
      const existing = prev[existingIndex];
      if (existing.lat === lat && existing.lng === lng) {
        return prev; // No change needed
      }
      
      const updated = [...prev];
      updated[existingIndex] = { ...existing, lat, lng };
      return updated;
    });
  }, []);

  const resetLocations = useCallback(() => {
    setMarkers([]);
    setAddress("");
    setLoading(false);
  }, []);

  return { 
    markers, 
    address, 
    loading,
    handleLocation, 
    resetLocations,
    getGeocode, 
    setAddress,
    updateMarker,
  };
}
