import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "expo-router";

import SosEmergencyModal from "@/components/sos_emergency_modal";
import { useWS, type LiveLocation } from "@/lib/context/ws_context";
import { getContacts, type Contact } from "@/lib/api/contact";
import { useSosViewIntent } from "@/lib/context/sos_view_intent";

// Persist previous SOS state across navigation/unmount (within the same app session)
const SOS_PREV_BY_CONTACT_ID: Record<string, boolean> = Object.create(null);

function normalizeDigits(v?: string | null) {
    return String(v ?? "").replace(/\D+/g, "");
}

/**
 * Match contact to a live location payload.
 * This mirrors the matching strategy used in live_tracking.tsx
 * but lives here to keep the SOS modal global and UI-only.
 */
function matchContactToLive(contact: Contact, liveLocations: Record<string, LiveLocation>): LiveLocation | null {
    const phoneDigits = normalizeDigits(contact.phone_no);
    const last4 = phoneDigits.slice(-4);

    const lives = Object.values(liveLocations ?? {});
    if (!lives.length) return null;

    // 1) Exact digit match (id/visiblePhone)
    for (const l of lives) {
        const idDigits = normalizeDigits(l.id);
        const visDigits = normalizeDigits(l.visiblePhone);
        if (phoneDigits && (phoneDigits === idDigits || phoneDigits === visDigits)) return l;
    }

    // 2) Last-4 match (masked visiblePhone)
    if (last4) {
        const candidates = lives.filter((l) => {
            const idDigits = normalizeDigits(l.id);
            const visDigits = normalizeDigits(l.visiblePhone);
            return idDigits.endsWith(last4) || visDigits.endsWith(last4);
        });
        if (candidates.length === 1) return candidates[0];
        if (candidates.length > 1) {
            const byName = candidates.find((l) => (l.userName ?? "").toLowerCase() === contact.name.toLowerCase());
            if (byName) return byName;
            return candidates[0];
        }
    }

    // 3) Name fallback (only if unique)
    const name = contact.name.trim().toLowerCase();
    if (name) {
        const candidates = lives.filter((l) => (l.userName ?? "").trim().toLowerCase() === name);
        if (candidates.length === 1) return candidates[0];
    }

    return null;
}

function formatTimestampLabel(ts?: string) {
    if (!ts) return undefined;
    // Keep it minimal: pass through ISO or readable strings without parsing assumptions.
    return ts;
}

type SosAlertPayload = {
    contactId: string;
    contactName: string;
    phoneNumber?: string;
    image?: string | null;
    timestampLabel?: string;
};

export default function SosEmergencyModalHost() {
    const router = useRouter();
    const { liveLocations } = useWS();
    const { setPendingViewContactId } = useSosViewIntent();

    const [contacts, setContacts] = useState<Contact[]>([]);
    const [alert, setAlert] = useState<SosAlertPayload | null>(null);

    // Load emergency contacts once (UI-only; no tracking/listener changes)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const all = await getContacts();
                const emergency = (all ?? []).filter((c) => c.type === "emergency");
                if (!cancelled) setContacts(emergency);
            } catch {
                if (!cancelled) setContacts([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Transition detection: false -> true only, per contactId
    useEffect(() => {
        if (!contacts.length) return;

        // If modal already visible, don't open a second one.
        if (alert) {
            // Still update baseline states so returning later doesn't re-trigger.
            for (const c of contacts) {
                const live = matchContactToLive(c, liveLocations);
                const next = live?.sos === true;
                const prev = SOS_PREV_BY_CONTACT_ID[c.id];
                if (prev === undefined) SOS_PREV_BY_CONTACT_ID[c.id] = next;
                else SOS_PREV_BY_CONTACT_ID[c.id] = next;
            }
            return;
        }

        for (const c of contacts) {
            const live = matchContactToLive(c, liveLocations);
            const next = live?.sos === true;

            const prev = SOS_PREV_BY_CONTACT_ID[c.id];

            // Baseline init: never treat "true on first sight" as a new event
            if (prev === undefined) {
                SOS_PREV_BY_CONTACT_ID[c.id] = next;
                continue;
            }

            // Event trigger: false -> true
            if (prev === false && next === true) {
                setAlert({
                    contactId: c.id,
                    contactName: c.name,
                    phoneNumber: c.phone_no,
                    image: c.image ?? null,
                    timestampLabel: formatTimestampLabel(live?.timestamp),
                });
                // Update prev immediately to avoid re-triggering while modal is open
                SOS_PREV_BY_CONTACT_ID[c.id] = true;
                break;
            }

            SOS_PREV_BY_CONTACT_ID[c.id] = next;
        }
    }, [contacts, liveLocations, alert]);

    const onDismiss = useCallback(() => {
        if (!alert) return;
        setAlert(null);
    }, [alert]);

    const onClose = useCallback(() => {
        if (!alert) return;
        setAlert(null);
    }, [alert]);

    const onView = useCallback(() => {
        if (!alert) return;
        const contactId = alert.contactId;

        // Set UI intent only (no selection/camera changes here)
        setPendingViewContactId(contactId);

        // Close modal
        setAlert(null);

        // Navigate to live tracking screen (no stack hacks; standard navigation)
        router.push("/(main)/live_tracking");
    }, [alert, router, setPendingViewContactId]);

    return (
        <SosEmergencyModal
            visible={!!alert}
            contactName={alert?.contactName ?? "Contact"}
            phoneNumber={alert?.phoneNumber}
            timestampLabel={alert?.timestampLabel}
            image={alert?.image ?? null}
            onView={onView}
            onDismiss={onDismiss}
            onClose={onClose}
        />
    );
}
