import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";

import ScreenWrapper from "../../components/screen_wrapper";
import { useWS } from "@/lib/context/ws_context";


const DEFAULT_REGION: Region = {
    latitude: 15.0794,
    longitude: 120.62,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

const LiveTrackingScreen: React.FC = () => {
    const router = useRouter();
    const { liveLocations, isConnected } = useWS();

    const mapRef = useRef<MapView | null>(null);
    const [region, setRegion] = useState<Region>(DEFAULT_REGION);
    const [isLocating, setIsLocating] = useState<boolean>(true);
    const [followLatest, setFollowLatest] = useState<boolean>(true);

    const liveList = useMemo(() => Object.values(liveLocations ?? {}), [liveLocations]);

    // Get user's device location once for a good initial camera position
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                setIsLocating(true);
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") {
                    if (!cancelled) setIsLocating(false);
                    return;
                }

                const pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                if (cancelled) return;

                const next: Region = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                };

                setRegion(next);
                mapRef.current?.animateToRegion(next, 400);
            } catch {
                // Keep DEFAULT_REGION
            } finally {
                if (!cancelled) setIsLocating(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // Optionally follow the latest location update (last in array)
    useEffect(() => {
        if (!followLatest) return;
        if (!liveList.length) return;

        const latest = liveList[liveList.length - 1];
        if (!latest) return;

        const next: Region = {
            latitude: latest.latitude,
            longitude: latest.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        };

        setRegion(next);
        mapRef.current?.animateToRegion(next, 350);
    }, [followLatest, liveList]);

    return (
        <ScreenWrapper
            showBottomNav={false}
            scrollable={false}
            topNavProps={{
                backButtonOnly: true,
                onBackPress: () => router.back(),
            }}
        >
            <View style={{ flex: 1 }}>
                <MapView
                    ref={(r) => {
                        mapRef.current = r;
                    }}
                    style={{ flex: 1 }}
                    region={region}
                    onRegionChangeComplete={(r) => setRegion(r)}
                    showsUserLocation
                    showsMyLocationButton
                    followsUserLocation={false}
                >
                    {liveList.map((loc) => (
                        <Marker
                            key={loc.id}
                            coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                            title={loc.userName || loc.visiblePhone || loc.id}
                            description={loc.timestamp ? `Updated: ${loc.timestamp}` : undefined}
                            pinColor={loc.sos ? "red" : undefined}
                        />
                    ))}
                </MapView>

                {/* Overlay */}
                <View
                    style={{
                        position: "absolute",
                        top: 10,
                        left: 10,
                        right: 10,
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: "rgba(255,255,255,0.92)",
                    }}
                >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View>
                            <Text style={{ fontSize: 14, fontWeight: "700" }}>Live Tracking</Text>
                            <Text style={{ fontSize: 12 }}>
                                WS: {isConnected ? "connected" : "disconnected"} • Markers: {liveList.length}
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => setFollowLatest((v) => !v)}
                            style={{
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                                borderRadius: 10,
                                backgroundColor: followLatest ? "#E11D48" : "#e5e7eb",
                            }}
                        >
                            <Text style={{ color: followLatest ? "white" : "#111827", fontSize: 12, fontWeight: "700" }}>
                                {followLatest ? "FOLLOWING" : "FOLLOW"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {isLocating && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                            <ActivityIndicator />
                            <Text style={{ marginLeft: 8, fontSize: 12 }}>Getting your location…</Text>
                        </View>
                    )}

                    {!liveList.length && !isLocating && (
                        <Text style={{ marginTop: 8, fontSize: 12 }}>
                            No live locations yet. When the backend broadcasts location updates, markers will appear here.
                        </Text>
                    )}
                </View>
            </View>
        </ScreenWrapper>
    );
};

export default LiveTrackingScreen;