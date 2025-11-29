import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SCREEN_TITLES } from "./titles";

export type AppRoutes =
    | "/home_page"
    | "/contact_page"
    | "/faqs_page"
    | "/menu_page"
    | "/profile_page"
    | "/notif_page";

const TopNav: React.FC = () => {
    const pathname = usePathname();
    const router = useRouter();
    const title = SCREEN_TITLES[pathname as AppRoutes] || "LIFELINE";


    const navItems: { icon: string; route: AppRoutes }[] = [
        { icon: "notifications-outline", route: "/notif_page" },
        { icon: "person-circle-outline", route: "/profile_page" },

    ];

    return (
        <SafeAreaView className="bg-lifelineRed">
            <View className="flex-row items-center justify-between px-4 py-2 bg-lifelineRed">
                {/* Left */}
                <Text className="text-3xl font-bold text-white">{title}</Text>

                {/* Right  */}
                <View className="flex-row items-center space-x-3">
                    {navItems.map((item) => (
                        <TouchableOpacity
                            key={item.route}
                            onPress={() => router.push(item.route)}
                        >
                            <Ionicons name={item.icon as any} size={35} color="white" />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </SafeAreaView>
    );
};

export default TopNav;
