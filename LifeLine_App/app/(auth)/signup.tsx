import { View, Text, TextInput, TouchableOpacity, Image, Alert } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { API_BASE_URL } from "../../lib/api/config";
import { saveToken } from "../../lib/api/storage/session";


interface SignupForm {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
}

const Signup: React.FC = () => {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<SignupForm>({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const inputClass = "border-2 border-black rounded-full px-4 py-3 mb-4 h-16";

    const updateField = (field: keyof SignupForm, value: string) =>
        setForm({ ...form, [field]: value });

    const handleNext = () => {
        const { firstName, lastName, email } = form;
        if (!firstName.trim() || !lastName.trim() || !email.trim()) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            Alert.alert("Error", "Please enter a valid email");
            return;
        }
        setStep(2);
    };

    const handleSignup = async () => {
        const { password, confirmPassword, firstName, lastName, email } = form;

        if (!password.trim() || !confirmPassword.trim()) {
            Alert.alert("Error", "Please enter your password and confirm it");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }

        const payload = {
            name: `${firstName} ${lastName}`,
            email,
            password,
        };

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Origin": API_BASE_URL,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                console.error("Backend error:", data);
                throw new Error(data.message || "Signup failed");
            }

            console.log("Signup success:", data);

            if (data.token) {
                await saveToken(data.token);
            }

            Alert.alert("Success", "Account created successfully");


            router.replace("/(auth)/select_role");

        } catch (err: any) {
            console.error("Signup error:", err);
            Alert.alert("Error", err.message || "Signup failed. Please try again.");
        }
    };



    const step1Fields = [
        { placeholder: "First Name", key: "firstName" },
        { placeholder: "Last Name", key: "lastName" },
        { placeholder: "Email", key: "email", keyboardType: "email-address" as const, autoCapitalize: "none" as const },
    ];

    return (
        <View className="flex-1 bg-white justify-start items-center pt-48">
            <View className="w-3/4">
                <View className="items-center mb-8">
                    <Image
                        source={require("../../assets/images/LifelineLogo.png")}
                        className="w-28 h-28"
                        resizeMode="contain"
                    />
                    <Text className="text-3xl font-extrabold text-gray-700">SIGNUP</Text>
                </View>

                {/* STEP 1 */}
                {step === 1 && (
                    <>
                        {step1Fields.map((field) => (
                            <TextInput
                                key={field.key}
                                placeholder={field.placeholder}
                                value={form[field.key as keyof SignupForm]}
                                onChangeText={(text) => updateField(field.key as keyof SignupForm, text)}
                                className={inputClass}
                                keyboardType={field.keyboardType}
                                autoCapitalize={field.autoCapitalize}
                            />
                        ))}

                        <TouchableOpacity
                            onPress={handleNext}
                            className="bg-lifelineRed py-4 rounded-full mb-4"
                        >
                            <Text className="text-center text-white font-semibold text-lg">Next</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => console.log("Google Signup pressed")}
                            className="border-2 border-black py-4 mt-8 rounded-full mb-6 flex-row justify-center items-center"
                        >
                            <Ionicons name="logo-google" size={24} className="mr-2" />
                            <Text className="text-center text-gray-700 font-semibold">
                                Sign Up with Google
                            </Text>
                        </TouchableOpacity>
                    </>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                    <>
                        <TextInput
                            placeholder="Password"
                            value={form.password}
                            onChangeText={(text) => updateField("password", text)}
                            secureTextEntry
                            className={inputClass}
                        />
                        <TextInput
                            placeholder="Confirm Password"
                            value={form.confirmPassword}
                            onChangeText={(text) => updateField("confirmPassword", text)}
                            secureTextEntry
                            className={inputClass}
                        />

                        <TouchableOpacity
                            onPress={handleSignup}
                            className="bg-lifelineRed py-4 rounded-full mb-4"
                        >
                            <Text className="text-center text-white font-semibold text-lg">Sign Up</Text>
                        </TouchableOpacity>
                    </>
                )}

                <Text className="text-center text-gray-600">
                    Already have an account?
                    <Link href="/(auth)/login" className="text-blue-600 font-semibold"> Log In</Link>
                </Text>
            </View>
        </View>
    );
};

export default Signup;
