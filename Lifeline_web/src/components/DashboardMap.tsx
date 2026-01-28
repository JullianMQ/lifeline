import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import "../styles/pin.css";
import type { Contact, LatLng } from "../types";

const containerStyle = {
  border: "2px solid var(--text-black)",
  borderRadius: "12px",
  width: "100%",
  height: "100%",
};

type Props = {
  markers: LatLng[];
  loading: boolean;
  center?: LatLng;
  onSelectContact: (contact: Contact) => void;
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

    markers.forEach((m, index) => {
      const pin = document.createElement("div");
      pin.className = "map-pin";

      pin.innerHTML = `
        <div class="map-pin-head">
          <img
            class="map-pin-avatar"
            src="${m.image || "/images/user-example.svg"}"
          />
        </div>
        <div class="map-pin-tail"></div>
      `;

      if (index > 0 && m.contact) {
        pin.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectContact(m.contact);
        });
      }

      const mk = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: m.lat, lng: m.lng },
        content: pin,
      });

      created.push(mk);
    });

    return () => created.forEach((mk) => (mk.map = null));
  }, [map, markers]);

  if (!isLoaded) return <div className="map">Loading...</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
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
