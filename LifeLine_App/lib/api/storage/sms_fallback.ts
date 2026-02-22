import AsyncStorage from "@react-native-async-storage/async-storage";

// SMS fallback is “where enabled” per the academic paper.
// This module provides:
// - a deployment/user toggle (enabled/disabled)
// - idempotency guards (prevent duplicate sends per incident)
// - a small persistent audit log for thesis defensibility
// - a pending-queue item used when fallback is triggered in background

const KEY_SMS_ENABLED = "settings_sms_fallback_enabled_v1";
const KEY_SMS_ATTEMPTED_PREFIX = "sms_fallback_attempted_v1:"; // + incidentId
const KEY_SMS_TRIGGERED_PREFIX = "sms_fallback_triggered_v1:"; // + incidentId
const KEY_SMS_PENDING = "sms_fallback_pending_v1";
const KEY_SMS_LOG = "sms_fallback_log_v1";

export type PendingSms = {
    incidentId: string;
    message: string;
    recipients: string[];
    createdAt: number;
};

export type SmsFallbackLogEntry = {
    t: number;
    incidentId: string;
    event:
    | "PRIMARY_SENT"
    | "PRIMARY_CONFIRMED"
    | "PRIMARY_TIMEOUT"
    | "SMS_TRIGGERED"
    | "SMS_AUTO_SEND_STARTED"
    | "SMS_AUTO_SEND_QUEUED"
    | "SMS_AUTO_SEND_FAILED"
    | "SMS_SENT_RESULT"
    | "SMS_DELIVERED_RESULT"
    | "SMS_COMPOSER_OPENED" // legacy/manual path
    | "SMS_SKIPPED_DISABLED"
    | "SMS_SKIPPED_NO_RECIPIENTS"
    | "SMS_ALREADY_ATTEMPTED"
    | "SMS_DEFERRED_BACKGROUND";
    meta?: any;
};

export async function getSmsFallbackEnabled(): Promise<boolean> {
    try {
        const raw = await AsyncStorage.getItem(KEY_SMS_ENABLED);
        // Default: enabled (deployment-level choice). Can be turned off.
        if (raw === null) return true;
        return raw === "1";
    } catch {
        return true;
    }
}

export async function setSmsFallbackEnabled(enabled: boolean) {
    try {
        await AsyncStorage.setItem(KEY_SMS_ENABLED, enabled ? "1" : "0");
    } catch {
        // ignore
    }
}

export async function wasSmsTriggered(incidentId: string): Promise<boolean> {
    try {
        const raw = await AsyncStorage.getItem(KEY_SMS_TRIGGERED_PREFIX + incidentId);
        return raw === "1";
    } catch {
        return false;
    }
}

export async function markSmsTriggered(incidentId: string) {
    try {
        await AsyncStorage.setItem(KEY_SMS_TRIGGERED_PREFIX + incidentId, "1");
    } catch {
        // ignore
    }
}

export async function wasSmsAttempted(incidentId: string): Promise<boolean> {
    try {
        const raw = await AsyncStorage.getItem(KEY_SMS_ATTEMPTED_PREFIX + incidentId);
        return raw === "1";
    } catch {
        return false;
    }
}

export async function markSmsAttempted(incidentId: string) {
    try {
        await AsyncStorage.setItem(KEY_SMS_ATTEMPTED_PREFIX + incidentId, "1");
    } catch {
        // ignore
    }
}

export async function setPendingSms(p: PendingSms) {
    try {
        await AsyncStorage.setItem(KEY_SMS_PENDING, JSON.stringify(p));
    } catch {
        // ignore
    }
}

export async function peekPendingSms(): Promise<PendingSms | null> {
    try {
        const raw = await AsyncStorage.getItem(KEY_SMS_PENDING);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.incidentId || !parsed?.message || !Array.isArray(parsed?.recipients)) return null;
        return parsed as PendingSms;
    } catch {
        return null;
    }
}

export async function popPendingSms(): Promise<PendingSms | null> {
    const p = await peekPendingSms();
    try {
        await AsyncStorage.removeItem(KEY_SMS_PENDING);
    } catch {
        // ignore
    }
    return p;
}

export async function appendSmsFallbackLog(entry: SmsFallbackLogEntry) {
    try {
        const raw = await AsyncStorage.getItem(KEY_SMS_LOG);
        const arr = raw ? (JSON.parse(raw) as SmsFallbackLogEntry[]) : [];
        const next = [entry, ...(Array.isArray(arr) ? arr : [])].slice(0, 50);
        await AsyncStorage.setItem(KEY_SMS_LOG, JSON.stringify(next));
    } catch {
        // ignore
    }
}