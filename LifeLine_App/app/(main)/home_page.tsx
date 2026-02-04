import React, { useContext, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import ScreenWrapper from "../../components/screen_wrapper";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import reverseGeocodeWithGoogle from "@/lib/services/geocode";
import { SensorContext } from "@/lib/context/sensor_context";
import { useWS } from "@/lib/context/ws_context";

import {
    startForegroundLocationSharing,
    stopForegroundLocationSharing,
    startBackgroundLocationUploads,
    stopBackgroundLocationUploads,
    setRoomIdForBackgroundUploads,
} from "@/lib/services/background_location";

export default function HomePage() {
    const { isMonitoring, stopMonitoring, startMonitoring } = useContext(SensorContext);
    const { isConnected, activeRoomId, lastError, ensureMyRoom, sos } = useWS();

    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [address, setAddress] = useState<string>("");
    const [locationLoading, setLocationLoading] = useState(true);
    const [incident, setIncident] = useState(incidentManager.getActive());

    // Fetch user location (for the map UI only)
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") {
                    setLocationLoading(false);
                    return;
                }

                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

                const googleAddress = await reverseGeocodeWithGoogle(loc.coords.latitude, loc.coords.longitude);
                setAddress(googleAddress ?? `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
            } catch (err) {
                console.log("Error fetching location:", err);
            } finally {
                setLocationLoading(false);
            }
        })();
    }, []);

    // Create/ensure a room ONLY when monitoring starts
    useEffect(() => {
        if (!isMonitoring) return;
        if (activeRoomId) return;
        ensureMyRoom();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMonitoring, activeRoomId]);

    // When we have an active room, cache it for REST fallback (background task)
    useEffect(() => {
        if (!activeRoomId) return;
        setRoomIdForBackgroundUploads(activeRoomId);
    }, [activeRoomId]);

    // Start/stop location sharing based on monitoring.
    // Foreground: WS-first every ~60s (HTTP fallback if WS is down)
    // Background: HTTP fallback every ~60s (Expo task)
    useEffect(() => {
        if (!isMonitoring) {
            stopForegroundLocationSharing();
            stopBackgroundLocationUploads();
            return;
        }

        // Start both; background task will only succeed once roomId is cached.
        startForegroundLocationSharing();
        startBackgroundLocationUploads();

        return () => {
            stopForegroundLocationSharing();
            stopBackgroundLocationUploads();
        };
    }, [isMonitoring]);

    const handleSOS = async () => {
        await sos();
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
                        provider="google"
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

            {/* WS STATUS */}
            <View className="mx-4 mt-4">
                <Text className="text-gray-600">WebSocket:</Text>
                <Text className="text-base font-semibold">
                    {isConnected ? `connected | ${activeRoomId ?? "no room"}` : "disconnected"}
                </Text>

                {/* <Text className="text-gray-600 mt-2">Server Time:</Text>
                <Text className="text-lg font-semibold">
                    {serverTimestamp ? new Date(serverTimestamp).toLocaleTimeString() : "—"}
                </Text> */}

                {lastError ? <Text className="text-red-600 mt-2">{lastError}</Text> : null}
            </View>

            <View style={{ flex: 1 }} />


            {/* SOS and STOP BUTTON */}
            <View className="items-center mt-12">
                <TouchableOpacity className="w-52 h-52 rounded-full items-center justify-center bg-red-600 mb-6" onPress={handleSOS}>
                    <Ionicons name="call" size={50} color="white" />
                    <Text className="text-white font-bold mt-1 text-3xl">SOS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="mt-6 mb-8 px-6 py-3 rounded-full border-2 flex-row items-center h-20 w-48 justify-center"
                    onPress={() => {
                        if (isMonitoring) stopMonitoring();
                        else startMonitoring();
                    }}
                >
                    <Text className="font-bold ml-2 text-2xl">{isMonitoring ? "STOP" : "START"}</Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
}
