import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/lib/api/config";

const TASK_NAME = "bg-location-upload";
const ROOM_ID_KEY = "activeRoomIdForUploads";

// OS can batch callbacks; we enforce best-effort 60s pacing.
let lastUploadAt = 0;

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    if (error) return;

    const now = Date.now();
    if (now - lastUploadAt < 55_000) return; // throttle if OS delivers faster
    lastUploadAt = now;

    const locations = (data as any)?.locations as Location.LocationObject[] | undefined;
    const loc = locations?.[0];
    if (!loc) return;

    const roomId = await AsyncStorage.getItem(ROOM_ID_KEY);
    if (!roomId) return; // doc: required when WS is disconnected

    if (!API_BASE_URL) return;

    try {
        await fetch(`${API_BASE_URL}/api/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // If auth is cookie-based:
            credentials: "include" as any,
            // If you use bearer tokens, add Authorization header here instead.
            body: JSON.stringify({
                roomId,
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                accuracy: loc.coords.accuracy,
                timestamp: new Date(loc.timestamp).toISOString(),
            }),
        });
    } catch {
        // Keep silent: background task should not crash; retry happens on next tick.
    }
});

export async function setRoomIdForBackgroundUploads(roomId: string | null) {
    if (!roomId) {
        await AsyncStorage.removeItem(ROOM_ID_KEY);
        return;
    }
    await AsyncStorage.setItem(ROOM_ID_KEY, roomId);
}

export async function startBackgroundLocationUploads() {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return;

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== "granted") return;

    const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
    if (started) return;

    await Location.startLocationUpdatesAsync(TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60_000,
        deferredUpdatesInterval: 60_000,
        distanceInterval: 0,

        // Foreground service + persistent notification (doc requirement)
        foregroundService: {
            notificationTitle: "Lifeline is tracking location",
            notificationBody: "Location sharing is active for emergency monitoring.",
        },
    });
}

export async function stopBackgroundLocationUploads() {
    const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
    if (!started) return;
    await Location.stopLocationUpdatesAsync(TASK_NAME);
}
