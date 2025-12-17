import { View, Text, TextInput, TouchableOpacity, Image, Alert } from "react-native";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { signUp } from "@/lib/api/auth";

interface SignupForm {
    firstName: string;
    lastName: string;
    email: string;
    phone_no: string;
    password: string;
    confirmPassword: string;
}

export default function MemberSignup() {
    const { role } = useLocalSearchParams<{ role: string }>();
    const [form, setForm] = useState<SignupForm>({
        firstName: "",
        lastName: "",
        email: "",
        phone_no: "",
        password: "",
        confirmPassword: "",
    });

    const inputClass = "border-2 border-black rounded-full px-4 py-3 mb-4 h-16";

    const updateField = (field: keyof SignupForm, value: string) =>
        setForm({ ...form, [field]: value });

    const handleSignup = async () => {
        const { firstName, lastName, email, phone_no, password, confirmPassword } = form;

        // Basic validations
        if (!firstName || !lastName || !email || !phone_no || !password || !confirmPassword) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            Alert.alert("Error", "Invalid email");
            return;
        }
        if (!/^09\d{9}$/.test(phone_no) && !/^\+639\d{9}$/.test(phone_no)) {
            Alert.alert("Error", "Invalid Philippine phone number");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }
        try {
            await signUp({
                name: `${firstName} ${lastName}`,
                email,
                phone_no,
                password,
                role,
            } as any);

            Alert.alert("Success", "Family member added");
            router.replace("/(auth)/login");
        } catch (err: any) {
            console.error("Signup error:", err);
            Alert.alert("Error", err.message || "Signup failed");
        }
    };

    return (
        <View className="flex-1 bg-white items-center pt-32">
            <View className="w-3/4">
                {/* Header */}
                <View className="items-center mb-8">
                    <Image
                        source={require("../../assets/images/LifelineLogo.png")}
                        className="w-28 h-28"
                        resizeMode="contain"
                    />
                    <Text className="text-2xl font-bold">Add {role} Account</Text>
                </View>

                {/* Form */}
                <TextInput
                    placeholder="First Name"
                    value={form.firstName}
                    onChangeText={(t) => updateField("firstName", t)}
                    className={inputClass}
                />
                <TextInput
                    placeholder="Last Name"
                    value={form.lastName}
                    onChangeText={(t) => updateField("lastName", t)}
                    className={inputClass}
                />
                <TextInput
                    placeholder="Email"
                    value={form.email}
                    onChangeText={(t) => updateField("email", t)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className={inputClass}
                />
                <TextInput
                    placeholder="Phone Number"
                    value={form.phone_no}
                    onChangeText={(t) => updateField("phone_no", t)}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    className={inputClass}
                />

                {/* Password Fields with asterisks */}
                <TextInput
                    placeholder="Password"
                    value={form.password}
                    onChangeText={(t) => updateField("password", t)}
                    secureTextEntry
                    className={inputClass}
                />
                <TextInput
                    placeholder="Confirm Password"
                    value={form.confirmPassword}
                    onChangeText={(t) => updateField("confirmPassword", t)}
                    secureTextEntry
                    className={inputClass}
                />

                <TouchableOpacity
                    onPress={handleSignup}
                    className="bg-lifelineRed py-4 rounded-full mt-4"
                >
                    <Text className="text-center text-white font-semibold text-lg">Save</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
