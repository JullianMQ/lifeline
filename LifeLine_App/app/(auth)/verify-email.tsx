import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";

const VerifyEmail = () => {
    return (
        <View className="flex-1 bg-white items-center justify-center px-8">
            <Text className="text-2xl font-bold text-gray-800 text-center mb-4">
                Verify Your Email
            </Text>

            <Text className="text-base text-gray-600 text-center mb-8">
                We’ve sent a verification email to your inbox.
                Please click the link in the email to activate your account.
            </Text>

            <TouchableOpacity
                className="bg-lifelineRed px-8 py-4 rounded-full"
                onPress={() => router.replace("/(auth)/login")}
            >
                <Text className="text-white font-semibold text-base text-center">
                    Back to Login
                </Text>
            </TouchableOpacity>
        </View>
    );
};

export default VerifyEmail;
