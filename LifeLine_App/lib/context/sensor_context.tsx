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

    const requestAudioPermission = async () => {
        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
    };

    const backgroundTask = async () => {
        let gravity = { x: 0, y: 0, z: 0 };
        const ALPHA = 0.8;

        // Accelerometer
        setUpdateIntervalForType(SensorTypes.accelerometer, 300);
        accSubRef.current = accelerometer.subscribe(({ x, y, z }) => {
            gravity.x = ALPHA * gravity.x + (1 - ALPHA) * x;
            gravity.y = ALPHA * gravity.y + (1 - ALPHA) * y;
            gravity.z = ALPHA * gravity.z + (1 - ALPHA) * z;

            const linearX = x - gravity.x;
            const linearY = y - gravity.y;
            const linearZ = z - gravity.z;

            const linearMagnitude = Math.sqrt(linearX ** 2 + linearY ** 2 + linearZ ** 2);

            handleSensorEvent({ sensor: 'accelerometer', magnitude: linearMagnitude });
        });

        // Gyroscope
        setUpdateIntervalForType(SensorTypes.gyroscope, 300);
        gyroSubRef.current = gyroscope.subscribe(({ x, y, z }) => {
            const rotationSpeed = Math.abs(x) + Math.abs(y) + Math.abs(z);
            handleSensorEvent({ sensor: 'gyroscope', x, y, z, rotationSpeed });
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
        setIsMonitoring(true);
        await BackgroundService.start(backgroundTask, options);
    };

    const stopMonitoring = async () => {
        accSubRef.current?.unsubscribe();
        gyroSubRef.current?.unsubscribe();

        if (micRecordingRef.current) {
            await micRecordingRef.current.stopAndUnloadAsync();
            micRecordingRef.current = null;
        }

        await BackgroundService.stop();

        // Append summary with user info
        await appendSummaryRow();

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
