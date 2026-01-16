import React, { createContext, useState } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { Audio } from 'expo-av';
import { EventSubscription } from 'expo-modules-core';
import { sensorLogger } from '../services/sensor_logger';
import { initCsv, FILE, appendSummaryRow } from '../services/sensor_csv';
import * as Sharing from 'expo-sharing';



export const SensorContext = createContext({
    isMonitoring: false,
    startMonitoring: async () => { },
    stopMonitoring: async () => { },
});

export const SensorProvider = ({ children }: { children: React.ReactNode }) => {
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [subscriptions, setSubscriptions] = useState<EventSubscription[]>([]);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);

    const sessionId = Date.now();

    const handleSensorEvent = async (
        event: Parameters<typeof sensorLogger.log>[0]
    ) => {
        const fullEvent = { ...event, sessionId };

        // CSV logging 
        sensorLogger.log(fullEvent);


        // LIVE logging 
        if (event.sensor === 'accelerometer' && event.magnitude !== undefined) {
            console.log(`Accel: ${event.magnitude.toFixed(2)}g`);
            if (event.magnitude > 3.0) console.log(">> IMPACT DETECTED!");
        }
        if (event.sensor === 'gyroscope' && event.rotationSpeed !== undefined) {
            console.log(`Gyro: ${event.rotationSpeed.toFixed(2)} rad/s`);
            if (event.rotationSpeed > 2.0) console.log(">> ROTATION THRESHOLD!");
        }
        if (event.sensor === 'microphone' && event.metering !== undefined) {
            console.log(`Mic: ${event.metering.toFixed(2)} dBFS`);
            if (event.metering > -10) console.log(">> LOUD NOISE!");
        }
    };

    const startMonitoring = async () => {
        if (isMonitoring) return;
        await initCsv(true);

        const { status: accStatus } = await Accelerometer.requestPermissionsAsync();
        const { status: gyroStatus } = await Gyroscope.requestPermissionsAsync();
        const { status: micStatus } = await Audio.requestPermissionsAsync();

        if (accStatus !== 'granted' || gyroStatus !== 'granted' || micStatus !== 'granted') {
            alert("Accelerometer, Gyroscope and Microphone permissions are required.");
            return;
        }

        let activeSubs: EventSubscription[] = [];
        let activeRecording: Audio.Recording | null = null;

        try {
            // ACCELEROMETER
            Accelerometer.setUpdateInterval(300);
            const accSub = Accelerometer.addListener(data => {
                const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
                handleSensorEvent({
                    sensor: 'accelerometer',
                    timestamp: Date.now(),
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    magnitude,
                    severity: magnitude > 3 ? 'impact' : 'movement',
                });
            });
            activeSubs.push(accSub);

            // GYROSCOPE
            Gyroscope.setUpdateInterval(300);
            const gyroSub = Gyroscope.addListener(gyro => {
                const rotationSpeed =
                    Math.abs(gyro.x) + Math.abs(gyro.y) + Math.abs(gyro.z);
                handleSensorEvent({
                    sensor: 'gyroscope',
                    timestamp: Date.now(),
                    x: gyro.x,
                    y: gyro.y,
                    z: gyro.z,
                    rotationSpeed,
                    severity: rotationSpeed > 2 ? 'rotation' : 'movement',
                });
            });
            activeSubs.push(gyroSub);

            // MICROPHONE
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.LOW_QUALITY,
                status => {
                    if (status.metering !== undefined) {
                        handleSensorEvent({
                            sensor: 'microphone',
                            timestamp: Date.now(),
                            metering: status.metering,
                            severity: status.metering > -10 ? 'noise' : 'movement',
                        });
                    }
                },
                300
            );
            activeRecording = newRecording;

            setSubscriptions(activeSubs);
            setRecording(activeRecording);
            setIsMonitoring(true);
        } catch (error) {
            console.error('Setup failed:', error);
            activeSubs.forEach(sub => sub.remove());
            if (activeRecording) await activeRecording.stopAndUnloadAsync().catch(() => { });
            setIsMonitoring(false);
        }
    };

    const stopMonitoring = async () => {
        subscriptions.forEach(sub => sub.remove());
        if (recording) await recording.stopAndUnloadAsync();

        // Append MAX/MIN summary row
        await appendSummaryRow();

        setSubscriptions([]);
        setRecording(null);
        setIsMonitoring(false);

        console.log('Sensor stats:', sensorLogger.getStats());

        try {
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(FILE, {
                    mimeType: 'text/csv',
                    dialogTitle: 'Share sensor CSV',
                });
            } else {
                console.log('Sharing not available on this device');
            }
        } catch (err) {
            console.error('Failed to share CSV', err);
        }
    };


    return (
        <SensorContext.Provider value={{ isMonitoring, startMonitoring, stopMonitoring }}>
            {children}
        </SensorContext.Provider>
    );
};
