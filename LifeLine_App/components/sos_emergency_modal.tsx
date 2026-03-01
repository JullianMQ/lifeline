import React, { memo, useMemo } from "react";
import { Image, Modal, Pressable, SafeAreaView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAvatarSvgFromStoredValue } from "@/lib/avatars";

const isRemoteUrl = (v: string) => /^https?:\/\//i.test(v);

type Props = {
    visible: boolean;
    contactName: string;
    phoneNumber?: string;
    timestampLabel?: string;
    image?: string | null;
    onView: () => void;
    onDismiss: () => void;
    onClose: () => void;
};

const SosModalAvatar = memo(function SosModalAvatar({
    image,
    name,
    size = 44,
}: {
    image?: string | null;
    name: string;
    size?: number;
}) {
    const AvatarSvg = useMemo(() => getAvatarSvgFromStoredValue(image ?? null), [image]);
    const initial = (name?.trim()?.[0] ?? "C").toUpperCase();

    const innerSize = Math.round(size * 0.78);

    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: "#E11D48",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}
        >
            {AvatarSvg ? (
                <AvatarSvg width={innerSize} height={innerSize} />
            ) : image && isRemoteUrl(image) ? (
                <Image
                    source={{ uri: image }}
                    style={{ width: size, height: size, borderRadius: size / 2 }}
                    resizeMode="cover"
                />
            ) : (
                <Text style={{ color: "white", fontWeight: "800", fontSize: Math.round(size * 0.5) }}>
                    {initial}
                </Text>
            )}
        </View>
    );
});

export default function SosEmergencyModal({
    visible,
    contactName,
    phoneNumber,
    timestampLabel,
    image,
    onView,
    onDismiss,
    onClose,
}: Props) {
    if (!visible) return null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                onPress={onClose}
                style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    justifyContent: "center",
                    padding: 20,
                }}
            >
                <Pressable
                    onPress={() => { }}
                    style={{
                        borderRadius: 16,
                        overflow: "hidden",
                        backgroundColor: "white",
                    }}
                >
                    {/* Red header */}
                    <View
                        style={{
                            backgroundColor: "#DC2626",
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                        }}
                    >
                        <Ionicons name="warning" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>Emergency Alert</Text>

                        <Pressable
                            onPress={onClose}
                            style={{ position: "absolute", right: 10, top: 10, padding: 6 }}
                            hitSlop={10}
                        >
                            <Ionicons name="close" size={18} color="white" />
                        </Pressable>
                    </View>

                    {/* Body */}
                    <SafeAreaView>
                        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                            <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827" }}>
                                SOS Triggered by:
                            </Text>

                            {/* Card with left red accent */}
                            <View
                                style={{
                                    marginTop: 10,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: "#E5E7EB",
                                    overflow: "hidden",
                                    flexDirection: "row",
                                }}
                            >
                                <View style={{ width: 6, backgroundColor: "#DC2626" }} />
                                <View style={{ flex: 1, padding: 12 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <SosModalAvatar image={image ?? null} name={contactName} size={44} />

                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
                                                {contactName}
                                            </Text>

                                            {!!phoneNumber && (
                                                <Text style={{ marginTop: 2, fontSize: 12, color: "#6B7280" }}>
                                                    {phoneNumber}
                                                </Text>
                                            )}

                                            {!!timestampLabel && (
                                                <Text style={{ marginTop: 2, fontSize: 12, color: "#6B7280" }}>
                                                    {timestampLabel}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Right action buttons */}
                                        <View style={{ alignItems: "flex-end" }}>
                                            <Pressable
                                                onPress={onView}
                                                style={{
                                                    backgroundColor: "#DC2626",
                                                    paddingVertical: 8,
                                                    paddingHorizontal: 14,
                                                    borderRadius: 10,
                                                    minWidth: 92,
                                                    alignItems: "center",
                                                }}
                                            >
                                                <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>View</Text>
                                            </Pressable>

                                            <Pressable
                                                onPress={onDismiss}
                                                style={{
                                                    marginTop: 10,
                                                    borderWidth: 2,
                                                    borderColor: "#DC2626",
                                                    paddingVertical: 7,
                                                    paddingHorizontal: 14,
                                                    borderRadius: 10,
                                                    minWidth: 92,
                                                    alignItems: "center",
                                                }}
                                            >
                                                <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 13 }}>Dismiss</Text>
                                            </Pressable>
                                        </View>
                                    </View>

                                    <Text style={{ marginTop: 10, fontSize: 13, color: "#374151" }}>
                                        This contact has triggered an emergency SOS. Please respond immediately.
                                    </Text>
                                </View>
                            </View>

                            {/* Close button */}
                            <Pressable
                                onPress={onClose}
                                style={{
                                    marginTop: 14,
                                    backgroundColor: "#374151",
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    alignItems: "center",
                                }}
                            >
                                <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>Close</Text>
                            </Pressable>
                        </View>
                    </SafeAreaView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
