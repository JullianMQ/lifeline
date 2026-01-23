import { useState, useEffect } from "react";
import type { LatLng } from "../types";

export function useMap() {
  const [markers, setMarkers] = useState<LatLng[]>([]);
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  
  async function getGeocode(lat: number, lng: number) {
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
  }

  async function handleLocation(contact: any) {
    if (!contact?.location){
      return;
    };
    const { lat, lng } = contact.location;
    setMarkers((prev) => {
      if (prev.some(p => p.lat === lat && p.lng === lng)) return prev;
      return [...prev, { lat, lng }];
    });
  }

  function resetLocations() {
    setMarkers([]);
    setAddress("");
    setLoading(false);
  }

  useEffect(() => {
    const interval = setInterval(() => {
      markers.forEach((m) => handleLocation({ location: m }));
    }, 5000);

    return () => clearInterval(interval);
  }, [markers]);

  return { 
    markers, 
    address, 
    loading,
    handleLocation, 
    resetLocations,
    getGeocode, 
    setAddress,
  };
}
