import * as FileSystem from 'expo-file-system/legacy';
import { sensorLogger } from './sensor_logger';

const DIR = FileSystem.documentDirectory + 'sensors/';
export const FILE = DIR + 'session.csv';

let initialized = false;

const CSV_HEADER = 'sensor,x,y,z,magnitude,rotationSpeed,metering\n';

export async function initCsv() {
    if (initialized) return;

    const dirInfo = await FileSystem.getInfoAsync(DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    }

    const fileInfo = await FileSystem.getInfoAsync(FILE);
    if (!fileInfo.exists) {
        await FileSystem.writeAsStringAsync(FILE, CSV_HEADER);
    }

    initialized = true;
}

/**
 * Call this at the end of monitoring to write only MAX/MIN summary
 */
export async function appendSummaryRow() {
    if (!initialized) return;

    const stats = sensorLogger.getStats();

    const formatAccel = (v: number | null | undefined) => (v != null ? v.toFixed(2) + 'g' : '');
    const formatGyro = (v: number | null | undefined) => (v != null ? v.toFixed(2) + ' rad/s' : '');
    const formatMic = (v: number | null | undefined) => (v != null ? v.toFixed(2) + ' dBFS' : '');

    const summaryRow = [
        'MAX', '', '', '',
        formatAccel(stats.maxAccel),
        formatGyro(stats.maxGyro),
        formatMic(stats.maxMic),
    ].join(',') + '\n';

    const minRow = [
        'MIN', '', '', '',
        formatAccel(stats.minAccel),
        formatGyro(stats.minGyro),
        formatMic(stats.minMic),
    ].join(',') + '\n';

    try {
        await FileSystem.writeAsStringAsync(FILE, summaryRow + minRow, { append: true } as any);
    } catch (err) {
        console.error('Failed to write summary row', err);
    }
}
