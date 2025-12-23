import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import ScreenWrapper from "../../components/screen_wrapper";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import {
    connectTimeSocket,
    connectMessageSocket,
    disconnectTimeSocket,
} from "@/lib/websocket";

const HomePage = () => {
    const [time, setTime] = useState("");
    const [messageReply, setMessageReply] = useState("");
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [address, setAddress] = useState<string>("");
    const [locationLoading, setLocationLoading] = useState(true);

    // Fetch user location
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") {
                    console.log("Permission to access location was denied");
                    setLocationLoading(false);
                    return;
                }
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });

                setLocation({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                });

                // Reverse geocode location
                const geocode = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                });

                if (geocode.length > 0) {
                    const place = geocode[0];
                    const readable = [
                        // place.name,     
                        place.street,
                        place.city,
                        place.subregion,
                        // place.region,    
                        place.country,
                    ].filter(Boolean).join(", ");

                    setAddress(readable);
                }

            } catch (err) {
                console.log("Error fetching location:", err);
            } finally {
                setLocationLoading(false);
            }
        })();
    }, []);

    // Time socket
    useEffect(() => {
        const wsTime = connectTimeSocket(setTime);
        return () => disconnectTimeSocket();
    }, []);

    // SOS button
    const handleSOS = () => {
        const wsMsg = connectMessageSocket(setMessageReply);

        const messageParts = [];

        if (address) {
            messageParts.push(address);
        }

        if (location) {
            messageParts.push(`(${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)})`);
        }

        const message = messageParts.length > 0
            ? `SOS! Current location: ${messageParts.join(" ")}`
            : "SOS pressed! Help needed.";

        if (wsMsg.readyState === WebSocket.OPEN) {
            wsMsg.send(message);
        } else {
            wsMsg.onopen = () => wsMsg.send(message);
        }

        wsMsg.onmessage = (event) => {
            setMessageReply(event.data);
        };
    };


    return (
        <ScreenWrapper>
            {/* MAP BOX */}
            <View className="bg-white mx-4 mt-4 rounded-2xl overflow-hidden border" style={{ height: 384 }}>
                {locationLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#eee" }}>
                        <ActivityIndicator size="large" color="#888" />
                        <Text className="text-gray-600 mt-2">Loading map...</Text>
                    </View>
                ) : location ? (
                    <MapView
                        style={{ flex: 1 }}
                        initialRegion={{
                            latitude: location.latitude,
                            longitude: location.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }}
                        showsUserLocation
                    >
                        <Marker coordinate={location} title="You are here" />
                    </MapView>
                ) : (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#eee" }}>
                        <Text className="text-gray-600">Location not available</Text>
                    </View>
                )}
            </View>

            {/* LOCATION TEXT */}
            <View className="mx-4 mt-3">
                <Text className="text-s text-gray-500">You are at:</Text>
                {address ? (
                    <Text className="text-xl font-semibold">{address}</Text>
                ) : location ? (
                    <Text className="text-xl font-semibold">
                        {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    </Text>
                ) : (
                    <Text className="text-xl font-semibold text-gray-400">Unknown</Text>
                )}
            </View>

            {/* LIVE TIME DISPLAY */}
            <View className="mx-4 mt-4">
                <Text className="text-gray-600">Server Time:</Text>
                <Text className="text-lg font-semibold">{time || "Connecting..."}</Text>
            </View>

            {/* SOS BUTTON */}
            <View className="items-center mt-12">
                <TouchableOpacity
                    className="w-32 h-32 rounded-full items-center justify-center bg-red-600"
                    onPress={handleSOS}
                >
                    <Ionicons name="call" size={30} color="white" />
                    <Text className="text-white font-bold mt-1">SOS</Text>
                </TouchableOpacity>

                {messageReply ? (
                    <Text className="mt-4 text-center text-gray-700">
                        Server reply: {messageReply}
                    </Text>
                ) : null}
            </View>
        </ScreenWrapper>
    );
};

export default HomePage;
