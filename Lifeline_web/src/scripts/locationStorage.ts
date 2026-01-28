/**
 * localStorage utility for persisting location data
 * Stores user locations with userId, coordinates, and timestamp
 */
const STORAGE_KEY = "lifeline_locations";
export interface StoredLocation {
    userId: string;
    userName: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
    receivedAt: string; // When we received this update
}
export interface LocationStore {
    [userId: string]: StoredLocation;
}
/**
 * Get all stored locations from localStorage
 */
export function getStoredLocations(): LocationStore {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return {};
        return JSON.parse(stored) as LocationStore;
    } catch (error) {
        console.error("[locationStorage] Failed to parse stored locations:", error);
        return {};
    }
}
/**
 * Get a single user's location from localStorage
 */
export function getStoredLocation(userId: string): StoredLocation | null {
    const locations = getStoredLocations();
    return locations[userId] || null;
}
/**
 * Save a location update to localStorage
 */
export function saveLocation(location: Omit<StoredLocation, "receivedAt">): void {
    try {
        const locations = getStoredLocations();
        const storedLocation: StoredLocation = {
            ...location,
            receivedAt: new Date().toISOString(),
        };

        locations[location.userId] = storedLocation;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));

        console.log("[locationStorage] Saved location for", location.userId, storedLocation);

        // Dispatch a custom event so components can react to localStorage changes
        window.dispatchEvent(new CustomEvent("lifeline-location-update", {
            detail: storedLocation,
        }));
    } catch (error) {
        console.error("[locationStorage] Failed to save location:", error);
    }
}
/**
 * Remove a user's location from localStorage
 */
export function removeLocation(userId: string): void {
    try {
        const locations = getStoredLocations();
        delete locations[userId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
        console.log("[locationStorage] Removed location for", userId);
    } catch (error) {
        console.error("[locationStorage] Failed to remove location:", error);
    }
}
/**
 * Clear all stored locations
 */
export function clearAllLocations(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log("[locationStorage] Cleared all locations");
    } catch (error) {
        console.error("[locationStorage] Failed to clear locations:", error);
    }
}
/**
 * Hook to listen for location updates from localStorage
 * Returns a function to unsubscribe
 */
export function subscribeToLocationUpdates(
    callback: (location: StoredLocation) => void
): () => void {
    const handler = (event: Event) => {
        const customEvent = event as CustomEvent<StoredLocation>;
        callback(customEvent.detail);
    };

    window.addEventListener("lifeline-location-update", handler);

    return () => {
        window.removeEventListener("lifeline-location-update", handler);
    };
}
