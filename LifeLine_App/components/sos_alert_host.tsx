import React, { useCallback, useEffect, useState } from "react";
import SosAlertCallScreen from "@/components/sos_alert";
import { incidentManager, ActiveIncident } from "@/lib/services/incident_manager";
import { useSosMedia } from "@/lib/services/sos_media_provider";
import { useWS } from "@/lib/context/ws_context";

export default function SosAlertHost() {
    const [incident, setIncident] = useState<ActiveIncident | null>(incidentManager.getActive());
    const { triggerSOSCapture } = useSosMedia();
    const { sos } = useWS();

    useEffect(() => {

        incidentManager.hydrateFromStorage().catch(() => { });
        const unsub = incidentManager.subscribe((inc) => setIncident(inc));
        return unsub;
    }, []);

    const onAnswer = useCallback(async () => {
        try {
            console.log("[SOS_ALERT_HOST] Answer pressed / auto-answer fired");
            // close UI immediately
            await incidentManager.clearIncident();

            // capture media (this will enqueue + upload via outbox)
            await triggerSOSCapture();

            // send SOS (your current app flow)
            await sos();
        } catch (e) {
            console.log("[SOS_ALERT_HOST] onAnswer failed:", e);
        }
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
