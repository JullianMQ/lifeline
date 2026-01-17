import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { getUserByPhone } from "@/lib/api/contact";
import { saveContacts } from "@/lib/api/contact";

const AddExistingMember = () => {
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any | null>(null);
    const [error, setError] = useState("");

    const handleLookup = async () => {
        if (!phone.trim()) {
            setError("Please enter a phone number");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const result = await getUserByPhone(phone.trim());

            if (!result) {
                setError("User not found");
                setUser(null);
                return;
            }

            setUser(result);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch user");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!user) return;

        try {
            await saveContacts({
                user_id: user.id,
                type: "dependent",
            });

            Alert.alert("Success", "Member added successfully");
            router.replace("/(main)/contact_page");
        } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to add member");
        }
    };

    return (
        <View className="flex-1 bg-white items-center pt-32">
            <View className="w-3/4 flex-1 justify-between">

                {/* TOP CONTENT */}
                <View className="items-center mb-8">

                    {!user ? (
                        <>
                            <Text className="text-3xl font-extrabold mb-12">
                                Fill up member details
                            </Text>

                            <View className="w-full">
                                <TextInput
                                    placeholder="Phone Number"
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                    className="border-2 border-black rounded-full px-4 py-4"
                                />

                                {error ? (
                                    <Text className="text-red-500 mt-3 text-center">{error}</Text>
                                ) : null}

                                {loading ? (
                                    <ActivityIndicator className="mt-6" />
                                ) : (
                                    <TouchableOpacity
                                        onPress={handleLookup}
                                        className="bg-lifelineRed py-4 rounded-full mt-8"
                                    >
                                        <Text className="text-center text-white font-semibold text-lg">
                                            Search
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </>
                    ) : (
                        <>
                            <Text className="text-2xl font-bold mb-10">
                                Add this account?
                            </Text>

                            {/* USER CARD */}
                            <View className="items-center mb-10">
                                <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center mb-4">
                                    <Text className="text-3xl font-bold">
                                        {user.name?.charAt(0).toUpperCase()}
                                    </Text>
                                </View>

                                <Text className="text-lg font-semibold">
                                    {user.name}
                                </Text>

                                <Text className="text-gray-500">
                                    {user.role}
                                </Text>
                            </View>
                        </>
                    )}
                </View>

                {/* BOTTOM BUTTONS */}
                <View className="mb-10">
                    {user && (
                        <TouchableOpacity
                            onPress={handleConfirm}
                            className="bg-lifelineRed py-4 rounded-full mb-4"
                        >
                            <Text className="text-center text-white font-semibold text-lg">
                                Confirm
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="border-2 border-black py-4 rounded-full"
                    >
                        <Text className="text-center text-black font-semibold text-lg">
                            Back
                        </Text>
                    </TouchableOpacity>
                </View>

            </View>
        </View>
    );
};

export default AddExistingMember;
