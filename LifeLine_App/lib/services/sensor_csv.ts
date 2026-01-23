import * as FileSystem from 'expo-file-system/legacy';
import { sensorLogger } from './sensor_logger';
import { getUser } from '../api/storage/user';
import * as Crypto from 'expo-crypto';

const DIR = FileSystem.documentDirectory + 'sensors/';

// CSV header with user info
const CSV_HEADER = 'UserID,Sensor,Accelerometer,Gyroscope,Microphone,Timestamp\n';
const SALT = "LifeLine";
const formatTimestamp = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getFullYear()}-${(d.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ` +
        `${d.getHours().toString().padStart(2, '0')}:${d
            .getMinutes()
            .toString()
            .padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
};

// Compute the CSV file path for the current user
export const getUserFile = async () => {
    const user = await getUser();
    let userId = 'unknown';

    if (user?.id) {
        userId = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            `${SALT}${user.id}`
        );
    }
    return DIR + `${userId}_session.csv`;
};

export async function initCsv(reset = false) {
    const userFile = await getUserFile();

    const dirInfo = await FileSystem.getInfoAsync(DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    }

    const fileInfo = await FileSystem.getInfoAsync(userFile);
    if (reset || !fileInfo.exists) {
        await FileSystem.writeAsStringAsync(userFile, CSV_HEADER);
    }
}


// Append HIGHEST and LOWEST summary for current session
export async function appendSummaryRow(endTime?: number) {
    const userFile = await getUserFile();

    const fileInfo = await FileSystem.getInfoAsync(userFile);
    if (!fileInfo.exists) {
        await initCsv(false);
    }

    const userId = userFile.split('/').pop()?.split('_')[0] || 'unknown';
    const sessionTimestamp = formatTimestamp(endTime || Date.now());
    const stats = sensorLogger.getStats();

    const formatAccel = (v?: number | null) => (v != null ? v.toFixed(2) + 'g' : '');
    const formatGyro = (v?: number | null) => (v != null ? v.toFixed(2) + ' rad/s' : '');
    const formatMic = (v?: number | null) => (v != null ? v.toFixed(2) + ' dBFS' : '');

    const summaryRow = [
        userId,
        'HIGHEST',
        formatAccel(stats.maxAccel),
        formatGyro(stats.maxGyro),
        formatMic(stats.maxMic),
        sessionTimestamp,
    ].join(',') + '\n';

    const minRow = [
        userId,
        'LOWEST',
        formatAccel(stats.minAccel),
        formatGyro(stats.minGyro),
        formatMic(stats.minMic),
        sessionTimestamp,
    ].join(',') + '\n';

    try {
        let existing = '';
        try {
            existing = await FileSystem.readAsStringAsync(userFile);
        } catch { }

        await FileSystem.writeAsStringAsync(userFile, existing + summaryRow + minRow);
    } catch (err) {
        console.error('Failed to write summary row', err);
    }
}



// export a helper to share CSV for the current user (for testing)
export async function shareCsv() {
    const userFile = await getUserFile();
    try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(userFile, {
                mimeType: 'text/csv',
                dialogTitle: 'Share your sensor CSV',
            });
        } else {
            console.log('Sharing not available on this device');
        }
    } catch (err) {
        console.error('Failed to share CSV', err);
    }
}
