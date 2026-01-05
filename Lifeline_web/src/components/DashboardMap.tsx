import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import '../styles/dashboard.css'

const containerStyle = {
  border: "2px solid var(--text-black)",
  borderRadius: "12px",
  width: "100%",
  height: "100%",
};

const center = {
  lat: 15.133367975125921, 
  lng: 120.59005391186881,
};

function DashboardMap() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  if (!isLoaded) return <p>Loading map...</p>;

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
      <Marker position={center} />
    </GoogleMap>
  );
}

export default DashboardMap;
