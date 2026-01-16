import { sensorLogger } from '../services/sensor_logger';

let sessionId = Date.now();

export const startNewSession = () => {
    sessionId = Date.now();
    sensorLogger.clear();
};

export const handleSensorEvent = async (event: any) => {
    const fullEvent = {
        ...event,
        sessionId,
        timestamp: Date.now(),
    };

    // CSV logging
    sensorLogger.log(fullEvent);

    // Live logging
    if (event.sensor === 'accelerometer' && event.magnitude !== undefined) {
        console.log(`Accel net: ${event.magnitude.toFixed(2)}g`);
        if (event.magnitude > 40) console.log('>> IMPACT DETECTED!');
    }

    if (event.sensor === 'gyroscope' && event.rotationSpeed !== undefined) {
        console.log(`Gyro: ${event.rotationSpeed.toFixed(2)} rad/s`);
        if (event.rotationSpeed > 2) console.log('>> ROTATION THRESHOLD!');
    }

    if (event.sensor === 'microphone' && event.metering !== undefined) {
        console.log(`Mic: ${event.metering.toFixed(2)} dBFS`);
        if (event.metering > -10) console.log('>> LOUD NOISE!');
    }
};
