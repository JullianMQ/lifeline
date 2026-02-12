import React, { useEffect, useRef, useState, useMemo } from "react";
import {
    AppState,
    Linking,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    Alert,
} from "react-native";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { Overlay } from "./overlay";
import { Stack } from "expo-router";

type QRScannerProps = {
    onScanSuccess: (data: string) => void;
    onScanCancel: () => void;
};

const APP_DEEPLINK = "lifeline://landing";

/**
 * Builds an allowlist of hosts that are permitted to be scanned.
 * Includes your production API host + common dev hosts.
 */
function buildAllowedHosts(): Set<string> {
    const hosts = new Set<string>();

    // Production API host from env
    const base = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (base) {
        try {
            hosts.add(new URL(base).hostname);
        } catch {

        }
    }

    // Common dev hosts
    hosts.add("localhost");
    hosts.add("10.0.2.2");

    return hosts;
}

function isLanHost(hostname: string) {
    return hostname.startsWith("192.168.") || hostname.startsWith("10.");
}

/**
 * Only accept URLs that look like your magic-link verify endpoint.
 * Keep this strict for safety.
 */
function isValidMagicLinkUrl(data: string, allowedHosts: Set<string>) {
    try {
        const url = new URL(data);

        // Allow http(s) only for the scanned QR (the verify endpoint is https)
        if (!["http:", "https:"].includes(url.protocol)) return false;

        const hostOk = allowedHosts.has(url.hostname) || isLanHost(url.hostname);
        if (!hostOk) return false;

        // Your decoded QR is: /api/auth/magic-link/verify
        const pathOk =
            url.pathname === "/api/auth/magic-link/verify" ||
            url.pathname.startsWith("/api/auth/");

        if (!pathOk) return false;

        // Require a token param (basic sanity)
        const token = url.searchParams.get("token");
        if (!token || token.length < 8) return false;

        return true;
    } catch {
        return false;
    }
}

/**
 * Rewrite callback URLs so that even a web-generated QR
 * can bring the user back into the mobile app.
 *
 * - Forces callbackURL to lifeline://landing
 * - Ensures newUserCallbackURL + errorCallbackURL exist too
 */
function normalizeMagicLink(data: string) {
    const url = new URL(data);

    url.searchParams.set("callbackURL", APP_DEEPLINK);

    // Some QR generators only include callbackURL.
    // Your mobile flow includes these; we add them to match behavior.
    if (!url.searchParams.get("newUserCallbackURL")) {
        url.searchParams.set("newUserCallbackURL", APP_DEEPLINK);
    }
    if (!url.searchParams.get("errorCallbackURL")) {
        url.searchParams.set("errorCallbackURL", APP_DEEPLINK);
    }

    return url.toString();
}

export default function QRScanner({ onScanSuccess, onScanCancel }: QRScannerProps) {
    const qrLock = useRef(false);
    const appState = useRef(AppState.currentState);
    const [hasPermission, setHasPermission] = useState(false);

    const allowedHosts = useMemo(() => buildAllowedHosts(), []);

    useEffect(() => {
        const getPermission = async () => {
            const { status } = await import("expo-camera").then((m) =>
                m.Camera.requestCameraPermissionsAsync()
            );
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
                onBarcodeScanned={async ({ data }) => {
                    if (!data || qrLock.current) return;
                    qrLock.current = true;

                    // Helpful debug log
                    console.log("SCANNED QR:", data);

                    if (!isValidMagicLinkUrl(data, allowedHosts)) {
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


                    const finalUrl = normalizeMagicLink(data);
                    console.log("OPENING MAGIC LINK:", finalUrl);

                    try {
                        const canOpen = await Linking.canOpenURL(finalUrl);
                        if (!canOpen) {
                            Alert.alert("Error", "Cannot open this QR link on your device.");
                            qrLock.current = false;
                            onScanCancel();
                            return;
                        }

                        await Linking.openURL(finalUrl);
                        onScanSuccess(finalUrl);
                    } catch (e: any) {
                        Alert.alert("Error", e?.message || "Failed to open QR link.");
                        qrLock.current = false;
                        onScanCancel();
                    }
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
