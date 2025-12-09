import { View, Text, TextInput, TouchableOpacity, Image, Alert } from "react-native";
import { useState } from "react";
import { router } from "expo-router";

interface ChildInfoForm {
    parentEmail: string;
    parentPhone: string;
    altEmail: string;
    altPhone: string;
}

const ChildInfo: React.FC = () => {
    const [form, setForm] = useState<ChildInfoForm>({
        parentEmail: "",
        parentPhone: "",
        altEmail: "",
        altPhone: "",
    });

    const inputClass = "border border-black rounded-full px-4 py-3 mb-4 h-16";

    const updateField = (field: keyof ChildInfoForm, value: string) =>
        setForm({ ...form, [field]: value });

    const handleSubmit = () => {
        const { parentEmail, parentPhone } = form;

        if (!parentEmail.trim() || !parentPhone.trim()) {
            Alert.alert("Error", "Please fill in your parent's email and phone");
            return;
        }


        console.log("Parent Info Submitted:", form);

        Alert.alert("Success", "Parent information submitted!");
        router.replace("/landing");
    };

    return (
        <View className="flex-1 bg-white justify-start items-center pt-48">
            <View className="w-3/4">
                <View className="items-center mb-8">
                    <Image
                        source={require("../../assets/images/LifelineLogo.png")}
                        className="w-28 h-28"
                        resizeMode="contain"
                    />
                    <Text className="text-3xl font-extrabold text-black">SIGN UP</Text>
                </View>

                <Text className="text-xl mb-6 text-center">
                    Kindly add your parent's contact information
                </Text>

                <TextInput
                    placeholder="Parent Email"
                    value={form.parentEmail}
                    onChangeText={(text) => updateField("parentEmail", text)}
                    className={inputClass}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <TextInput
                    placeholder="Parent Phone"
                    value={form.parentPhone}
                    onChangeText={(text) => updateField("parentPhone", text)}
                    className={inputClass}
                    keyboardType="phone-pad"
                />

                <TextInput
                    placeholder="Alternative Email (optional)"
                    value={form.altEmail}
                    onChangeText={(text) => updateField("altEmail", text)}
                    className={inputClass}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <TextInput
                    placeholder="Alternative Phone (optional)"
                    value={form.altPhone}
                    onChangeText={(text) => updateField("altPhone", text)}
                    className={inputClass}
                    keyboardType="phone-pad"
                />

                <TouchableOpacity
                    onPress={handleSubmit}
                    className="bg-lifelineRed py-4 rounded-full mb-4"
                >
                    <Text className="text-center text-white font-semibold text-lg">Submit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.back()}
                    className="bg-white border border-black py-4 rounded-full items-center mt-6"
                >
                    <Text className="text-black text-lg font-semibold">Back</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default ChildInfo;
