import React, { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    ActivityIndicator,
    LayoutAnimation,
    Platform,
    Image,
    Text,
    TouchableOpacity,
    UIManager,
    View,
    ViewStyle,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import ScreenWrapper from "../../components/screen_wrapper";
import { useWS, type LiveLocation } from "@/lib/context/ws_context";
import { getContacts, type Contact } from "@/lib/api/contact";
import { getAvatarSvgFromStoredValue } from "@/lib/avatars";

const isRemoteUrl = (v: string) => /^https?:\/\//i.test(v);

const DEFAULT_REGION: Region = {
    latitude: 15.0794,
    longitude: 120.62,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

type AddressInfo = {
    label: string;
    raw?: Location.LocationGeocodedAddress;
};

type LiveMarker = {
    id: string;
    userName?: string;
    visiblePhone?: string;
    latitude: number;
    longitude: number;
    timestamp?: string;
    accuracy?: number;
    sos?: boolean;
};

type ContactStatus = "monitoring" | "offline";

type ContactRow = {
    contact: Contact;
    status: ContactStatus;
    lastUpdatedMs?: number;
    live?: LiveMarker | null;
};

const OFFLINE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Camera tuning
const FOCUS_ZOOM = 16;
const FOCUS_ANIM_MS = 420;
const FOLLOW_ANIM_MS = 380;
const FOLLOW_THROTTLE_MS = 350;
const FOCUS_RETRY_COUNT = 8;
const FOCUS_RETRY_DELAY_MS = 120;

const ContactAvatar = ({ image }: { image: string | null }) => {
    const AvatarSvg = getAvatarSvgFromStoredValue(image);

    return (
        <View className="w-10 h-10 rounded-full mr-3 overflow-hidden bg-gray-200 items-center justify-center">
            {AvatarSvg ? (
                <AvatarSvg width={40} height={40} />
            ) : image && isRemoteUrl(image) ? (
                <Image source={{ uri: image }} className="w-10 h-10 rounded-full" />
            ) : (
                <Image
                    source={require("../../assets/images/user_placeholder.png")}
                    className="w-10 h-10 rounded-full"
                />
            )}
        </View>
    );
};

function formatAddress(a: Location.LocationGeocodedAddress | undefined) {
    if (!a) return "";
    const parts = [
        a.name,
        a.street,
        a.district,
        a.subregion,
        a.city,
        a.region,
        a.postalCode,
        a.country,
    ].filter(Boolean);

    const deduped: string[] = [];
    for (const p of parts) {
        const s = String(p).trim();
        if (!s) continue;
        if (!deduped.includes(s)) deduped.push(s);
    }
    return deduped.join(", ");
}

function parseTimestampMs(ts?: string): number | undefined {
    if (!ts) return undefined;
    const ms = Date.parse(ts);
    return Number.isFinite(ms) ? ms : undefined;
}

function normalizeDigits(v?: string | null) {
    return String(v ?? "").replace(/\D+/g, "");
}

function matchContactToLive(
    contact: Contact,
    liveLocations: Record<string, LiveLocation>
): LiveLocation | null {
    const phoneDigits = normalizeDigits(contact.phone_no);
    const last4 = phoneDigits.slice(-4);

    const lives = Object.values(liveLocations ?? {});
    if (!lives.length) return null;

    for (const l of lives) {
        const idDigits = normalizeDigits(l.id);
        const visDigits = normalizeDigits(l.visiblePhone);
        if (phoneDigits && (phoneDigits === idDigits || phoneDigits === visDigits)) return l;
    }

    if (last4) {
        const candidates = lives.filter((l) => {
            const idDigits = normalizeDigits(l.id);
            const visDigits = normalizeDigits(l.visiblePhone);
            return idDigits.endsWith(last4) || visDigits.endsWith(last4);
        });
        if (candidates.length === 1) return candidates[0];
        if (candidates.length > 1) {
            const byName = candidates.find(
                (l) => (l.userName ?? "").toLowerCase() === contact.name.toLowerCase()
            );
            if (byName) return byName;
            return candidates[0];
        }
    }

    const name = contact.name.trim().toLowerCase();
    if (name) {
        const candidates = lives.filter((l) => (l.userName ?? "").trim().toLowerCase() === name);
        if (candidates.length === 1) return candidates[0];
    }

    return null;
}

function pickMarkerFromLive(live: LiveLocation): LiveMarker | null {
    const lat = Number(live.latitude);
    const lng = Number(live.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
        id: String(live.id ?? ""),
        userName: typeof live.userName === "string" ? live.userName : undefined,
        visiblePhone: typeof live.visiblePhone === "string" ? live.visiblePhone : undefined,
        latitude: lat,
        longitude: lng,
        timestamp: typeof live.timestamp === "string" ? live.timestamp : undefined,
        accuracy: typeof live.accuracy === "number" ? live.accuracy : undefined,
        sos: live.sos === true,
    };
}

function statusLabel(s: ContactStatus) {
    return s === "monitoring" ? "Monitoring" : "Offline";
}

function statusColor(s: ContactStatus) {
    return s === "monitoring" ? "#16a34a" : "#9ca3af"; // green / gray
}

function statusPillStyle(s: ContactStatus): ViewStyle {
    return s === "monitoring" ? { backgroundColor: "#16a34a" } : { backgroundColor: "#9ca3af" };
}

const formatLastSeen = (lastUpdatedMs?: number) => {
    if (!lastUpdatedMs) return "";
    return new Date(lastUpdatedMs).toLocaleString();
};

const LargeContactAvatar = memo(function LargeContactAvatar({ image }: { image: string | null }) {
    const AvatarSvg = getAvatarSvgFromStoredValue(image);

    return (
        <View className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 items-center justify-center">
            {AvatarSvg ? (
                <AvatarSvg width={64} height={64} />
            ) : image && isRemoteUrl(image) ? (
                <Image source={{ uri: image }} className="w-16 h-16 rounded-full" />
            ) : (
                <Image
                    source={require("../../assets/images/user_placeholder.png")}
                    className="w-16 h-16 rounded-full"
                />
            )}
        </View>
    );
});

const ContactCard = memo(function ContactCard({
    row,
    onPress,
}: {
    row: ContactRow;
    onPress: (id: string) => void;
}) {
    const c = statusColor(row.status);

    return (
        <TouchableOpacity
            onPress={() => onPress(row.contact.id)}
            activeOpacity={0.85}
            className="rounded-2xl border border-gray-200 px-3 py-3"
        >
            <View className="flex-row items-center">
                <View className="relative">
                    <ContactAvatar image={row.contact.image ?? null} />
                    {/* status dot */}
                    <View
                        style={{
                            position: "absolute",
                            right: 4,
                            bottom: 4,
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: c,
                            borderWidth: 2,
                            borderColor: "white",
                        }}
                    />
                </View>

                <View className="flex-1">
                    <Text className="text-base text-black" numberOfLines={1}>
                        {row.contact.name}
                    </Text>
                    <Text style={{ marginTop: 2, fontSize: 12, color: c, fontWeight: "700" }} numberOfLines={1}>
                        {statusLabel(row.status)}
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </View>
        </TouchableOpacity>
    );
});

const GroupSection = memo(function GroupSection({
    title,
    rows,
    onSelect,
}: {
    title: string;
    rows: ContactRow[];
    onSelect: (id: string) => void;
}) {
    if (!rows.length) return null;

    return (
        <View className="mb-4">
            <Text className="mb-2 text-sm font-bold text-gray-900">{title}</Text>
            <View className="gap-2">
                {rows.map((r) => (
                    <ContactCard key={r.contact.id} row={r} onPress={onSelect} />
                ))}
            </View>
        </View>
    );
});

const DetailPanel = memo(function DetailPanel({
    row,
    addressLabel,
    onClose,
}: {
    row: ContactRow;
    addressLabel: string;
    onClose: () => void;
}) {
    const contact = row.contact;
    const marker = row.live;

    return (
        <View className="rounded-2xl bg-white border border-gray-200 px-4 py-4">
            <View className="flex-row items-start">
                <LargeContactAvatar image={contact.image ?? null} />

                <View className="ml-3 flex-1">
                    <Text className="text-lg font-bold text-black" numberOfLines={2}>
                        {contact.name}
                    </Text>
                    <Text className="mt-0.5 text-sm text-gray-700" numberOfLines={1}>
                        {contact.phone_no || ""}
                    </Text>

                    <View className="mt-2 self-start rounded-full px-3 py-1" style={statusPillStyle(row.status)}>
                        <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
                            {statusLabel(row.status)}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity onPress={onClose} className="pl-2">
                    <Ionicons name="close" size={22} color="#111827" />
                </TouchableOpacity>
            </View>

            <View className="mt-4 gap-3">
                <View>
                    <Text className="text-xs font-bold text-gray-900">Last seen</Text>
                    <Text className="mt-1 text-xs text-gray-700">
                        {row.lastUpdatedMs ? formatLastSeen(row.lastUpdatedMs) : "—"}
                    </Text>
                </View>

                <View>
                    <Text className="text-xs font-bold text-gray-900">Address</Text>
                    <Text className="mt-1 text-xs text-gray-700">{addressLabel || "—"}</Text>
                </View>

                <View className="flex-row gap-4">
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-900">Latitude / Longitude</Text>
                        <Text className="mt-1 text-xs text-gray-700">
                            {marker ? `${marker.latitude.toFixed(6)}, ${marker.longitude.toFixed(6)}` : "—"}
                        </Text>
                    </View>

                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-900">Last updated</Text>
                        <Text className="mt-1 text-xs text-gray-700">
                            {marker?.timestamp
                                ? marker.timestamp
                                : row.lastUpdatedMs
                                    ? formatLastSeen(row.lastUpdatedMs)
                                    : "—"}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
});

const LiveTrackingView = memo(function LiveTrackingView(props: {
    initialRegion: Region;
    mapRef: React.MutableRefObject<MapView | null>;
    markers: LiveMarker[];
    selectedMarkerId: string | null;
    selectedAddress: AddressInfo | null;
    isLocating: boolean;
    contactRows: ContactRow[];
    selectedContactId: string | null;
    onSelectContact: (contactId: string) => void;
    onClearSelection: () => void;
    isRefreshingContacts: boolean;
    onRefreshContacts: () => void;
}) {
    const {
        initialRegion,
        mapRef,
        markers,
        selectedMarkerId,
        selectedAddress,
        isLocating,
        contactRows,
        selectedContactId,
        onSelectContact,
        onClearSelection,
        isRefreshingContacts,
        onRefreshContacts,
    } = props;

    const mutualRows = useMemo(() => contactRows.filter((r) => r.contact.role === "mutual"), [contactRows]);
    const dependentRows = useMemo(
        () => contactRows.filter((r) => r.contact.role === "dependent"),
        [contactRows]
    );

    const selectedRow = useMemo(
        () => (selectedContactId ? contactRows.find((r) => r.contact.id === selectedContactId) ?? null : null),
        [contactRows, selectedContactId]
    );

    return (
        <ScreenWrapper scrollable={false} showBottomNav={true}>
            <View className="flex-1 bg-white">
                <View className="px-4 pt-4">
                    <View className="rounded-2xl overflow-hidden border border-gray-200 bg-white" style={{ height: 400 }}>
                        {/* IMPORTANT: Uncontrolled map (no region prop) -> animations are reliable */}
                        <MapView
                            ref={(r) => {
                                mapRef.current = r;
                            }}
                            style={{ flex: 1 }}
                            initialRegion={initialRegion}
                            showsUserLocation
                            showsMyLocationButton
                            followsUserLocation={false}
                        >
                            {markers.map((loc) => {
                                const isSelected = selectedMarkerId && selectedMarkerId === loc.id;
                                const pinColor = loc.sos ? "red" : isSelected ? "#E11D48" : undefined;

                                return (
                                    <Marker
                                        key={loc.id}
                                        coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                                        title={loc.userName || loc.visiblePhone || loc.id}
                                        description={loc.timestamp ? `Updated: ${loc.timestamp}` : undefined}
                                        pinColor={pinColor}
                                    />
                                );
                            })}
                        </MapView>

                        {isLocating && (
                            <View className="absolute left-3 top-3 flex-row items-center rounded-full bg-white/90 px-3 py-2">
                                <ActivityIndicator />
                                <Text className="ml-2 text-xs text-gray-700">Locating…</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View className="px-4 pt-4 flex-1">
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-base font-bold text-black">Live Tracking</Text>
                        {!selectedContactId ? (
                            <TouchableOpacity
                                onPress={onRefreshContacts}
                                disabled={isRefreshingContacts}
                                className="flex-row items-center"
                            >
                                <Ionicons name="refresh" size={18} color="#111827" />
                                <Text className="ml-1 text-sm text-black">
                                    {isRefreshingContacts ? "Refreshing…" : "Refresh"}
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {selectedRow ? (
                        <DetailPanel
                            row={selectedRow}
                            addressLabel={selectedAddress?.label ?? ""}
                            onClose={onClearSelection}
                        />
                    ) : (
                        <View>
                            <GroupSection title="Mutual" rows={mutualRows} onSelect={onSelectContact} />
                            <GroupSection title="Dependent" rows={dependentRows} onSelect={onSelectContact} />
                        </View>
                    )}
                </View>
            </View>
        </ScreenWrapper>
    );
});

const LiveTrackingScreen: React.FC = () => {
    const { liveLocations } = useWS();

    const mapRef = useRef<MapView | null>(null);
    const mapReadyRef = useRef(false);

    // UI-only selection state
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [selectedAddress, setSelectedAddress] = useState<AddressInfo | null>(null);

    // Contacts
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactsLoading, setContactsLoading] = useState<boolean>(false);

    // Initial region
    const [initialRegion, setInitialRegion] = useState<Region>(DEFAULT_REGION);
    const [isLocating, setIsLocating] = useState<boolean>(true);

    // Enable LayoutAnimation on Android
    useEffect(() => {
        if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    const loadContacts = useCallback(async () => {
        setContactsLoading(true);
        try {
            const all = await getContacts();
            const emergency = (all ?? []).filter((c) => c.type === "emergency");
            setContacts(emergency);
        } catch {
            setContacts([]);
        } finally {
            setContactsLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadContacts();
        }, [loadContacts])
    );

    // Markers for ALL current live senders (unchanged)
    const markers: LiveMarker[] = useMemo(() => {
        const lives = Object.values(liveLocations ?? {});
        const list: LiveMarker[] = [];
        for (const l of lives) {
            const m = pickMarkerFromLive(l);
            if (m) list.push(m);
        }
        return list;
    }, [liveLocations]);

    // Status + rows (unchanged)
    const contactRows: ContactRow[] = useMemo(() => {
        const now = Date.now();

        return (contacts ?? []).map((c) => {
            const matched = matchContactToLive(c, liveLocations);
            if (!matched) {
                return { contact: c, status: "offline", live: null };
            }

            const marker = pickMarkerFromLive(matched);
            const tsMs = parseTimestampMs(matched.timestamp) ?? now;
            const isMonitoring = now - tsMs <= OFFLINE_TIMEOUT_MS;

            return {
                contact: c,
                status: isMonitoring ? "monitoring" : "offline",
                lastUpdatedMs: tsMs,
                live: marker,
            };
        });
    }, [contacts, liveLocations]);

    // Latest rows ref for deterministic focusing (no coupling)
    const contactRowsRef = useRef<ContactRow[]>([]);
    useEffect(() => {
        contactRowsRef.current = contactRows;
    }, [contactRows]);

    const selectedRow: ContactRow | null = useMemo(() => {
        if (!selectedContactId) return null;
        return contactRows.find((r) => r.contact.id === selectedContactId) ?? null;
    }, [contactRows, selectedContactId]);

    const selectedMarker = selectedRow?.live ?? null;

    // Initial region positioning (unchanged, but writes initialRegion once)
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                setIsLocating(true);
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") {
                    if (!cancelled) setIsLocating(false);
                    return;
                }

                const pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                if (cancelled) return;

                const next: Region = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                };

                setInitialRegion(next);

                // If map is already mounted, do an initial animate too
                requestAnimationFrame(() => {
                    mapRef.current?.animateToRegion(next, 450);
                });
            } catch {
                // Keep DEFAULT_REGION
            } finally {
                if (!cancelled) setIsLocating(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // ---------- Camera control (UI-only) ----------

    const lastAnimAtRef = useRef(0);
    const lastFollowKeyRef = useRef<string>("");

    const animateTo = useCallback((lat: number, lng: number, duration: number) => {
        const now = Date.now();
        if (now - lastAnimAtRef.current < 120) return; // tiny guard against same-tick spam
        lastAnimAtRef.current = now;

        // Prefer animateCamera (zoom), fallback animateToRegion
        try {
            mapRef.current?.animateCamera(
                { center: { latitude: lat, longitude: lng }, zoom: FOCUS_ZOOM },
                { duration }
            );
        } catch {
            mapRef.current?.animateToRegion(
                { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
                duration
            );
        }
    }, []);

    const focusOnContact = useCallback(
        (contactId: string) => {
            let attempts = 0;

            const tryFocus = () => {
                attempts += 1;

                const row = contactRowsRef.current.find((r) => r.contact.id === contactId);
                const m = row?.live ?? null;

                // If map not ready yet or coords missing, retry briefly
                if (!mapRef.current || !m || !Number.isFinite(m.latitude) || !Number.isFinite(m.longitude)) {
                    if (attempts < FOCUS_RETRY_COUNT) {
                        setTimeout(tryFocus, FOCUS_RETRY_DELAY_MS);
                    }
                    return;
                }

                // Always animate, even if same coords / same selection
                requestAnimationFrame(() => {
                    animateTo(m.latitude, m.longitude, FOCUS_ANIM_MS);
                });
            };

            tryFocus();
        },
        [animateTo]
    );

    // Click handler: deterministic focus first, then open panel
    const handleSelectContact = useCallback(
        (contactId: string) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

            // 1) Always focus deterministically (works even if already selected)
            focusOnContact(contactId);

            // 2) Then open panel (selection is UI only)
            setSelectedContactId(contactId);
        },
        [focusOnContact]
    );

    const handleClearSelection = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedContactId(null);
        setSelectedAddress(null);
        // follow mode stops naturally because selectedContactId becomes null
        lastFollowKeyRef.current = "";
    }, []);

    // ---------- Follow mode ----------
    // Follow ONLY while a contact is selected and we have live coords.
    // Throttled + avoids duplicate animations for same coordinate tick.
    useEffect(() => {
        if (!selectedContactId) return; // follow stops when panel closed
        if (!selectedMarker) return;

        const key = `${selectedMarker.id}:${selectedMarker.latitude.toFixed(6)}:${selectedMarker.longitude.toFixed(6)}`;
        if (key === lastFollowKeyRef.current) return;
        lastFollowKeyRef.current = key;

        const now = Date.now();
        if (now - lastAnimAtRef.current < FOLLOW_THROTTLE_MS) return;

        requestAnimationFrame(() => {
            animateTo(selectedMarker.latitude, selectedMarker.longitude, FOLLOW_ANIM_MS);
        });
    }, [
        selectedContactId,
        selectedMarker?.id,
        selectedMarker?.latitude,
        selectedMarker?.longitude,
        animateTo,
        selectedMarker,
    ]);

    // Reverse geocode selected marker (unchanged)
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!selectedMarker) {
                setSelectedAddress(null);
                return;
            }

            try {
                const res = await Location.reverseGeocodeAsync({
                    latitude: selectedMarker.latitude,
                    longitude: selectedMarker.longitude,
                });

                if (cancelled) return;
                const first = res?.[0];
                const label = formatAddress(first);

                setSelectedAddress(label ? { label, raw: first } : null);
            } catch {
                if (!cancelled) setSelectedAddress(null);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [selectedMarker?.id, selectedMarker?.latitude, selectedMarker?.longitude]);

    return (
        <LiveTrackingView
            initialRegion={initialRegion}
            mapRef={mapRef}
            markers={markers}
            selectedMarkerId={selectedMarker?.id ?? null}
            selectedAddress={selectedAddress}
            isLocating={isLocating}
            contactRows={contactRows}
            selectedContactId={selectedContactId}
            onSelectContact={handleSelectContact}
            onClearSelection={handleClearSelection}
            isRefreshingContacts={contactsLoading}
            onRefreshContacts={loadContacts}
        />
    );
};

export default LiveTrackingScreen;