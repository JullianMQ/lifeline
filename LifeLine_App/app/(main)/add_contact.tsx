import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import ScreenWrapper from "../../components/screen_wrapper";
import { saveContacts, getContacts } from "@/lib/api/contact";

const AddContact = ({ onSaved }: { onSaved?: () => void }) => {
    const router = useRouter();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");

    const handleSave = async () => {
        const trimmedPhone = phone.trim();
        if (!trimmedPhone) {
            Alert.alert("Phone number is required");
            return;
        }

        try {
            const existingContacts = await getContacts();
            let fieldToUpdate = "";
            for (let i = 1; i <= 5; i++) {
                const key = `emergency_contact_${i}` as const;
                if (!existingContacts.find((c: any) => c.id === i)) {
                    fieldToUpdate = key;
                    break;
                }
            }

            if (!fieldToUpdate) {
                Alert.alert("All 5 emergency contacts are already filled");
                return;
            }

            const payload = { [fieldToUpdate]: trimmedPhone };

            const result = await saveContacts(payload);

            if (result.success) {
                Alert.alert("Contact Added!");
                setFirstName("");
                setLastName("");
                setPhone("");
                if (onSaved) onSaved();
                router.back();
            } else {
                Alert.alert("Error adding contact", result.error?.message || "Unknown error");
            }
        } catch (err) {
            console.error(err);
            Alert.alert("Failed to add contact");
        }
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
                        source={require("../../assets/images/user_placeholder.png")}
                        className="w-28 h-28 rounded-full"
                    />
                </View>

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

                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="bg-white border border-black py-4 rounded-full items-center mt-6"
                    >
                        <Text className="text-black text-lg font-semibold">Back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScreenWrapper>
    );
};

export default AddContact;
