import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ScreenWrapper from "../../components/screen_wrapper";
import DropDownPicker from "react-native-dropdown-picker";
import InputField from "@/components/inputs_field";

const AddContact = () => {
    const router = useRouter();

    const [form, setForm] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        role: "",
    });

    // State for DropDownPicker
    const [open, setOpen] = useState(false);
    const [roleItems, setRoleItems] = useState([
        { label: "Child", value: "Child" },
        { label: "Parent", value: "Parent" },
    ]);

    const inputs = [
        { key: "first_name", placeholder: "First Name", keyboardType: "default" },
        { key: "last_name", placeholder: "Last Name", keyboardType: "default" },
        { key: "email", placeholder: "Email (optional)", keyboardType: "email-address" },
        { key: "phone_number", placeholder: "Phone", keyboardType: "numeric" },
        { key: "role", placeholder: "Role", type: "dropdown" },
    ];

    const handleChange = (key: string, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (!form.phone_number.trim()) {
            alert("Phone number is required");
            return;
        }
        if (!form.role) {
            alert("Role is required");
            return;
        }

        console.log("Prepared contact payload:", form);
        setTimeout(() => alert("Contact Added!"), 500);
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

                {/* Avatar */}
                <View className="items-center mb-6 w-3/4">
                    <View className="w-40 h-40 bg-gray-300 rounded-full mx-auto" />
                </View>

                {/* Inputs */}
                <View className="w-3/4 mb-24">
                    {inputs.map((input) => {
                        if (input.type === "dropdown") {
                            return (
                                <View key={input.key} className="mb-6 z-10">
                                    <DropDownPicker
                                        open={open}
                                        value={form.role || null}
                                        items={roleItems}
                                        setOpen={setOpen}
                                        setValue={(callback) => {
                                            const value = typeof callback === "function" ? callback(form.role) : callback;
                                            handleChange("role", value ?? "");
                                        }}
                                        setItems={setRoleItems}
                                        placeholder="Select Role"
                                        listMode="SCROLLVIEW"
                                        style={{
                                            borderWidth: 2,
                                            borderColor: "black",
                                            borderRadius: 20,
                                            paddingHorizontal: 16,
                                            paddingVertical: 12,
                                            backgroundColor: "white",

                                        }}
                                        dropDownContainerStyle={{
                                            borderWidth: 2,
                                            borderColor: "black",
                                            borderRadius: 20,
                                            backgroundColor: "white",
                                        }}
                                        textStyle={{ color: "black" }}
                                        placeholderStyle={{ color: "gray" }}
                                    />
                                </View>
                            );
                        }

                        return (
                            <InputField
                                key={input.key}
                                placeholder={input.placeholder}
                                value={form[input.key as keyof typeof form]}
                                onChangeText={(text) => handleChange(input.key, text)}
                                keyboardType={input.keyboardType as any}
                                className="mb-4"
                            />
                        );
                    })}
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
