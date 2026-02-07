import React, { createContext, useRef, useState } from "react";
import { accelerometer, gyroscope, SensorTypes, setUpdateIntervalForType } from "react-native-sensors";
import { Audio } from "expo-av";
import BackgroundService from "react-native-background-actions";
import { initCsv, appendSummaryRow, getUserFile } from "../services/sensor_csv";
import * as Sharing from "expo-sharing";
import { handleSensorEvent, startNewSession } from "../services/sensor_logger_wrapper";

export const SensorContext = createContext({
    isMonitoring: false,
    startMonitoring: async () => { },
    stopMonitoring: async () => { },
    pauseMicMetering: async () => { },
    resumeMicMetering: async () => { },
});

export const SensorProvider = ({ children }: { children: React.ReactNode }) => {
    const [isMonitoring, setIsMonitoring] = useState(false);

    const accSubRef = useRef<any>(null);
    const gyroSubRef = useRef<any>(null);
    const micRecordingRef = useRef<Audio.Recording | null>(null);

    let sessionEndTime: number | null = null;

    const requestAudioPermission = async () => {
        const { status } = await Audio.requestPermissionsAsync();
        return status === "granted";
    };

    const startMicMetering = async () => {
        if (micRecordingRef.current) return;

        const { recording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.LOW_QUALITY,
            (status) => {
                if (status.metering !== undefined) {
                    handleSensorEvent({ sensor: "microphone", metering: status.metering });
                }
            }
        );

        micRecordingRef.current = recording;
    };

    const stopMicMetering = async () => {
        if (!micRecordingRef.current) return;
        try {
            await micRecordingRef.current.stopAndUnloadAsync();
        } catch { }
        micRecordingRef.current = null;
    };

    const backgroundTask = async () => {
        // Accelerometer
        setUpdateIntervalForType(SensorTypes.accelerometer, 300);

        let accScale: number | null = null;

        accSubRef.current = accelerometer.subscribe(({ x, y, z }) => {
            const rawMag = Math.sqrt(x * x + y * y + z * z);

            if (accScale == null) {
                accScale = rawMag > 5 ? 9.80665 : 1;
                console.log(`[ACCEL] Unit inferred: ${accScale === 1 ? "g" : "m/s²"} (rawMag=${rawMag.toFixed(3)})`);
            }

            const totalMagG = rawMag / (accScale || 1);
            handleSensorEvent({ sensor: "accelerometer", magnitude: totalMagG });
        });

        // Gyroscope
        setUpdateIntervalForType(SensorTypes.gyroscope, 300);
        gyroSubRef.current = gyroscope.subscribe(({ x, y, z }) => {
            const omega = Math.sqrt(x * x + y * y + z * z);
            handleSensorEvent({ sensor: "gyroscope", x, y, z, omega, rotationSpeed: omega });
        });

        // Microphone metering
        await startMicMetering();

        while (BackgroundService.isRunning()) {
            await new Promise((res) => setTimeout(res, 1000));
        }
    };

    const options = {
        taskName: "SensorMonitoring",
        taskTitle: "Sensors Running",
        taskDesc: "Monitoring accelerometer, gyroscope, and microphone",
        taskIcon: { name: "ic_launcher", type: "mipmap" },
        color: "#FF00FF",
        parameters: {},
        foregroundServiceType: ["microphone", "dataSync"],
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

        await stopMicMetering();

        await BackgroundService.stop();
        sessionEndTime = Date.now();

        await appendSummaryRow(sessionEndTime);

        setIsMonitoring(false);

        try {
            if (await Sharing.isAvailableAsync()) {
                const userFile = await getUserFile();
                await Sharing.shareAsync(userFile, {
                    mimeType: "text/csv",
                    dialogTitle: "Share sensor CSV",
                });
            } else {
                console.log("Sharing not available on this device");
            }
        } catch (err) {
            console.error("Failed to share CSV", err);
        }
    };

    return (
        <SensorContext.Provider
            value={{
                isMonitoring,
                startMonitoring,
                stopMonitoring,
                pauseMicMetering: stopMicMetering,
                resumeMicMetering: startMicMetering,
            }}
        >
            {children}
        </SensorContext.Provider>
    );
};
