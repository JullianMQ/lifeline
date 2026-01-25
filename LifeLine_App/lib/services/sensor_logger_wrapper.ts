import { sensorLogger } from '../services/sensor_logger';
import { emergencyDetector } from './emergency_detector';
import { incidentManager } from './incident_manager';

let sessionId = Date.now();

export const startNewSession = () => {
    sessionId = Date.now();
    sensorLogger.clear();
    emergencyDetector.reset();
    incidentManager.reset();
};

export const handleSensorEvent = async (event: any) => {
    const now = Date.now();

    const fullEvent = {
        ...event,
        sessionId,
        timestamp: now,
    };

    sensorLogger.log(fullEvent);

    const detectorEvents = emergencyDetector.push(fullEvent);

    // ---- Live raw logs ----
    if (event.sensor === 'accelerometer' && event.magnitude !== undefined) {
        console.log(`Accel (total): ${event.magnitude.toFixed(2)} g`);
    }

    if (event.sensor === 'gyroscope') {
        const omega =
            typeof event.omega === 'number'
                ? event.omega
                : (typeof event.rotationSpeed === 'number' ? event.rotationSpeed : undefined);

        if (omega !== undefined) {
            console.log(`Gyro ω: ${omega.toFixed(2)} rad/s`);
        }
    }

    if (event.sensor === 'microphone' && event.metering !== undefined) {
        console.log(`Mic: ${event.metering.toFixed(2)} dBFS`);
    }

    // ---- Detector logs + incident forwarding ----
    for (const d of detectorEvents) {
        sensorLogger.log({
            ...d,
            sessionId,
            timestamp: d.timestamp,
        } as any);

        // ✅ Adapt detector event shape to incident manager input
        try {
            await incidentManager.onDetectorEvent({
                type: d.eventType,
                t: d.timestamp,
                data: d.meta,
            });
        } catch (e) {
            console.warn('[INCIDENT] onDetectorEvent failed', e);
        }

        const meta = d.meta ? ` ${JSON.stringify(d.meta)}` : '';
        console.log(`>> ${d.eventType}${meta}`);
    }
};
