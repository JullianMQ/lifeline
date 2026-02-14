import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    Modal,
    FlatList,
    Pressable,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import ScreenWrapper from "../../components/screen_wrapper";
import { Ionicons } from "@expo/vector-icons";
import { getUser } from "../../lib/api/storage/user";
import { updateMyProfile } from "../../lib/api/contact";

import {
    AVATAR_KEYS,
    avatarValueFromKey,
    getAvatarSvgFromStoredValue,
} from "@/lib/avatars";

const splitName = (full: string) => {
    const cleaned = String(full || "").trim();
    if (!cleaned) return { first: "", last: "" };
    const parts = cleaned.split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
};

const joinName = (first: string, last: string) => {
    return `${String(first || "").trim()} ${String(last || "").trim()}`.trim();
};

const isRemoteUrl = (v: string) => /^https?:\/\//i.test(v);

const ProfilePage = () => {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [avatar, setAvatar] = useState<string | null>(null);

    // Avatar modal state
    const [openAvatar, setOpenAvatar] = useState(false);
    const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);

    const loadFromStorage = useCallback(async () => {
        const local = await getUser();
        if (!local) return;

        const { first, last } = splitName(local.name);
        setFirstName(first);
        setLastName(last);
        setPhone(local.phone_no ?? "");
        setAvatar(local.image ?? null);
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            (async () => {
                try {
                    await loadFromStorage();
                } finally {
                    setLoading(false);
                }
            })();
        }, [loadFromStorage])
    );

    const handleChangePhoto = () => {
        setPendingAvatar(avatar ?? avatarValueFromKey(AVATAR_KEYS[0]));
        setOpenAvatar(true);
    };

    const handleConfirmAvatar = async () => {
        if (!pendingAvatar) {
            setOpenAvatar(false);
            return;
        }

        try {
            setSaving(true);

            // Save same stored value as web: "/avatars/alien.svg"
            await updateMyProfile({ image: pendingAvatar });

            setAvatar(pendingAvatar);
            setOpenAvatar(false);
        } catch (err: any) {
            Alert.alert("Update Failed", err.message || "Failed to update avatar");
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        const name = joinName(firstName, lastName);
        if (!name) return Alert.alert("Validation", "Name is required.");

        try {
            setSaving(true);

            await updateMyProfile({
                name,
                phone_no: phone.trim() ? phone.trim() : undefined,
            });

            Alert.alert("Success", "Profile updated.");
            router.back();
        } catch (err: any) {
            Alert.alert("Update Failed", err.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const AvatarSvg = getAvatarSvgFromStoredValue(avatar);

    return (
        <ScreenWrapper
            showBottomNav={false}
            topNavProps={{ backButtonOnly: true, onBackPress: () => router.back() }}
            scrollable={false}
        >
            <View className="flex-1 pt-12 items-center">
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" />
                        <Text className="mt-3">Loading...</Text>
                    </View>
                ) : (
                    <>
                        <View className="w-28 h-28 rounded-full bg-gray-200 items-center justify-center mb-6 overflow-hidden">
                            {AvatarSvg ? (
                                <AvatarSvg width={112} height={112} />
                            ) : avatar && isRemoteUrl(avatar) ? (
                                <Image source={{ uri: avatar }} className="w-28 h-28 rounded-full" />
                            ) : (
                                <Image
                                    source={require("../../assets/images/user_placeholder.png")}
                                    className="w-28 h-28 rounded-full"
                                />
                            )}
                        </View>

                        <TouchableOpacity onPress={handleChangePhoto} className="flex-row items-center mb-6">
                            <Ionicons name="cloud-upload-outline" size={24} color="black" />
                            <Text className="ml-2 font-semibold">Change Photo</Text>
                        </TouchableOpacity>

                        <View className="w-3/4">
                            <TextInput
                                placeholder="First name"
                                value={firstName}
                                onChangeText={setFirstName}
                                className="border-2 border-black rounded-full px-4 py-3 mb-4"
                            />
                            <TextInput
                                placeholder="Last name"
                                value={lastName}
                                onChangeText={setLastName}
                                className="border-2 border-black rounded-full px-4 py-3 mb-4"
                            />
                            <TextInput
                                placeholder="Phone number"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                className="border-2 border-black rounded-full px-4 py-3 mb-4"
                            />
                        </View>

                        <View className="flex-1 justify-end w-3/4 mb-10">
                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={saving}
                                className={`py-4 rounded-full items-center ${saving ? "bg-gray-400" : "bg-lifelineRed"
                                    }`}
                            >
                                <Text className="text-white text-lg font-semibold">
                                    {saving ? "Saving..." : "Save"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Avatar Picker Modal */}
                        <Modal
                            visible={openAvatar}
                            transparent
                            animationType="fade"
                            onRequestClose={() => setOpenAvatar(false)}
                        >
                            <View className="flex-1 bg-black/50 justify-center px-6">
                                <Pressable className="absolute inset-0" onPress={() => setOpenAvatar(false)} />

                                <View className="bg-white rounded-2xl p-4">
                                    <View className="flex-row items-center justify-between mb-3">
                                        <Text className="text-base font-semibold">Select Avatar</Text>
                                        <TouchableOpacity onPress={() => setOpenAvatar(false)}>
                                            <Ionicons name="close" size={22} color="black" />
                                        </TouchableOpacity>
                                    </View>

                                    <FlatList
                                        data={AVATAR_KEYS}
                                        keyExtractor={(k) => k}
                                        numColumns={5}
                                        renderItem={({ item: key }) => {
                                            const storedValue = avatarValueFromKey(key);
                                            const selected = pendingAvatar === storedValue;
                                            const SvgComp = getAvatarSvgFromStoredValue(storedValue);

                                            return (
                                                <TouchableOpacity
                                                    onPress={() => setPendingAvatar(storedValue)}
                                                    className={`m-2 w-14 h-14 rounded-full overflow-hidden items-center justify-center border ${selected ? "border-black" : "border-gray-200"
                                                        }`}
                                                >
                                                    {SvgComp ? <SvgComp width={56} height={56} /> : null}
                                                </TouchableOpacity>
                                            );
                                        }}
                                    />

                                    <TouchableOpacity
                                        onPress={handleConfirmAvatar}
                                        disabled={saving}
                                        className={`mt-2 py-3 rounded-xl items-center ${saving ? "bg-gray-300" : "bg-lifelineRed"
                                            }`}
                                    >
                                        <Text className="text-white font-semibold">
                                            {saving ? "Saving..." : "Confirm"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Modal>
                    </>
                )}
            </View>
        </ScreenWrapper>
    );
};

export default ProfilePage;
