import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import "../styles/pin.css";
import type { LatLng, pinMarker } from "../types";
import type { ContactCard } from "../types/realtime";

const containerStyle = {
  border: "2px solid var(--text-black)",
  borderRadius: "12px",
  width: "100%",
  height: "100%",
};

// Default center (Philippines) when no location provided
const DEFAULT_CENTER = { lat: 15.1330832, lng: 120.5874361 };

export { DEFAULT_CENTER as DEFAULT_MAP_CENTER };

type Props = {
  markers: pinMarker[];
  loading: boolean;
  center?: LatLng;
  onSelectContact: (contact: ContactCard) => void;
};

function DashboardMap({ markers, center, onSelectContact }: Props) {
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

    markers.forEach((m) => {
      const pin = document.createElement("div");
      pin.className = "map-pin";

      const head = document.createElement("div");
      head.className = "map-pin-head";

      const avatar = document.createElement("img");
      avatar.className = "map-pin-avatar";
      avatar.src = m.image || "/images/user-example.svg";
      avatar.alt = m.contact?.name ? `${m.contact.name} avatar` : "Contact avatar";
      head.appendChild(avatar);

      const tail = document.createElement("div");
      tail.className = "map-pin-tail";

      pin.appendChild(head);
      pin.appendChild(tail);

      if (m.contact) {
        const handler = (e: Event) => {
          e.stopPropagation();
          onSelectContact(m.contact);
        };
        pin.addEventListener("click", handler);
        listeners.push(() => pin.removeEventListener("click", handler));
      }

      const mk = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: m.lat, lng: m.lng },
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
  }, [map, markers, onSelectContact]);

  if (!isLoaded) return <div className="map">Loading...</div>;

  // Use provided center or fallback to default
  const mapCenter = center || DEFAULT_CENTER;

  console.log("[DashboardMap] Rendering with markers:", markers);
  console.log("[DashboardMap] Center:", mapCenter);

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={mapCenter}
      zoom={14}
      onLoad={(m) => setMap(m)}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID,
      }}
    />
  );
}

export default DashboardMap;
