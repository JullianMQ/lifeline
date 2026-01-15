type AddressComponent = {
    long_name: string;
    short_name: string;
    types: string[];
};

const reverseGeocodeWithGoogle = async (lat: number, lng: number) => {
    try {
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.EXPO_PUBLIC_GEOCODING_API_KEY}`
        );

        const data: any = await res.json();

        if (data.status !== "OK") {
            console.warn("Google Geocoding API error:", data.status, data.error_message);
            return null;
        }

        const result = data.results[0];
        if (!result) return null;

        const components: AddressComponent[] = result.address_components;
        const city = components.find(c => c.types.includes("locality"))?.long_name;
        const province = components.find(c => c.types.includes("administrative_area_level_2"))?.long_name;
        const readable = [city, province].filter(Boolean).join(", ");

        return readable || null;

    } catch (err) {
        console.warn("Google Geocoding fetch failed:", err);
        return null;
    }
};

export default reverseGeocodeWithGoogle;
