import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from "react-native";
import React, { useState } from "react";
import { router } from "expo-router";
import { API_BASE_URL } from "@/lib/api/config";
import { saveUser } from "@/lib/api/storage/user";

const AddPhoneNum = () => {
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!phone) {
            Alert.alert("Error", "Please enter your phone number.");
            return;
        }

        setLoading(true);

        try {
            console.log("Updating phone number:", phone);

            const res = await fetch(`${API_BASE_URL}/api/update-user`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ phone_no: phone }),
            });

            console.log("Response status:", res.status);
            console.log("Response ok:", res.ok);

            const rawText = await res.text();
            console.log("Raw response text:", rawText);

            if (!res.ok) {
                throw new Error(`Failed to update phone: ${rawText}`);
            }

            const data = JSON.parse(rawText);
            console.log("Parsed response:", data);

            if (data.user) {
                await saveUser(data.user);
                Alert.alert("Success", "Phone number updated!");
                router.replace("/(auth)/add_member");
            } else {
                throw new Error("No user data returned from backend");
            }
        } catch (err: any) {
            console.error("handleConfirm error:", err);
            Alert.alert("Error", err.message || "Failed to update phone number");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white items-center pt-32">
            <View className="w-3/4 flex-1 justify-between">
                {/* TOP CONTENT */}
                <View className="items-center mb-8">
                    <Text className="text-3xl font-extrabold mb-12">Fill up member details</Text>

                    {/* FORM */}
                    <View className="w-full">
                        <TextInput
                            placeholder="Phone Number"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            autoCapitalize="none"
                            className="border-2 border-black rounded-full px-4 py-4"
                        />
                    </View>
                </View>

                {/* BOTTOM BUTTONS */}
                <View className="mb-10 w-full">
                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={loading}
                        className={`bg-lifelineRed py-4 rounded-full mb-4 ${loading ? "opacity-50" : ""}`}
                    >
                        <Text className="text-center text-white font-semibold text-lg">
                            {loading ? "Updating..." : "Confirm"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="border-2 border-black py-4 rounded-full"
                    >
                        <Text className="text-center text-black font-semibold text-lg">Back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

export default AddPhoneNum;

const styles = StyleSheet.create({});
