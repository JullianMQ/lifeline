import React from "react";
import { Text, TouchableOpacity, View, Switch } from "react-native";
import ScreenWrapper from "../../components/screen_wrapper";
import { useRouter } from "expo-router";

const SettingsPage = () => {
    const router = useRouter();

    return (
        <ScreenWrapper
            showBottomNav={false}
            topNavProps={{ backButtonOnly: true, onBackPress: () => router.back() }}
        >
            <View className="px-6 py-4 flex-1">
                <TouchableOpacity
                    className="py-3 border-b border-gray-200"
                    onPress={() => router.push("/(main)/profile_page")}
                >
                    <Text className="text-base">Contact Information</Text>
                </TouchableOpacity>

            </View>
        </ScreenWrapper>
    );
};

export default SettingsPage;
