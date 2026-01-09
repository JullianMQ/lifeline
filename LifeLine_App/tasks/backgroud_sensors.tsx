import * as TaskManager from 'expo-task-manager';

export const SENSOR_TASK_NAME = 'ACCELEROMETER_MONITORING';

TaskManager.defineTask(SENSOR_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error("Background Task Error:", error);
        return;
    }

    if (data) {
        const { accelerations } = data as {
            accelerations: Array<{ x: number; y: number; z: number; timestamp: number }>
        };

        accelerations.forEach((sample) => {
            const { x, y, z } = sample;

            // Calculate Magnitude (G-force)
            const magnitude = Math.sqrt(x ** 2 + y ** 2 + z ** 2);

            // HEARTBEAT LOG: 
            // If the terminal keeps scrolling with this, your background logic is working!
            console.log(`[BACKGROUND] 🔋 Heartbeat: ${magnitude.toFixed(2)}g`);

            // ANOMALY LOG: Triggers only on high impact
            if (magnitude > 3.0) {
                console.log("🚨 ANOMALY DETECTED!");
                console.log(`Force: ${magnitude.toFixed(2)}g | X: ${x.toFixed(2)} Y: ${y.toFixed(2)} Z: ${z.toFixed(2)}`);

                // Future: triggerNotification() or startSOSCountdown()
            }
        });
    }
});