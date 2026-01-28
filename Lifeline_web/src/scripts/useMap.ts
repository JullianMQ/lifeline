import { useState, useCallback } from "react";
import type { pinMarker } from "../types";

export function useMap() {
  const [markers, setMarkers] = useState<pinMarker[]>([]);
  const [pinIcon, setPinIcon] = useState<string>("");
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

  async function handleLocation(contact: any) {
    if (!contact?.location){
      return;
    }
    
    const { lat, lng } = contact.location;
    setPinIcon(contact.image);
    setMarkers((prev) => {
      if (prev.some(p => p.lat === lat && p.lng === lng)) return prev;
      return [...prev, { lat, lng, image: contact.image, contact }];
    });
  }

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
    setPinIcon("");
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
    pinIcon,
    updateMarker,
  };
}
