import React, { createContext, useState } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';

export const SensorContext = createContext({
    isMonitoring: false,
    startMonitoring: async () => { },
    stopMonitoring: async () => { },
});

export const SensorProvider = ({ children }: { children: React.ReactNode }) => {
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);

    const startMonitoring = async () => {
        if (isMonitoring) return;

        console.log("Starting Foreground Monitoring...");

        const { status: accStatus } = await Accelerometer.requestPermissionsAsync();
        const { status: gyroStatus } = await Gyroscope.requestPermissionsAsync();
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        const { status: micStatus } = await Audio.requestPermissionsAsync();

        if (accStatus !== 'granted' || gyroStatus !== 'granted' || micStatus !== 'granted') {
            alert("Accelerometer, Gyroscope and Microphone permissions are required.");
            return;
        }

        // ACCELEROMETER SETUP 
        Accelerometer.setUpdateInterval(300);
        const accSub = Accelerometer.addListener(data => {
            const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
            if (magnitude > 1.5) {
                console.log(`Movement: ${magnitude.toFixed(2)}g`);
            } else if (Math.random() > 0.90) {
                console.log(`Monitoring: ${magnitude.toFixed(2)}g`);
            }

            if (magnitude > 3.0) {
                console.log("IMPACT DETECTED!", magnitude.toFixed(2));
            }
        });

        // GYROSCOPE SETUP 
        Gyroscope.setUpdateInterval(300);
        const gyroSub = Gyroscope.addListener(gyroData => {
            const { x, y, z } = gyroData;
            const rotationSpeed = Math.abs(x) + Math.abs(y) + Math.abs(z);
            if (rotationSpeed > 2.0) {
                console.log(`Rotation detected: ${rotationSpeed.toFixed(2)} rad/s`);
            }
        });

        // MICROPHONE SETUP
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
        });


        const { recording: newRecording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.LOW_QUALITY,
            (status: Audio.RecordingStatus) => {
                if (status.metering !== undefined) {
                    const volume = status.metering;
                    if (volume > -10) {
                        console.log("LOUD NOISE DETECTED!", volume.toFixed(2), "dB");
                    }
                }
            },
            300
        );

        setRecording(newRecording);
        setSubscriptions([accSub, gyroSub]);
        setIsMonitoring(true);
    };

    const stopMonitoring = async () => {
        console.log("Stopping monitoring...");

        subscriptions.forEach(sub => sub && sub.remove());

        if (recording) {
            await recording.stopAndUnloadAsync();
            setRecording(null);
        }

        Accelerometer.removeAllListeners();
        Gyroscope.removeAllListeners();

        setSubscriptions([]);
        setIsMonitoring(false);
        console.log("Monitoring stopped.");
    };

    return (
        <SensorContext.Provider value={{ isMonitoring, startMonitoring, stopMonitoring }}>
            {children}
        </SensorContext.Provider>
    );
};