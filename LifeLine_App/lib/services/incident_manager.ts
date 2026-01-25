import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import notifee, { AndroidCategory, AndroidImportance } from '@notifee/react-native';

export type IncidentReason =
    | 'FALL_CONFIRMED'
    | 'CRASH_CONFIRMED'
    | 'EMERGENCY_CONFIRMED'
    | 'LOUD_WITH_MOTION'
    | 'UNKNOWN';

export type ActiveIncident = {
    id: string;
    reason: IncidentReason;
    createdAt: number;
    meta?: any;
    uiShown?: boolean;
    sosSent?: boolean;
    snoozeUntil?: number;
};

const KEY_ACTIVE = 'active_incident_v1';

type Listener = (incident: ActiveIncident | null) => void;

class IncidentManager {
    private listeners = new Set<Listener>();
    private active: ActiveIncident | null = null;

    // tweak these
    private COOLDOWN_MS = 60_000; // 60s: prevent spam
    private SNOOZE_MS = 90_000;   // 90s: decline snooze

    subscribe(fn: Listener) {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
    }


    getActive() {
        return this.active;
    }

    async hydrateFromStorage() {
        const raw = await AsyncStorage.getItem(KEY_ACTIVE);
        if (!raw) {
            this.active = null;
            this.emit(null);
            return;
        }
        try {
            const inc = JSON.parse(raw) as ActiveIncident;
            // if it’s stale, clear it
            if (Date.now() - inc.createdAt > 10 * 60_000) {
                await this.clearIncident();
                return;
            }
            this.active = inc;
            this.emit(inc);
        } catch {
            // ignore
        }
    }

    private emit(inc: ActiveIncident | null) {
        for (const fn of this.listeners) fn(inc);
    }

    private async persist() {
        if (!this.active) return;
        await AsyncStorage.setItem(KEY_ACTIVE, JSON.stringify(this.active));
    }

    async clearIncident() {
        this.active = null;
        await AsyncStorage.removeItem(KEY_ACTIVE);
        this.emit(null);
    }

    async snoozeActive() {
        if (!this.active) return;
        this.active.snoozeUntil = Date.now() + this.SNOOZE_MS;
        await this.persist();
    }

    async markUiShown() {
        if (!this.active) return;
        this.active.uiShown = true;
        await this.persist();
    }

    reset() {
        // Keep listeners, just clear state for a fresh monitoring session
        this.active = null;
        AsyncStorage.removeItem(KEY_ACTIVE).catch(() => { });
        this.emit(null);
    }

    // call this from detector events
    async onDetectorEvent(evt: { type: string; t: number; data?: any }) {
        const now = Date.now();

        // If we already have an active incident, respect snooze/cooldown
        if (this.active) {
            if (this.active.snoozeUntil && now < this.active.snoozeUntil) return;
            if (now - this.active.createdAt < this.COOLDOWN_MS) return;
            // cooldown over → clear and allow new incident
            await this.clearIncident();
        }

        // Only trigger UI on high-confidence “confirmed” events.
        // (You can expand this mapping.)
        let reason: IncidentReason | null = null;
        if (evt.type === 'FALL_CONFIRMED') reason = 'FALL_CONFIRMED';
        if (evt.type === 'CRASH_CONFIRMED') reason = 'CRASH_CONFIRMED';

        // Optional: allow loud + abnormal motion fusion
        // (Example: your detector also emits LOUD_SUSTAINED and ABNORMAL_MOTION)
        // You can add a fusion buffer later.
        if (!reason) return;

        // Create incident
        const incident: ActiveIncident = {
            id: `inc_${now}`,
            reason,
            createdAt: now,
            meta: { ...evt.data, detectorType: evt.type },
        };

        this.active = incident;
        await this.persist();
        this.emit(incident);

        // Bring UI up: in foreground we rely on in-app modal; in background/locked, use full-screen notification
        if (AppState.currentState !== 'active') {
            await this.showIncomingCallNotification(incident);
        }
    }

    private async ensureNotifeeChannel() {
        await notifee.createChannel({
            id: 'sos_calls',
            name: 'SOS Alerts',
            importance: AndroidImportance.HIGH,
        });
    }

    async showIncomingCallNotification(incident: ActiveIncident) {
        await this.ensureNotifeeChannel();

        // Request permission on Android 13+ if needed
        await notifee.requestPermission();

        await notifee.displayNotification({
            id: 'sos_active_incident', // stable id prevents duplicates
            title: incident.reason === 'CRASH_CONFIRMED' ? 'Incoming call' : 'Incoming call',
            body: 'Tap to respond',
            android: {
                channelId: 'sos_calls',
                importance: AndroidImportance.HIGH,
                category: AndroidCategory.CALL,
                fullScreenAction: {
                    id: 'open_sos_call_ui',
                    launchActivity: 'default',
                },
                pressAction: {
                    id: 'open_sos_call_ui',
                    launchActivity: 'default',
                },
                ongoing: true,
                autoCancel: false,
                showTimestamp: false,
            },
        });
    }
}

export const incidentManager = new IncidentManager();
