import React, { useContext, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import ScreenWrapper from "../../components/screen_wrapper";
import MapView from "react-native-maps";
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
    const [isSOSSending, setIsSOSSending] = useState(false);

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

    /**
     * Monitoring orchestration (SEQUENCED):
     * 1) if monitoring OFF -> stop sharing
     * 2) if monitoring ON but no room yet -> ensureMyRoom, then wait for activeRoomId via re-render
     * 3) once room exists -> cache roomId, then start foreground/background sharing
     */
    useEffect(() => {
        if (!isMonitoring) {
            stopForegroundLocationSharing().catch((err) => {
                console.error("stopForegroundLocationSharing failed:", err);
            });
            stopBackgroundLocationUploads().catch((err) => {
                console.error("stopBackgroundLocationUploads failed:", err);
            });
            return;
        }

        // Monitoring ON, but room not ready yet -> create/ensure room first
        if (!activeRoomId) {
            ensureMyRoom().catch((err) => {
                console.error("ensureMyRoom failed:", err);
                Alert.alert(
                    "Room setup failed",
                    "We couldn’t create or join your room. Please check your connection and try again.",
                    [{ text: "OK" }]
                );
            });
            return;
        }

        // Room is ready -> cache for background REST uploads, then start sharing
        setRoomIdForBackgroundUploads(activeRoomId).catch((err) => {
            console.error("setRoomIdForBackgroundUploads failed:", err);
        });

        startForegroundLocationSharing().catch((err) => {
            console.error("startForegroundLocationSharing failed:", err);
        });

        startBackgroundLocationUploads().catch((err) => {
            console.error("startBackgroundLocationUploads failed:", err);
        });
    }, [isMonitoring, activeRoomId, ensureMyRoom]);

    // Safety: stop on unmount too
    useEffect(() => {
        return () => {
            stopForegroundLocationSharing().catch((err) => {
                console.error("stopForegroundLocationSharing unmount failed:", err);
            });
            stopBackgroundLocationUploads().catch((err) => {
                console.error("stopBackgroundLocationUploads unmount failed:", err);
            });
        };
    }, []);

    const handleSOS = async () => {
        if (isSOSSending) return;

        setIsSOSSending(true);
        try {
            await sos();
        } catch (err) {
            console.error("SOS failed:", err);
            Alert.alert("SOS failed", "We couldn’t send your SOS right now. Please check your connection and try again.", [
                { text: "OK" },
            ]);
        } finally {
            setIsSOSSending(false);
        }
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
                    />
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
            </View>

            <View style={{ flex: 1 }} />

            {/* SOS and STOP BUTTON */}
            <View className="items-center mt-12">
                <TouchableOpacity
                    className="w-52 h-52 rounded-full items-center justify-center bg-red-600 mb-6"
                    onPress={handleSOS}
                    disabled={isSOSSending}
                    style={{ opacity: isSOSSending ? 0.7 : 1 }}
                >
                    {isSOSSending ? (
                        <ActivityIndicator size="large" color="white" />
                    ) : (
                        <>
                            <Ionicons name="call" size={50} color="white" />
                            <Text className="text-white font-bold mt-1 text-3xl">SOS</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    className="mt-6 mb-8 px-6 py-3 rounded-full border-2 flex-row items-center h-20 w-48 justify-center"
                    onPress={async () => {
                        try {
                            if (isMonitoring) await stopMonitoring();
                            else await startMonitoring();
                        } catch (err) {
                            console.error(`${isMonitoring ? "stopMonitoring" : "startMonitoring"} failed:`, err);
                            Alert.alert("Monitoring failed", "We couldn’t update monitoring right now. Please try again.", [
                                { text: "OK" },
                            ]);
                        }
                    }}
                >
                    <Text className="font-bold ml-2 text-2xl">{isMonitoring ? "STOP" : "START"}</Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
}
