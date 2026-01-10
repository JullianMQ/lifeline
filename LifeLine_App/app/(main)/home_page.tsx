import React, { useContext, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import ScreenWrapper from "../../components/screen_wrapper";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import reverseGeocodeWithGoogle from "@/lib/geocode";
import { SensorContext } from "@/context/sensor_context";
import {
    connectRoomSocket,
    disconnectRoomSocket,
    sendChatMessage,
    WSMessage,
} from "@/lib/websocket";


const HomePage = () => {
    const { isMonitoring, stopMonitoring } = useContext(SensorContext);
    const [serverTime, setServerTime] = useState("");
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
                const googleAddress = await reverseGeocodeWithGoogle(
                    loc.coords.latitude,
                    loc.coords.longitude
                );

                setAddress(
                    googleAddress ?? `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`
                );
            } catch (err) {
                console.log("Error fetching location:", err);
            } finally {
                setLocationLoading(false);
            }
        })();
    }, []);

    // Time socket
    useEffect(() => {
        const roomId = "emergency-room";

        connectRoomSocket(roomId, (msg: WSMessage) => {

            if ("timestamp" in msg) {
                setServerTime(msg.timestamp);
            }
            switch (msg.type) {
                case "connected":
                    console.log("Connected to room", msg.roomId);
                    break;

                case "chat":
                    setMessageReply(`${msg.user.name}: ${msg.message}`);
                    break;

                case "direct_message":
                    setMessageReply(`Private: ${msg.message}`);
                    break;

                case "error":
                    console.warn(msg.message);
                    break;
            }
        });

        return () => {
            disconnectRoomSocket();
        };
    }, []);


    // SOS button
    const handleSOS = () => {
        const messageParts = [];

        if (address) {
            messageParts.push(address);
        }

        if (location) {
            messageParts.push(
                `(${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)})`
            );
        }

        const message =
            messageParts.length > 0
                ? `SOS! Current location: ${messageParts.join(" ")}`
                : "SOS pressed! Help needed.";

        sendChatMessage(message);
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

            {/* LIVE TIME DISPLAY */}
            <View className="mx-4 mt-4">
                <Text className="text-gray-600">Server Time:</Text>
                <Text className="text-lg font-semibold">
                    {serverTime
                        ? new Date(serverTime).toLocaleTimeString()
                        : "Connecting..."}
                </Text>

            </View>

            <View style={{ flex: 1 }} />
            {/* SOS and STOP BUTTON */}
            <View className="items-center mt-12">
                <TouchableOpacity
                    className="w-52 h-52 rounded-full items-center justify-center bg-red-600 mb-6"
                    onPress={handleSOS}
                >
                    <Ionicons name="call" size={50} color="white" />
                    <Text className="text-white font-bold mt-1 text-3xl">SOS</Text>
                </TouchableOpacity>

                {/* STOP MONITORING BUTTON - Only shows if monitoring is active */}


                {messageReply ? (
                    <Text className="mt-4 text-center text-gray-700">
                        Server reply: {messageReply}
                    </Text>
                ) : null}

                {isMonitoring && (
                    <TouchableOpacity
                        className="mt-6 mb-8 px-6 py-3 rounded-full border-2 flex-row items-center h-20 w-48 justify-center"
                        onPress={stopMonitoring}
                    >
                        {/* <Ionicons name="stop-circle-outline" size={20} color="#4b5563" /> */}
                        <Text className=" font-bold ml-2 text-2xl">STOP</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScreenWrapper>
    );
};

export default HomePage;
