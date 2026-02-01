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
    if (contact.image) {
      setPinIcon(contact.image);
    }
    setMarkers((prev) => {
      // Check if a marker for this contact already exists (by id)
      const existingIndex = prev.findIndex(p => p.contact?.id === contact.id || p.id === contact.id);
      
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const isSameLocation = existing.lat === lat && existing.lng === lng;
        const isSameImage = existing.image === contact.image;
        const isSameContact = existing.contact === contact;
        if (isSameLocation && isSameImage && isSameContact) {
          return prev;
        }
        // Update the existing marker with new coordinates (remove old, add updated)
        const updated = [...prev];
        updated[existingIndex] = { 
          ...existing, 
          lat, 
          lng, 
          image: contact.image, 
          contact,
          id: contact.id 
        };
        console.log("[useMap] Updated existing marker for:", contact.name || contact.id, { lat, lng });
        return updated;
      }
      
      // No existing marker, add a new one
      console.log("[useMap] Adding new marker for:", contact.name || contact.id, { lat, lng });
      return [...prev, { lat, lng, image: contact.image, contact, id: contact.id }];
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
