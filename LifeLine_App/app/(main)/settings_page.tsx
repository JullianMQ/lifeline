import React from "react";
import { Text, TouchableOpacity, View, Switch } from "react-native";
import ScreenWrapper from "../../components/screen_wrapper";
import { useRouter } from "expo-router";

const SettingsPage = () => {
    const router = useRouter();
    const [darkMode, setDarkMode] = React.useState(false);

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

                <TouchableOpacity className="py-3 border-b border-gray-200">
                    <Text className="text-base">Notifications</Text>
                </TouchableOpacity>

                <View className="flex-row justify-between items-center py-3 border-b border-gray-200">
                    <Text className="text-base">Dark Mode</Text>
                    <Switch value={darkMode} onValueChange={setDarkMode} />
                </View>
            </View>
        </ScreenWrapper>
    );
};

export default SettingsPage;
