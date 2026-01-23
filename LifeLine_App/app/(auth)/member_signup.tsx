import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { signUp } from "@/lib/api/auth";
import { generateMagicLinkQr } from "@/lib/api/contact";

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

            // Generate QR link
            const qrUrl = await generateMagicLinkQr({
                email,
                name: `${firstName} ${lastName}`,
                callbackURL: "lifeline://landing",
                newUserCallbackURL: "lifeline://landing",
                errorCallbackURL: "lifeline://landing",
            });



            router.push({
                pathname: "/(auth)/member_signup_qr",
                params: { qrUrl: encodeURIComponent(qrUrl) },
            });
        } catch (err: any) {
            Alert.alert("Error", err.message || "Signup failed");
        }
    };

    return (
        <View className="flex-1 bg-white items-center pt-32">
            <View className="w-3/4 flex-1 justify-between">

                {/* TOP CONTENT */}
                <View className="items-center mb-8">
                    <Text className="text-3xl font-extrabold mb-12">Fill up member details</Text>

                    {/* FORM */}
                    <View className="w-full mt-8">
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
                    </View>
                </View>

                {/* BOTTOM BUTTONS */}
                <View className="mb-10">
                    <TouchableOpacity
                        onPress={handleSignup}
                        className="bg-lifelineRed py-4 rounded-full mb-4"
                    >
                        <Text className="text-center text-white font-semibold text-lg">
                            Confirm
                        </Text>
                    </TouchableOpacity>

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
}
