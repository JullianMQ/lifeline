import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import "../styles/dashboard.css";
import type { LatLng } from "../types";

const containerStyle = {
  border: "2px solid var(--text-black)",
  borderRadius: "12px",
  width: "100%",
  height: "100%",
};

// Default center (Philippines) when no location provided
const DEFAULT_CENTER = { lat: 15.1330832, lng: 120.5874361 };

export { DEFAULT_CENTER as DEFAULT_MAP_CENTER };

interface MarkerData extends LatLng {
  id?: string;
  name?: string;
}

type Props = {
  markers: MarkerData[];
  loading: boolean;
  center?: LatLng;
};

function DashboardMap({ markers, center }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // Use provided center or fallback to default
  const mapCenter = center || DEFAULT_CENTER;

  console.log("[DashboardMap] Rendering with markers:", markers);
  console.log("[DashboardMap] Center:", mapCenter);

  if (!isLoaded) return <div className="map"> Loading...</div>; 
  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={mapCenter}
      zoom={14}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
      }}
    >
      {markers.map((marker) => (
        <Marker 
          key={marker.id || `${marker.lat},${marker.lng}`} 
          position={{ lat: marker.lat, lng: marker.lng }}
          title={marker.name}
        />
      ))}
    </GoogleMap>
  );
}

export default DashboardMap;
