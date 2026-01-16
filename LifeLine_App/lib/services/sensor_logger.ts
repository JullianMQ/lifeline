export type SensorLogEvent = {
    sensor: 'accelerometer' | 'gyroscope' | 'microphone';
    timestamp: number;

    x?: number;
    y?: number;
    z?: number;

    magnitude?: number;
    rotationSpeed?: number;
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
        const accelValues = this.logs
            .filter(l => l.magnitude !== undefined)
            .map(l => l.magnitude!);
        const gyroValues = this.logs
            .filter(l => l.rotationSpeed !== undefined)
            .map(l => l.rotationSpeed!);
        const micValues = this.logs
            .filter(l => l.metering !== undefined)
            .map(l => l.metering!);

        return {
            maxAccel: accelValues.length ? Math.max(...accelValues) : null,
            minAccel: accelValues.length ? Math.min(...accelValues) : null,
            maxGyro: gyroValues.length ? Math.max(...gyroValues) : null,
            minGyro: gyroValues.length ? Math.min(...gyroValues) : null,
            maxMic: micValues.length ? Math.max(...micValues) : null,
            minMic: micValues.length ? Math.min(...micValues) : null,
        };
    }

}

export const sensorLogger = new SensorLogger();
