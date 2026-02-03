import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import "../styles/pin.css";
import type { LatLng } from "../types";
import type { ContactCard } from "../types/realtime";

const containerStyle = {
  borderRadius: "12px",
  width: "100%",
  height: "100%",
};

// Default center (Philippines) when no location provided
const DEFAULT_CENTER = { lat: 15.1330832, lng: 120.5874361 };

export { DEFAULT_CENTER as DEFAULT_MAP_CENTER };

type Props = {
  loading: boolean;
  center?: LatLng;
  onSelectContact: (contact: ContactCard) => void;
  contacts: ContactCard[];
};

function DashboardMap({ center, onSelectContact, contacts }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["marker"],
  });
  const [map, setMap] = useState<google.maps.Map | null>(null);

  useEffect(() => {
    if (!map) return;
    if (!google?.maps?.marker?.AdvancedMarkerElement) return;

    const created: google.maps.marker.AdvancedMarkerElement[] = [];
    const listeners: Array<() => void> = [];
    contacts.forEach((m) => {
      
      const pin = document.createElement("div");
      pin.className = ` map-pin ${m.hasActiveAlert ? 'alert-mode' : ''}`;

      const head = document.createElement("div");
      head.className = "map-pin-head";

      const avatar = document.createElement("img");
      avatar.className = "map-pin-avatar";
      avatar.src = m.image || "/images/user-example.svg";
      avatar.alt = m?.name ? `${m.name} avatar` : "Contact avatar";
      head.appendChild(avatar);

      const tail = document.createElement("div");
      tail.className = "map-pin-tail";

      pin.appendChild(head);
      pin.appendChild(tail);

      if (m) {
        const handler = (e: Event) => {
          e.stopPropagation();
          onSelectContact(m);
        };
        pin.addEventListener("click", handler);
        listeners.push(() => pin.removeEventListener("click", handler));
      }

      const mk = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: m.location?.coords.lat || 0, lng: m.location?.coords.lng || 0 },
        content: pin,
      });

      created.push(mk);
      console.log("[DashboardMap] Created marker:", created);
    });

    return () => {
      listeners.forEach((remove) => remove());
      created.forEach((mk) => {
        mk.map = null;
      });
    };
  }, [map, onSelectContact]);

  if (!isLoaded) return <div className="map">Loading...</div>;

  // Use provided center or fallback to default
  const mapCenter = center || DEFAULT_CENTER;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={mapCenter}
      zoom={14}
      onLoad={(m) => setMap(m)}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        mapId: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      }}
    />
  );
}

export default DashboardMap;
