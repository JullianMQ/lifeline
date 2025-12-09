import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import ScreenWrapper from "../components/screen_wrapper";
import { Ionicons } from "@expo/vector-icons";

const HomePage = () => {
    return (
        <ScreenWrapper>
            {/* MAP BOX */}
            <View className="bg-white mx-4 mt-4 rounded-2xl overflow-hidden border">
                <View className="h-96 bg-gray-300 items-center justify-center">
                    <Text className="text-gray-600">MAP PLACEHOLDER</Text>
                </View>
            </View>

            {/* LOCATION TEXT */}
            <View className="mx-4 mt-3">
                <Text className="text-s text-gray-500">You are at:</Text>
                <Text className="text-xl font-semibold">Lorem, Ipsum, Dolor</Text>
            </View>

            {/* SOS BUTTON */}
            <View className="items-center mt-12">
                <TouchableOpacity
                    className="w-32 h-32 rounded-full items-center justify-center bg-red-600"

                >
                    <Ionicons name="call" size={30} color="white" />
                    <Text className="text-white font-bold mt-1">SOS</Text>
                </TouchableOpacity>

                {/* STOP BUTTON */}
                <TouchableOpacity className="mt-10 bg-white px-10 py-3 rounded-2xl border">
                    <Text className="font-bold">STOP</Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
};

export default HomePage;
