import { AppState, Linking, NativeModules, PermissionsAndroid, Platform, DeviceEventEmitter } from "react-native";
import notifee, { AndroidImportance } from "@notifee/react-native";

import { getCachedEmergencyPhoneNumbers } from "@/lib/api/storage/contacts_cache";
import {
    appendSmsFallbackLog,
    getSmsFallbackEnabled,
    markSmsAttempted,
    markSmsTriggered,
    popPendingSms,
    setPendingSms,
    wasSmsAttempted,
    type PendingSms,
} from "@/lib/api/storage/sms_fallback";

export type SmsFallbackPayload = {
    incidentId: string;
    status: string;
    lastKnownLocation: string;
    timestampIso?: string;
};

const CHANNEL_ID = "sos_sms_fallback";

// ====== Auto-send mode (capstone demo) ======
// For your demo APK, we enable auto-send by default.
// If you want a toggle later, replace this with AsyncStorage/profile setting.
async function isAutoSendEnabled() {
    return true;
}

function buildSmsMessage(p: SmsFallbackPayload) {
    const ts = p.timestampIso ?? new Date().toISOString();
    // Paper scope: incident status + last-known location only.
    return `LIFELINE ALERT\nStatus: ${p.status}\nTime: ${ts}\nLast known location: ${p.lastKnownLocation}`;
}

async function ensureNotifeeChannel() {
    try {
        await notifee.createChannel({
            id: CHANNEL_ID,
            name: "SOS SMS Fallback",
            importance: AndroidImportance.HIGH,
        });
    } catch {
        // ignore
    }
}

// ====== Legacy manual composer (kept as UX fallback only) ======
// NOTE: This ALWAYS shows UI and is NOT reliable for multi-recipient on all OEMs.
async function openSmsComposerViaIntent(recipients: string[], message: string) {
    const to = recipients.join(",");
    const url = `sms:${encodeURIComponent(to)}?body=${encodeURIComponent(message)}`;
    await Linking.openURL(url);
    return { result: "unknown" as const };
}

// Kept for possible UX fallback use (not used in auto-send-only path)
export async function openSmsComposer(recipients: string[], message: string) {
    return await openSmsComposerViaIntent(recipients, message);
}

export async function showSmsFallbackNotification(pending: PendingSms) {
    await ensureNotifeeChannel();
    try {
        await notifee.requestPermission();
    } catch {
        // ignore
    }
    await notifee.displayNotification({
        id: "sms_fallback_pending", // stable id prevents duplicates
        title: "Send SMS fallback",
        body: "Emergency delivery failed. Open LifeLine to send SMS to your emergency contacts.",
        data: { incidentId: pending.incidentId },
        android: {
            channelId: CHANNEL_ID,
            importance: AndroidImportance.HIGH,
            pressAction: { id: "open_sms_fallback", launchActivity: "default" },
        },
    });
}

// ====== Native auto-send bridge ======

async function ensureSendSmsPermission(): Promise<boolean> {
    if (Platform.OS !== "android") return false;

    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS, {
        title: "Allow Auto-Send SMS Fallback",
        message:
            "LifeLine can automatically send an emergency SMS to your selected contacts if internet delivery fails.",
        buttonPositive: "Allow",
        buttonNegative: "Deny",
    });

    return granted === PermissionsAndroid.RESULTS.GRANTED;
}

type NativeQueuedResult = {
    incidentId: string;
    queued: string[];
    failed: { phone: string; error: string }[];
};

function startSmsResultLogging(incidentId: string) {
    if (Platform.OS !== "android") return { stop: () => { } };

    // We only care about events for THIS incident.
    const onSent = (e: any) => {
        if (!e || e.incidentId !== incidentId) return;
        appendSmsFallbackLog({
            t: Date.now(),
            incidentId,
            event: "SMS_SENT_RESULT",
            meta: { phone: e.phone, resultCode: e.resultCode },
        }).catch(() => { });
    };

    const onDelivered = (e: any) => {
        if (!e || e.incidentId !== incidentId) return;
        appendSmsFallbackLog({
            t: Date.now(),
            incidentId,
            event: "SMS_DELIVERED_RESULT",
            meta: { phone: e.phone, resultCode: e.resultCode },
        }).catch(() => { });
    };

    const subSent = DeviceEventEmitter.addListener("lifeline:smsSent", onSent);
    const subDelivered = DeviceEventEmitter.addListener("lifeline:smsDelivered", onDelivered);

    // Auto-stop to avoid leaking subscriptions.
    const timeoutId = setTimeout(() => {
        try {
            subSent.remove();
            subDelivered.remove();
        } catch {
            // ignore
        }
    }, 60_000);

    return {
        stop: () => {
            try {
                clearTimeout(timeoutId);
            } catch {
                // ignore
            }
            try {
                subSent.remove();
                subDelivered.remove();
            } catch {
                // ignore
            }
        },
    };
}

async function tryAutoSendSmsAndroid(recipients: string[], message: string, incidentId: string) {
    if (Platform.OS !== "android") return { ok: false as const, reason: "not_android" as const };

    const enabled = await isAutoSendEnabled();
    if (!enabled) return { ok: false as const, reason: "autosend_disabled" as const };

    const SmsSender = (NativeModules as any)?.SmsSender;
    if (!SmsSender?.sendSmsNow) {
        return { ok: false as const, reason: "native_module_missing" as const };
    }

    const permOk = await ensureSendSmsPermission();
    if (!permOk) return { ok: false as const, reason: "permission_denied" as const };

    try {
        const res: NativeQueuedResult = await SmsSender.sendSmsNow(recipients, message, incidentId);
        return { ok: true as const, native: res };
    } catch (e: any) {
        return { ok: false as const, reason: "send_failed" as const, error: e?.message ?? String(e) };
    }
}

/**
 * Sends a PendingSms created while the app was backgrounded.
 *
 * Why this exists:
 * - If we tried to send while backgrounded, Android may kill the app / block execution.
 * - The notification is the user's explicit action that brings the app to foreground.
 * - Once active, we use SmsManager (native module) to auto-send without opening the composer UI.
 */
export async function resumePendingSmsIfAny() {
    const pending = await popPendingSms();
    if (!pending) return { resumed: false as const };

    // Idempotency guard.
    const already = await wasSmsAttempted(pending.incidentId);
    if (already) {
        await appendSmsFallbackLog({
            t: Date.now(),
            incidentId: pending.incidentId,
            event: "SMS_ALREADY_ATTEMPTED",
            meta: { resumedFrom: "notification" },
        });
        return { resumed: true as const, mode: "already_attempted" as const };
    }

    // Mark attempted BEFORE sending to prevent loops if the app crashes mid-send.
    await markSmsAttempted(pending.incidentId);

    await appendSmsFallbackLog({
        t: Date.now(),
        incidentId: pending.incidentId,
        event: "SMS_AUTO_SEND_STARTED",
        meta: { resumedFrom: "notification", recipientCount: pending.recipients.length },
    });

    const logger = startSmsResultLogging(pending.incidentId);

    const auto = await tryAutoSendSmsAndroid(pending.recipients, pending.message, pending.incidentId);

    if (auto.ok) {
        await appendSmsFallbackLog({
            t: Date.now(),
            incidentId: pending.incidentId,
            event: "SMS_AUTO_SEND_QUEUED",
            meta: { queued: auto.native.queued, failed: auto.native.failed },
        });
        return { resumed: true as const, mode: "auto_sent" as const, queued: auto.native.queued, failed: auto.native.failed };
    }

    await appendSmsFallbackLog({
        t: Date.now(),
        incidentId: pending.incidentId,
        event: "SMS_AUTO_SEND_FAILED",
        meta: { resumedFrom: "notification", reason: auto.reason, error: (auto as any).error },
    });

    logger.stop(); // explicit stop on immediate failure

    // Capstone-safe fallback: do NOT silently open Messages. Keep UI-driven send as an explicit action.
    // Your app can show a screen/button to open composer if you want; here we just report failure.
    return { resumed: true as const, mode: "auto_send_failed" as const, reason: auto.reason };
}

/**
 * Trigger SMS fallback.
 * - Uses cached emergency contacts (works offline)
 * - Idempotent per incidentId
 * - If backgrounded: stores pending SMS + notification (user action required)
 * - If foreground:
 *    - Android: auto-send via SmsManager (no composer UI)
 *    - iOS/other: reports not_android
 */
export async function triggerSmsFallback(payload: SmsFallbackPayload) {
    const enabled = await getSmsFallbackEnabled();
    if (!enabled) {
        await appendSmsFallbackLog({
            t: Date.now(),
            incidentId: payload.incidentId,
            event: "SMS_SKIPPED_DISABLED",
        });
        return { mode: "skipped_disabled" as const };
    }

    // Strong idempotency guard: if we've already attempted SMS for this incident, do nothing.
    const alreadyAttempted = await wasSmsAttempted(payload.incidentId);
    if (alreadyAttempted) {
        await appendSmsFallbackLog({
            t: Date.now(),
            incidentId: payload.incidentId,
            event: "SMS_ALREADY_ATTEMPTED",
        });
        return { mode: "already_attempted" as const };
    }

    const recipients = await getCachedEmergencyPhoneNumbers();
    if (!recipients.length) {
        await appendSmsFallbackLog({
            t: Date.now(),
            incidentId: payload.incidentId,
            event: "SMS_SKIPPED_NO_RECIPIENTS",
        });
        return { mode: "skipped_no_recipients" as const };
    }

    const message = buildSmsMessage(payload);

    await markSmsTriggered(payload.incidentId);
    await appendSmsFallbackLog({
        t: Date.now(),
        incidentId: payload.incidentId,
        event: "SMS_TRIGGERED",
        meta: { recipientCount: recipients.length },
    });

    // If app isn't active, defer to a notification (user action required).
    if (AppState.currentState !== "active") {
        const pending: PendingSms = {
            incidentId: payload.incidentId,
            message,
            recipients,
            createdAt: Date.now(),
        };
        await setPendingSms(pending);
        await appendSmsFallbackLog({
            t: Date.now(),
            incidentId: payload.incidentId,
            event: "SMS_DEFERRED_BACKGROUND",
        });
        await showSmsFallbackNotification(pending);
        return { mode: "deferred_notification" as const };
    }

    // Foreground: mark attempted BEFORE sending (prevents infinite retry loops)
    await markSmsAttempted(payload.incidentId);

    await appendSmsFallbackLog({
        t: Date.now(),
        incidentId: payload.incidentId,
        event: "SMS_AUTO_SEND_STARTED",
        meta: { recipientCount: recipients.length, source: "foreground" },
    });

    const logger = startSmsResultLogging(payload.incidentId);

    const auto = await tryAutoSendSmsAndroid(recipients, message, payload.incidentId);

    if (auto.ok) {
        await appendSmsFallbackLog({
            t: Date.now(),
            incidentId: payload.incidentId,
            event: "SMS_AUTO_SEND_QUEUED",
            meta: { queued: auto.native.queued, failed: auto.native.failed },
        });
        return { mode: "auto_sent" as const, queued: auto.native.queued, failed: auto.native.failed };
    }

    await appendSmsFallbackLog({
        t: Date.now(),
        incidentId: payload.incidentId,
        event: "SMS_AUTO_SEND_FAILED",
        meta: { reason: auto.reason, error: (auto as any).error },
    });

    logger.stop(); // explicit stop on immediate failure

    return { mode: "auto_send_failed" as const, reason: auto.reason };
}