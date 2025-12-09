import { View, Text, TextInput, TouchableOpacity, Image, Alert } from "react-native";
import { useState } from "react";
import { router } from "expo-router";

interface ParentInfoForm {
    childEmail: string;
    childPhone: string;
}

const ParentInfo: React.FC = () => {
    const [form, setForm] = useState<ParentInfoForm>({
        childEmail: "",
        childPhone: "",
    });

    const inputClass = "border border-black rounded-full px-4 py-3 mb-4 h-16";

    const updateField = (field: keyof ParentInfoForm, value: string) =>
        setForm({ ...form, [field]: value });

    const handleSubmit = () => {
        const { childEmail, childPhone } = form;

        if (!childEmail.trim() || !childPhone.trim()) {
            Alert.alert("Error", "Please fill in your child's email and phone");
            return;
        }


        console.log("Child Info Submitted:", form);
        Alert.alert("Success", "Child information submitted!");
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
                    Kindly add your child's contact information
                </Text>

                <TextInput
                    placeholder="Child Email"
                    value={form.childEmail}
                    onChangeText={(text) => updateField("childEmail", text)}
                    className={inputClass}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <TextInput
                    placeholder="Child Phone"
                    value={form.childPhone}
                    onChangeText={(text) => updateField("childPhone", text)}
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

export default ParentInfo;
