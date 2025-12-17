import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import ScreenWrapper from "../../components/screen_wrapper";
import { saveContacts, getContacts } from "@/lib/api/contact";

const AddContact = ({ onSaved }: { onSaved?: () => void }) => {
    const router = useRouter();
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
            topNavProps={{
                backButtonOnly: true,
                onBackPress: () => router.back(),
            }}
        >
            <View className="flex-1 pt-12 items-center relative">

                {/* Input */}
                <View className="w-3/4 mt-10">
                    <Text className="mb-2 text-lg font-semibold">Phone Number</Text>
                    <TextInput
                        placeholder="Enter phone number"
                        keyboardType="numeric"
                        value={phone}
                        onChangeText={setPhone}
                        className="border-2 border-black rounded-full px-4 py-3 mb-4"
                    />
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    onPress={handleSave}
                    className="bg-lifelineRed py-4 rounded-full w-3/4 absolute bottom-6 self-center"
                >
                    <Text className="text-center text-white font-semibold text-lg">
                        Save
                    </Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
};

export default AddContact;
