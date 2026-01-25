import React, { createContext, useRef, useState } from 'react';
import {
    accelerometer,
    gyroscope,
    SensorTypes,
    setUpdateIntervalForType,
} from 'react-native-sensors';
import { Audio } from 'expo-av';
import BackgroundService from 'react-native-background-actions';
import { initCsv, appendSummaryRow, getUserFile } from '../services/sensor_csv';
import * as Sharing from 'expo-sharing';
import { handleSensorEvent, startNewSession } from '../services/sensor_logger_wrapper';

export const SensorContext = createContext({
    isMonitoring: false,
    startMonitoring: async () => { },
    stopMonitoring: async () => { },
});

export const SensorProvider = ({ children }: { children: React.ReactNode }) => {
    const [isMonitoring, setIsMonitoring] = useState(false);

    const accSubRef = useRef<any>(null);
    const gyroSubRef = useRef<any>(null);
    const micRecordingRef = useRef<Audio.Recording | null>(null);

    let sessionEndTime: number | null = null;

    const requestAudioPermission = async () => {
        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
    };

    const backgroundTask = async () => {
        // -----------------------------
        // NOTE:
        // We now send ACCEL magnitude as TOTAL magnitude in "g"
        // (includes gravity). At rest on desk this should be ~1.0 g.
        // This avoids gravity-filter / unit issues that caused 6–8g on desk.
        // -----------------------------

        // Accelerometer
        setUpdateIntervalForType(SensorTypes.accelerometer, 300);

        // Unit inference:
        // - If raw magnitude ~9-12 => likely m/s^2 => divide by 9.80665 to get g
        // - If raw magnitude ~0.8-1.2 => likely g => divide by 1
        let accScale: number | null = null; // 1 (already g) or 9.80665 (m/s^2)

        accSubRef.current = accelerometer.subscribe(({ x, y, z }) => {
            const rawMag = Math.sqrt(x * x + y * y + z * z);

            if (accScale == null) {
                accScale = rawMag > 5 ? 9.80665 : 1;
                console.log(
                    `[ACCEL] Unit inferred: ${accScale === 1 ? 'g' : 'm/s²'} (rawMag=${rawMag.toFixed(3)})`
                );
            }

            const totalMagG = rawMag / (accScale || 1);

            // Optional raw debug (uncomment while validating):
            // console.log(`[ACCEL] x=${x.toFixed(3)} y=${y.toFixed(3)} z=${z.toFixed(3)} rawMag=${rawMag.toFixed(3)} => totalMagG=${totalMagG.toFixed(3)}`);

            handleSensorEvent({ sensor: 'accelerometer', magnitude: totalMagG });
        });

        // Gyroscope
        setUpdateIntervalForType(SensorTypes.gyroscope, 300);
        gyroSubRef.current = gyroscope.subscribe(({ x, y, z }) => {
            // Standard resultant angular velocity magnitude (rad/s)
            const omega = Math.sqrt(x * x + y * y + z * z);

            // Keep rotationSpeed for backward compatibility with your logger,
            // but send omega explicitly for the detector.
            handleSensorEvent({ sensor: 'gyroscope', x, y, z, omega, rotationSpeed: omega });
        });

        // Microphone
        const { recording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.LOW_QUALITY,
            status => {
                if (status.metering !== undefined) {
                    handleSensorEvent({ sensor: 'microphone', metering: status.metering });
                }
            }
        );
        micRecordingRef.current = recording;

        // Keep the service alive
        while (BackgroundService.isRunning()) {
            await new Promise(res => setTimeout(res, 1000));
        }
    };

    const options = {
        taskName: 'SensorMonitoring',
        taskTitle: 'Sensors Running',
        taskDesc: 'Monitoring accelerometer, gyroscope, and microphone',
        taskIcon: { name: 'ic_launcher', type: 'mipmap' },
        color: '#FF00FF',
        parameters: {},
        foregroundServiceType: ['microphone', 'dataSync'],
    };

    const startMonitoring = async () => {
        if (isMonitoring) return;

        const audioGranted = await requestAudioPermission();
        if (!audioGranted) return;

        await initCsv(false);
        startNewSession();

        await BackgroundService.start(backgroundTask, options);
        setIsMonitoring(true);
    };

    const stopMonitoring = async () => {
        accSubRef.current?.unsubscribe();
        gyroSubRef.current?.unsubscribe();

        if (micRecordingRef.current) {
            try {
                await micRecordingRef.current.stopAndUnloadAsync();
            } catch {
                // ignore
            }
            micRecordingRef.current = null;
        }

        await BackgroundService.stop();
        sessionEndTime = Date.now();

        // Append summary with user info
        await appendSummaryRow(sessionEndTime);

        setIsMonitoring(false);

        try {
            if (await Sharing.isAvailableAsync()) {
                const userFile = await getUserFile();
                await Sharing.shareAsync(userFile, {
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
