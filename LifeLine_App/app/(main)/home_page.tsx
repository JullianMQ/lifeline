// app/(main)/home_page.tsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import ScreenWrapper from "../../components/screen_wrapper";
import MapView from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import reverseGeocodeWithGoogle from "@/lib/services/geocode";
import { SensorContext } from "@/lib/context/sensor_context";
import { useWS } from "@/lib/context/ws_context";

// If you actually have this config, keep it. If not, remove the REST call block.
import { API_BASE_URL } from "@/lib/api/config";

export default function HomePage() {
    const { isMonitoring, stopMonitoring, startMonitoring } = useContext(SensorContext);

    const {
        isConnected,
        clientId,
        rooms,
        activeRoomId,
        serverTimestamp,
        lastMessage,
        lastError,
        ensureMyRoom,
        sendToRoom,
        sos,
    } = useWS();

    const [messageReply, setMessageReply] = useState("");
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
                const googleAddress = await reverseGeocodeWithGoogle(loc.coords.latitude, loc.coords.longitude);
                setAddress(googleAddress ?? `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
            } catch (err) {
                console.log("Error fetching location:", err);
            } finally {
                setLocationLoading(false);
            }
        })();
    }, []);

    // Ensure we end up in "my room" once socket + clientId are ready.
    // This uses join-first then create-fallback, so it won't spam "room already exists".
    useEffect(() => {
        if (!isConnected) return;
        if (!clientId) return;

        // Only ensure if we truly have no rooms yet
        if (!rooms.length) {
            ensureMyRoom();
        }
    }, [isConnected, clientId, rooms.length, ensureMyRoom]);

    // Handle incoming WS messages (matches integration test flow)
    useEffect(() => {
        if (!lastMessage) return;

        switch (lastMessage.type) {
            case "room-message": {
                const text =
                    typeof lastMessage.content === "string"
                        ? lastMessage.content
                        : lastMessage.content?.text ?? JSON.stringify(lastMessage.content);

                setMessageReply(`${lastMessage.user?.name ?? "Unknown"}: ${text}`);
                break;
            }

            case "location-update": {
                setMessageReply(
                    `Location update: (${lastMessage.latitude.toFixed(5)}, ${lastMessage.longitude.toFixed(5)})`
                );
                break;
            }

            case "emergency-alert": {
                setMessageReply(`EMERGENCY ALERT: ${lastMessage.message}`);
                break;
            }

            case "emergency-confirmed": {
                setMessageReply(`SOS confirmed. Activated rooms: ${lastMessage.activatedRooms.join(", ")}`);
                break;
            }

            case "emergency-activated": {
                setMessageReply(`Emergency activated in room: ${lastMessage.roomId}`);
                break;
            }

            case "join-denied":
            case "error": {
                setMessageReply(`Error: ${lastMessage.message}`);
                break;
            }

            default:
                break;
        }
    }, [lastMessage]);

    const serverTimeLabel = useMemo(() => {
        if (!serverTimestamp) return "Connecting...";
        try {
            return new Date(serverTimestamp).toLocaleTimeString();
        } catch {
            return serverTimestamp;
        }
    }, [serverTimestamp]);

    async function postLocationToApi() {
        if (!API_BASE_URL) return;
        if (!location) return;
        if (!activeRoomId) return;

        await fetch(`${API_BASE_URL}/api/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // include cookies if your auth uses cookie sessions
            credentials: "include" as any,
            body: JSON.stringify({
                roomId: activeRoomId,
                latitude: location.latitude,
                longitude: location.longitude,
                address,
            }),
        });
    }

    const handleSOS = async () => {
        // guard: avoid confusing warnings + guarantee room scoped actions
        if (!isConnected) {
            setMessageReply("WebSocket not connected yet.");
            return;
        }
        if (!activeRoomId) {
            setMessageReply("Connected, but you are not in a room yet.");
            return;
        }

        const parts: string[] = [];
        if (address) parts.push(address);
        if (location) parts.push(`(${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)})`);

        const text = parts.length > 0 ? `SOS! Current location: ${parts.join(" ")}` : "SOS pressed! Help needed.";

        // 1) Trigger emergency workflow
        sos();

        // 2) Broadcast to current room
        sendToRoom(
            {
                text,
                address,
                location: location ? { ...location } : null,
                createdAt: new Date().toISOString(),
            },
            activeRoomId
        );

        // 3) Optional: POST /api/location to trigger WS location-update broadcasts (matches test Suite 6)
        try {
            await postLocationToApi();
        } catch (e) {
            console.log("Failed to POST /api/location", e);
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
                <Text className="text-gray-600">Server Time:</Text>
                <Text className="text-lg font-semibold">{serverTimeLabel}</Text>

                <Text className="text-gray-500 mt-2">
                    WS: {isConnected ? "connected" : "connecting"} {activeRoomId ? `| active room: ${activeRoomId}` : "| no room"}
                </Text>

                {lastError ? <Text className="text-red-600 mt-1">{lastError}</Text> : null}
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

                {messageReply ? <Text className="mt-4 text-center text-gray-700">Server: {messageReply}</Text> : null}

                <TouchableOpacity
                    className="mt-6 mb-8 px-6 py-3 rounded-full border-2 flex-row items-center h-20 w-48 justify-center"
                    onPress={() => {
                        if (isMonitoring) stopMonitoring();
                        else startMonitoring();
                    }}
                >
                    <Text className="font-bold ml-2 text-2xl">{isMonitoring ? "STOP" : "START"}</Text>
                    <Text className="font-bold ml-2 text-2xl">{isMonitoring ? "STOP" : "START"}</Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
}
}
