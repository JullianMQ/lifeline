import React from "react";
import { View } from "react-native";
import { Slot } from "expo-router";

const MainLayout: React.FC = () => {
    return (
        <View className="flex-1">
            {/* Slot renders the child pages inside this folder */}
            <Slot />
        </View>
    );
};

export default MainLayout;
