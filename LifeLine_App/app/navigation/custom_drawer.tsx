import { Feather, Ionicons } from "@expo/vector-icons";
import { DrawerContentComponentProps, DrawerContentScrollView } from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { removeToken } from "../storage/session";
import { logout } from "../api/auth";


const CustomDrawer: React.FC<DrawerContentComponentProps> = (props) => {
    const router = useRouter();

    return (
        <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>

            <View className="flex-1 bg-white px-6 pt-12">

                {/* PROFILE */}
                <View className="flex-row items-center justify-center mb-6">
                    <Image
                        source={require("../../assets/images/lifeline_logo.png")}
                        className="w-32 h-32"
                        resizeMode="contain"
                    />
                </View>

                {/* MENU ITEMS */}
                <TouchableOpacity
                    className="flex-row items-center py-3 border-b border-gray-200"
                    onPress={() => router.replace("/profile_page")}
                >
                    <Feather name="user" size={30} />
                    <Text className="ml-3 text-base">User Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-row items-center py-3 border-b border-gray-200"
                    onPress={() => router.replace("/settings_page")}
                >
                    <Feather name="settings" size={30} />
                    <Text className="ml-3 text-base">Settings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-row items-center py-3 border-b border-gray-200"
                    onPress={() => router.replace("/manual_page")}
                >
                    <Feather name="book-open" size={30} />
                    <Text className="ml-3 text-base">User Manual</Text>
                </TouchableOpacity>

                {/* LOGOUT */}

                <View className="flex-1 justify-end pb-8">
                    <TouchableOpacity
                        onPress={async () => {
                            try {
                                await logout();
                                await removeToken();
                                router.replace("/(auth)/login");
                            } catch (err: any) {
                                console.error("Logout failed:", err);
                                alert("Logout failed. Please try again.");
                            }
                        }}
                        className="flex-row items-center"
                    >
                        <Ionicons name="log-out-outline" size={30} />
                        <Text className="ml-3 text-base">Log Out</Text>
                    </TouchableOpacity>
                </View>


            </View>
        </DrawerContentScrollView>
    );
};

export default CustomDrawer;
