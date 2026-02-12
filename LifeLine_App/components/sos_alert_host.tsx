import React, { useCallback, useEffect, useRef, useState } from "react";
import SosAlertCallScreen from "@/components/sos_alert";
import { incidentManager, ActiveIncident } from "@/lib/services/incident_manager";
import { useSosMedia } from "@/lib/services/sos_media_provider";
import { useWS } from "@/lib/context/ws_context";

export default function SosAlertHost() {
    const [incident, setIncident] = useState<ActiveIncident | null>(incidentManager.getActive());
    const { triggerSOSCapture } = useSosMedia();
    const { sos } = useWS();

    // prevent double-trigger (tap + auto-answer, or rapid taps)
    const isSendingRef = useRef(false);

    useEffect(() => {
        incidentManager.hydrateFromStorage().catch(() => { });
        const unsub = incidentManager.subscribe((inc) => setIncident(inc));
        return unsub;
    }, []);

    const onAnswer = useCallback(async () => {
        if (isSendingRef.current) return;
        isSendingRef.current = true;

        console.log("[SOS_ALERT_HOST] Answer pressed / auto-answer fired");
        await incidentManager.clearIncident().catch(() => { });
        const capturePromise = triggerSOSCapture();
        const sosPromise = sos();
        const [sosResult, captureResult] = await Promise.allSettled([sosPromise, capturePromise]);
        if (sosResult.status === "rejected") {
            console.log("[SOS_ALERT_HOST] SOS failed:", sosResult.reason);
        }
        if (captureResult.status === "rejected") {
            console.log("[SOS_ALERT_HOST] Media capture/upload enqueue failed:", captureResult.reason);
        }
        isSendingRef.current = false;
    }, [triggerSOSCapture, sos]);
    const onDecline = useCallback(async () => {
        try {
            console.log("[SOS_ALERT_HOST] Decline pressed");
            await incidentManager.snoozeActive();
            await incidentManager.clearIncident();
        } catch (e) {
            console.log("[SOS_ALERT_HOST] onDecline failed:", e);
        }
    }, []);

    return (
        <SosAlertCallScreen
            visible={!!incident}
            callerName="Emergency"
            autoAnswerAfterMs={10_000}
            onAnswer={onAnswer}
            onDecline={onDecline}
        />
    );
}
