import { View, Text, TouchableOpacity } from "react-native";
import React from "react";
import { useLocalSearchParams, router } from "expo-router";
import QRCode from "react-native-qrcode-svg";

export default function MemberSignupQr() {
    const { qrUrl } = useLocalSearchParams<{ qrUrl: string }>();

    if (!qrUrl) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <Text>No QR found.</Text>
            </View>
        );
    }
    const decodedUrl = decodeURIComponent(qrUrl);

    return (
        <View className="flex-1 bg-white items-center pt-32">
            <View className="w-3/4 flex-1 justify-between">

                {/* TOP CONTENT */}
                <View className="items-center mb-8">
                    <QRCode value={decodedUrl} size={250} />
                    <Text className="text-2xl font-bold mt-6 text-center">
                        Scan QR Code
                    </Text>
                </View>

                {/* BOTTOM BUTTON */}
                <View className="mb-10">
                    <TouchableOpacity
                        onPress={() => router.replace("/(auth)/add_member")}
                        className="bg-lifelineRed py-4 rounded-full mb-4"
                    >
                        <Text className="text-center text-white font-semibold text-lg">
                            Add Another
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.replace("/(auth)/login")}
                        className="border-2 border-black py-4 rounded-full"
                    >
                        <Text className="text-center text-black font-semibold text-lg">
                            Skip
                        </Text>
                    </TouchableOpacity>
                </View>

            </View>
        </View>
    );
}
