import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, StatusBar, StyleSheet, Text } from "react-native";
import { Camera, CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { Overlay } from "./overlay";
import { Stack } from "expo-router";


const isValidUrl = (data: string) => {
    const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,6}\/?[a-zA-Z0-9-._~:\/?#[\]@!$&'()*+,;=]*$/;
    return urlPattern.test(data);
};

export default function Home() {
    const qrLock = useRef(false);
    const appState = useRef(AppState.currentState);

    const [hasPermission, setHasPermission] = useState(false);

    useEffect(() => {
        const getPermission = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === "granted");
        };

        getPermission();

        const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === "active"
            ) {
                qrLock.current = false;
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

    if (!hasPermission) {
        return <SafeAreaView style={styles.center}><Text>No access to camera</Text></SafeAreaView>;
    }

    return (
        <SafeAreaView style={StyleSheet.absoluteFillObject}>
            <Stack.Screen
                options={{
                    title: "Overview",
                    headerShown: false,
                }}
            />
            {Platform.OS === "android" ? <StatusBar hidden /> : null}

            {/* Camera View */}
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={({ data }) => {
                    if (data && !qrLock.current) {
                        qrLock.current = true;


                        if (isValidUrl(data)) {
                            setTimeout(async () => {
                                await Linking.openURL(data);
                            }, 500);
                        } else {
                            console.log("Invalid URL scanned:", data);
                        }
                    }
                }}
            />
            <Overlay />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
