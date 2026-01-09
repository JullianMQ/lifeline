import React, { useEffect, useRef, useState } from "react";
import {
    AppState,
    Linking,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    Alert,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { Overlay } from "./overlay";
import { Stack } from "expo-router";

type QRScannerProps = {
    onScanSuccess: (data: string) => void;
    onScanCancel: () => void;
};

const isValidMagicLink = (data: string) => {
    try {
        const url = new URL(data);
        if (!["http:", "https:"].includes(url.protocol)) return false;
        const isLocalhost =
            url.hostname === "localhost" ||
            url.hostname === "10.0.2.2" ||
            url.hostname.startsWith("192.168.") ||
            url.hostname.startsWith("10.");
        if (!isLocalhost) return false;
        return url.pathname.startsWith("/api/auth/");
    } catch {
        return false;
    }
};

export default function QRScanner({ onScanSuccess, onScanCancel }: QRScannerProps) {
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
            if (appState.current.match(/inactive|background/) && nextAppState === "active") {
                qrLock.current = false;
            }
            appState.current = nextAppState;
        });

        return () => subscription.remove();
    }, []);

    if (!hasPermission) {
        return (
            <SafeAreaView style={styles.center}>
                <Text>No access to camera</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={StyleSheet.absoluteFillObject}>
            <Stack.Screen options={{ title: "QR Login", headerShown: false }} />
            {Platform.OS === "android" && <StatusBar hidden />}

            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={({ data }) => {
                    if (!data || qrLock.current) return;
                    qrLock.current = true;

                    if (!isValidMagicLink(data)) {
                        Alert.alert(
                            "Invalid QR Code",
                            "Please scan the QR code shown on the Lifeline website.",
                            [
                                {
                                    text: "OK",
                                    onPress: () => {
                                        qrLock.current = false;
                                        onScanCancel();
                                    },
                                },
                            ]
                        );
                        return;
                    }

                    Linking.openURL(data);
                    onScanSuccess(data);
                }}
            />

            <Overlay />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});
