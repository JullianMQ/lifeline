import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import "../styles/dashboard.css";
import type { LatLng } from "../types";

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
};

function DashboardMap({ markers, center }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  if (!isLoaded) return <div className="map"> Loading...</div>; 
  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={14}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
      }}
    >
      {markers.map((position, index) => (
        <Marker key={index} position={position} />
      ))}
    </GoogleMap>
  );
}

export default DashboardMap;
