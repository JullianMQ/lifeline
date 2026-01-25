export type SensorLogEvent = {
    sensor: 'accelerometer' | 'gyroscope' | 'microphone' | 'detector';
    timestamp: number;

    x?: number;
    y?: number;
    z?: number;

    magnitude?: number;
    rotationSpeed?: number;
    omega?: number;
    eventType?: string;
    message?: string;
    meta?: Record<string, any>;
    metering?: number;
    severity?: 'movement' | 'impact' | 'rotation' | 'noise';
    sessionId?: number;
};


class SensorLogger {
    private logs: SensorLogEvent[] = [];

    log(event: SensorLogEvent) {
        this.logs.push(event);
    }

    getLogs() {
        return this.logs;
    }

    clear() {
        this.logs = [];
    }

    getStats() {
        const accelLogs = this.logs.filter(l => l.magnitude !== undefined);
        const gyroLogs = this.logs.filter(l => (l.omega !== undefined || l.rotationSpeed !== undefined));
        const micLogs = this.logs.filter(l => l.metering !== undefined);

        const getMaxMin = (logs: any[], key: string) => {
            if (!logs.length) return { max: null, maxTime: null, min: null, minTime: null };
            let maxLog = logs.reduce((a, b) => (b[key] > a[key] ? b : a));
            let minLog = logs.reduce((a, b) => (b[key] < a[key] ? b : a));
            return { max: maxLog[key], maxTime: maxLog.timestamp, min: minLog[key], minTime: minLog.timestamp };
        };

        const accelStats = getMaxMin(accelLogs, 'magnitude');
        const gyroStats = getMaxMin(gyroLogs, (gyroLogs.some(l => l.omega !== undefined) ? 'omega' : 'rotationSpeed'));
        const micStats = getMaxMin(micLogs, 'metering');

        return {
            maxAccel: accelStats.max,
            maxAccelTime: accelStats.maxTime,
            minAccel: accelStats.min,
            minAccelTime: accelStats.minTime,

            maxGyro: gyroStats.max,
            maxGyroTime: gyroStats.maxTime,
            minGyro: gyroStats.min,
            minGyroTime: gyroStats.minTime,

            maxMic: micStats.max,
            maxMicTime: micStats.maxTime,
            minMic: micStats.min,
            minMicTime: micStats.minTime,
        };
    }

}


export const sensorLogger = new SensorLogger();
