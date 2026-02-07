import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/lib/api/config";
import { getActiveRoom, isWSConnected, sendLocationUpdate } from "@/lib/services/websocket";
import { getToken } from "@/lib/api/storage/user";

const TASK_NAME = "bg-location-upload";
const ROOM_ID_KEY = "activeRoomIdForUploads";

// OS can batch callbacks; we enforce best-effort ~60s pacing.
let lastBgUploadAt = 0;

// Foreground subscription (WS-first every ~60s)
let fgSub: Location.LocationSubscription | null = null;
let lastFgUploadAt = 0;

function resolveApiLocationUrl() {
    const base = (API_BASE_URL ?? "").replace(/\/$/, "");
    if (!base) return null;

    // Server expects /api/location
    // If API_BASE_URL already ends with /api, avoid double /api/api
    if (base.endsWith("/api")) return `${base}/location`;
    return `${base}/api/location`;
}

async function postLocationHTTP(payload: {
    roomId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    accuracy?: number | null;
}) {
    const url = resolveApiLocationUrl();
    if (!url) return;

    try {
        const token = await getToken().catch(() => null);

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        // Keep cookie-based auth behavior, but also add Bearer token when available
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        await fetch(url, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify(payload),
        });
    } catch {
        // Keep silent: background/foreground loops should not crash; retry happens on next tick.
    }
}

async function cacheRoomIdForFallback(roomId: string | null) {
    if (!roomId) return;
    await AsyncStorage.setItem(ROOM_ID_KEY, roomId);
}

/**
 * Background task = HTTP fallback.
 *
 * Rationale: WebSockets are typically not reliable inside Expo background tasks on Android.
 * Spec: when WS is disconnected, REST uploads must include roomId.
 */
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    if (error) return;

    const now = Date.now();
    if (now - lastBgUploadAt < 55_000) return;
    lastBgUploadAt = now;

    const locations = (data as any)?.locations as Location.LocationObject[] | undefined;
    const loc = locations?.[0];
    if (!loc) return;

    const roomId = await AsyncStorage.getItem(ROOM_ID_KEY);
    if (!roomId) return;

    await postLocationHTTP({
        roomId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? null,
        timestamp: new Date(loc.timestamp).toISOString(),
    });
});

export async function setRoomIdForBackgroundUploads(roomId: string | null) {
    if (!roomId) {
        await AsyncStorage.removeItem(ROOM_ID_KEY);
        return;
    }
    await AsyncStorage.setItem(ROOM_ID_KEY, roomId);
}

/**
 * Foreground location sharing (WS-first):
 * - Every ~60 seconds, send WS "location-update" if connected
 * - If WS is disconnected, fallback to HTTP /api/location (requires roomId)
 *
 * Call this when your monitoring starts.
 */
export async function startForegroundLocationSharing() {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return;

    if (fgSub) return;

    fgSub = await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60_000,
            distanceInterval: 0,
        },
        async (loc) => {
            const now = Date.now();
            if (now - lastFgUploadAt < 55_000) return;
            lastFgUploadAt = now;

            const latitude = loc.coords.latitude;
            const longitude = loc.coords.longitude;
            const accuracy = loc.coords.accuracy ?? undefined;
            const timestamp = new Date(loc.timestamp).toISOString();

            const activeRoomId = getActiveRoom();
            await cacheRoomIdForFallback(activeRoomId);

            if (isWSConnected()) {
                // Spec requires roomId for WS location updates.
                const roomId = activeRoomId ?? (await AsyncStorage.getItem(ROOM_ID_KEY));
                if (!roomId) return;

                await sendLocationUpdate({
                    roomId,
                    latitude,
                    longitude,
                    accuracy,
                    timestamp,
                });
            } else {
                // REST fallback requires roomId
                const roomId = activeRoomId ?? (await AsyncStorage.getItem(ROOM_ID_KEY));
                if (!roomId) return;

                await postLocationHTTP({
                    roomId,
                    latitude,
                    longitude,
                    accuracy: accuracy ?? null,
                    timestamp,
                });
            }
        }
    );
}

export async function stopForegroundLocationSharing() {
    if (!fgSub) return;
    fgSub.remove();
    fgSub = null;
    lastFgUploadAt = 0;
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

        // Foreground service + persistent notification (spec-sensitive)
        foregroundService: {
            notificationTitle: "Lifeline is tracking location",
            notificationBody: "Location sharing is active for emergency monitoring.",
        },
    });
}

export async function stopBackgroundLocationUploads() {
    // Avoid throwing when the task isn't registered in the current JS runtime
    // (common during dev reloads / if this module wasn't imported on startup).
    const isDefined = TaskManager.isTaskDefined(TASK_NAME);
    if (!isDefined) return;

    try {
        const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
        if (!started) return;
        await Location.stopLocationUpdatesAsync(TASK_NAME);
    } catch (e: any) {
        // If the native side doesn't know about this task, treat it as already-stopped.
        const msg = String(e?.message ?? "");
        if (msg.includes("TaskNotFoundException") || msg.includes("TaskNotFound")) return;
        throw e;
    }
}

export async function clearRoomIdFallbackCache() {
    try {
        await AsyncStorage.removeItem(ROOM_ID_KEY);
    } catch {
        // ignore
    }
}
