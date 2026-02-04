import React, { useState, useEffect, useContext } from "react";
import { Image, Text, TouchableOpacity, View, Switch, Alert } from "react-native";
import ScreenWrapper from "../../components/screen_wrapper";
import { SensorContext } from "@/lib/context/sensor_context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { logout } from "../../lib/api/auth";
import { getUser } from "../../lib/api/storage/user";
import { resetWSForAuthSwitch } from "@/lib/services/websocket";

const MenuPage = () => {
    const { stopMonitoring } = useContext(SensorContext);
    const router = useRouter();
    const [darkMode, setDarkMode] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const loadUser = async () => {
            const storedUser = await getUser();
            setUser(storedUser);
        };

        loadUser();
    }, []);

    const handleLogout = async () => {
        try {
            // Stop any sensors/foreground work first
            await stopMonitoring();

            // Hard reset WS state BEFORE clearing auth so no cached rooms leak
            resetWSForAuthSwitch();

            // Clears SecureStore token/user inside logout() finally block
            await logout();

            router.replace("/(auth)/login");
        } catch (err) {
            console.error("Logout failed:", err);
            Alert.alert("Logout failed", "Please try again.");
        }
    };

    return (
        <ScreenWrapper>
            {/* User Info */}
            <View className="flex-row items-center px-6 py-4 border-b border-gray-200">
                <Image
                    source={require("../../assets/images/user_placeholder.png")}
                    className="w-12 h-12 rounded-full"
                />
                <View className="ml-4">
                    <Text className="text-base font-semibold">{user?.name ?? "User"}</Text>
                </View>
            </View>

            {/* Menu Items */}
            <View className="px-6 py-4 flex-1">
                <TouchableOpacity
                    className="py-3 border-b border-gray-200"
                    onPress={() => router.push("/(main)/settings_page")}
                >
                    <Text className="text-base">Settings</Text>
                </TouchableOpacity>

                <View className="flex-row justify-between items-center py-3 border-b border-gray-200">
                    <Text className="text-base">Dark Mode</Text>
                    <Switch value={darkMode} onValueChange={setDarkMode} />
                </View>
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
