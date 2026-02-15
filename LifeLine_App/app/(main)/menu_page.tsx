import React, { useState, useCallback, useContext } from "react";
import { Image, Text, TouchableOpacity, View, Alert } from "react-native";
import ScreenWrapper from "../../components/screen_wrapper";
import { SensorContext } from "@/lib/context/sensor_context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { logout } from "../../lib/api/auth";
import { getUser } from "../../lib/api/storage/user";
import { resetWSForAuthSwitch } from "@/lib/services/websocket";

import { getAvatarSvgFromStoredValue } from "@/lib/avatars";

const isRemoteUrl = (v: string) => /^https?:\/\//i.test(v);

const MenuPage = () => {
    const { stopMonitoring } = useContext(SensorContext);
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    const loadUser = useCallback(async () => {
        const storedUser = await getUser();
        setUser(storedUser);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadUser();
        }, [loadUser])
    );

    const handleLogout = async () => {
        try {
            await stopMonitoring();
            resetWSForAuthSwitch();
            await logout();
            router.replace("/(auth)/login");
        } catch (err) {
            console.error("Logout failed:", err);
            Alert.alert("Logout failed", "Please try again.");
        }
    };

    const AvatarSvg = getAvatarSvgFromStoredValue(user?.image);

    return (
        <ScreenWrapper>
            {/* User Info */}
            <View className="flex-row items-center px-6 py-4 border-b border-gray-200">
                <View className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 items-center justify-center">
                    {AvatarSvg ? (
                        <AvatarSvg width={48} height={48} />
                    ) : user?.image && isRemoteUrl(user.image) ? (
                        <Image source={{ uri: user.image }} className="w-12 h-12 rounded-full" />
                    ) : (
                        <Image
                            source={require("../../assets/images/user_placeholder.png")}
                            className="w-12 h-12 rounded-full"
                        />
                    )}
                </View>

                <View className="ml-4">
                    <Text className="text-base font-semibold">{user?.name ?? "User"}</Text>
                </View>
            </View>

            {/* Menu Items */}
            <View className="px-6 py-4 flex-1">
                <TouchableOpacity
                    className="py-3 border-b border-gray-200"
                    onPress={() => router.push("/(main)/profile_page")}
                >
                    <Text className="text-base">Edit Profile</Text>
                </TouchableOpacity>
            </View>

            {/* Logout Button */}
            <View className="px-6 pb-8">
                <TouchableOpacity
                    className="flex-row items-center py-3 border-t border-gray-200"
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={30} />
                    <Text className="ml-3 text-base">Log Out</Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
};

export default MenuPage;
