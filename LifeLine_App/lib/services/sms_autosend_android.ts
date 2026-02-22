import { NativeModules, DeviceEventEmitter, Platform, PermissionsAndroid } from "react-native";
import type { EmitterSubscription } from "react-native";

const { SmsSender } = NativeModules;

export type SmsQueuedResult = {
    incidentId: string;
    queued: string[];
    failed: { phone: string; error: string }[];
};

export async function ensureSendSmsPermission(): Promise<boolean> {
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

export async function sendSmsNowAndroid(
    recipients: string[],
    message: string,
    incidentId: string
): Promise<SmsQueuedResult> {
    if (Platform.OS !== "android") throw new Error("Android only.");
    if (!SmsSender?.sendSmsNow) throw new Error("SmsSender native module not linked.");

    return SmsSender.sendSmsNow(recipients, message, incidentId);
}

export function subscribeSmsEvents(opts: {
    onSent?: (e: { phone: string; incidentId: string; resultCode: number }) => void;
    onDelivered?: (e: { phone: string; incidentId: string; resultCode: number }) => void;
}) {
    if (Platform.OS !== "android" || !SmsSender) return { remove: () => { } };

    // Native side emits via DeviceEventManagerModule.RCTDeviceEventEmitter.
    // The correct JS listener is DeviceEventEmitter (global), NOT NativeEventEmitter(SmsSender).
    const subs: EmitterSubscription[] = [];

    if (opts.onSent) subs.push(DeviceEventEmitter.addListener("lifeline:smsSent", opts.onSent));
    if (opts.onDelivered)
        subs.push(DeviceEventEmitter.addListener("lifeline:smsDelivered", opts.onDelivered));

    return {
        remove: () => subs.forEach((s) => s.remove()),
    };
}