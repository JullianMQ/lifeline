import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import ScreenWrapper from "../../components/screen_wrapper";
import { Ionicons } from "@expo/vector-icons";

const ProfilePage = () => {
    const router = useRouter();
    const [firstName, setFirstName] = useState("John");
    const [lastName, setLastName] = useState("Doe");
    const [phone, setPhone] = useState("09171234567");

    // Avatar just for UI
    const [avatar, setAvatar] = useState<string | null>(null);

    const handleChangePhoto = () => {
        Alert.alert("UI Only", "Change Photo not implemented yet");
    };

    const handleSave = () => {
        console.log("Saving profile...");
        console.log("First Name:", firstName);
        console.log("Last Name:", lastName);
        console.log("Phone:", phone);
        Alert.alert("Profile Saved (UI Only)");
        router.back();
    };

    return (
        <ScreenWrapper
            showBottomNav={false}
            topNavProps={{ backButtonOnly: true, onBackPress: () => router.back() }}
            scrollable={false}
        >
            <View className="flex-1 pt-12 items-center">
                {/* Avatar */}
                <View className="w-28 h-28 rounded-full bg-gray-200 items-center justify-center mb-6">
                    <Image
                        source={avatar ? { uri: avatar as string } : require("../../assets/images/user_placeholder.png")}
                        className="w-28 h-28 rounded-full"
                    />
                </View>

                {/* Change Photo Button */}
                <TouchableOpacity onPress={handleChangePhoto} className="flex-row items-center mb-6">
                    <Ionicons name="cloud-upload-outline" size={24} color="black" />
                    <Text className="ml-2 font-semibold">Change Photo</Text>
                </TouchableOpacity>

                {/* Inputs */}
                <View className="w-3/4">
                    <TextInput
                        placeholder="First name"
                        value={firstName}
                        onChangeText={setFirstName}
                        className="border-2 border-black rounded-full px-4 py-3 mb-4"
                    />
                    <TextInput
                        placeholder="Last name"
                        value={lastName}
                        onChangeText={setLastName}
                        className="border-2 border-black rounded-full px-4 py-3 mb-4"
                    />
                    <TextInput
                        placeholder="Phone number"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        className="border-2 border-black rounded-full px-4 py-3 mb-4"
                    />
                </View>

                {/* Buttons */}
                <View className="flex-1 justify-end w-3/4 mb-10">
                    <TouchableOpacity
                        onPress={handleSave}
                        className="py-4 rounded-full items-center bg-lifelineRed"
                    >
                        <Text className="text-white text-lg font-semibold">Save</Text>
                    </TouchableOpacity>

                </View>
            </View>
        </ScreenWrapper>
    );
};

export default ProfilePage;
