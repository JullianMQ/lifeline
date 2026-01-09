import React, { createContext, useState } from 'react';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';

export const SensorContext = createContext({
    isMonitoring: false,
    startMonitoring: async () => { },
    stopMonitoring: async () => { },
});

export const SensorProvider = ({ children }: { children: React.ReactNode }) => {
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [subscription, setSubscription] = useState<any>(null);

    const startMonitoring = async () => {
        if (isMonitoring) return;

        console.log("Starting Foreground Monitoring...");

        // 1. Only request Foreground permissions for now
        const { status: sensorStatus } = await Accelerometer.requestPermissionsAsync();
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();

        if (sensorStatus !== 'granted') {
            alert("Accelerometer permissions are required.");
            return;
        }

        // 2. We SKIP background location updates for this test
        // This avoids the 'ACCESS_BACKGROUND_LOCATION' error

        // 3. Start the Accelerometer listener
        Accelerometer.setUpdateInterval(300);
        const sub = Accelerometer.addListener(accelerometerData => {
            const { x, y, z } = accelerometerData;

            // Calculate Magnitude (G-force)
            const magnitude = Math.sqrt(x ** 2 + y ** 2 + z ** 2);

            // Log every 1 second (approx) or on movement
            if (magnitude > 1.5) {
                console.log(`Movement: ${magnitude.toFixed(2)}g`);
            } else if (Math.random() > 0.90) {
                console.log(`Monitoring: ${magnitude.toFixed(2)}g`);
            }

            if (magnitude > 3.0) {
                console.log("IMPACT DETECTED!", magnitude.toFixed(2));
            }
        });

        setSubscription(sub);
        setIsMonitoring(true);
    };

    const stopMonitoring = async () => {
        console.log("Stopping monitoring...");

        if (subscription) {
            subscription.remove();
            setSubscription(null);
        }

        // Force cleanup of any active listeners
        Accelerometer.removeAllListeners();

        setIsMonitoring(false);
        console.log("Monitoring stopped.");
    };

    return (
        <SensorContext.Provider value={{ isMonitoring, startMonitoring, stopMonitoring }}>
            {children}
        </SensorContext.Provider>
    );
};