import { View, Text, TextInput, TouchableOpacity, Image, Alert, Pressable } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { signUp, checkEmail, signInWithGoogle } from "@/lib/api/auth";
import { checkPhone } from "@/lib/api/contact";
import TermsConditionsModal from "@/components/terms_conditions";

interface SignupForm {
    firstName: string;
    lastName: string;
    email: string;
    phone_no: string;
    password: string;
    confirmPassword: string;
}

const Signup: React.FC = () => {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<SignupForm>({
        firstName: "",
        lastName: "",
        email: "",
        phone_no: "",
        password: "",
        confirmPassword: "",
    });

    const [googleLoading, setGoogleLoading] = useState(false);

    // Terms & Conditions state
    const [tcModal, setTCModal] = useState(false);
    const [tcAccepted, setTCAccepted] = useState(false);

    const inputClass = "border-2 border-black rounded-full px-4 py-3 mb-4 h-16";

    const updateField = (field: keyof SignupForm, value: string) =>
        setForm({ ...form, [field]: value });

    const handleNext = async () => {
        const { firstName, lastName, email, phone_no } = form;

        if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone_no.trim()) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            Alert.alert("Error", "Please enter a valid email");
            return;
        }
        if (!/^09\d{9}$/.test(phone_no)) {
            Alert.alert("Error", "Please enter a valid Philippine phone number (09XXXXXXXXX)");
            return;
        }

        try {
            await checkEmail(email);
            await checkPhone(phone_no);

            setStep(2);
        } catch (err: any) {
            const msg = err?.message || "Unable to verify details";
            Alert.alert("Validation Error", msg);
        }
    };

    const handleGoogleSignUp = async () => {
        setGoogleLoading(true);
        try {
            const data = await signInWithGoogle({
                callbackURL: "lifeline://landing",
                newUserCallbackURL: "lifeline://add_phone_num",
                errorCallbackURL: "lifeline://signup",
                flow: "signup",
            });
            if (!data) return;
        } catch (err: any) {
            Alert.alert("Google signup failed", err.message || "Google signup failed");
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleSignup = async () => {
        const { password, confirmPassword, firstName, lastName, email, phone_no } = form;

        if (!password.trim() || !confirmPassword.trim()) {
            Alert.alert("Error", "Please enter your password and confirm it");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }

        // Enforce T&C on Step 2
        if (!tcAccepted) {
            Alert.alert("Terms required", "Please agree to the Terms and Conditions to continue.");
            return;
        }

        try {
            await signUp({
                name: `${firstName} ${lastName}`,
                email,
                phone_no,
                password,
            });

            Alert.alert(
                "Verify Your Email",
                "We've sent a verification email. Please check your inbox to activate your account."
            );
            router.replace("/(auth)/verify-email");
        } catch (err: any) {
            console.error("Signup error:", err);
            Alert.alert("Error", err.message || "Signup failed. Please try again.");
        }
    };

    const step1Fields = [
        { placeholder: "First Name", key: "firstName" },
        { placeholder: "Last Name", key: "lastName" },
        { placeholder: "Email", key: "email", keyboardType: "email-address" as const, autoCapitalize: "none" as const },
        { placeholder: "Phone Number", key: "phone_no", keyboardType: "phone-pad" as const, autoCapitalize: "none" as const },
    ];

    return (
        <View className="flex-1 bg-white items-center pt-32">
            {/* Terms modal */}
            <TermsConditionsModal
                visible={tcModal}
                accepted={tcAccepted}
                onToggleAccepted={setTCAccepted}
                onClose={() => setTCModal(false)}
            />

            <View className="w-3/4 flex-1 justify-between">
                {/* TOP CONTENT */}
                <View>
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

                            <TouchableOpacity onPress={handleNext} className="bg-lifelineRed py-4 rounded-full mb-4">
                                <Text className="text-center text-white font-semibold text-lg">Next</Text>
                            </TouchableOpacity>

                            {/* Separator */}
                            <View className="flex-row items-center justify-center">
                                <View className="flex-1 border-t border-gray-400" />
                                <Ionicons
                                    name="location-sharp"
                                    size={24}
                                    color="#DF3721"
                                    style={{ marginHorizontal: 8 }}
                                />
                                <View className="flex-1 border-t border-gray-400" />
                            </View>

                            {/* Google */}
                            <TouchableOpacity
                                onPress={handleGoogleSignUp}
                                disabled={googleLoading}
                                className="border-2 border-black py-4 mt-4 rounded-full mb-6 flex-row justify-center items-center"
                                style={{ opacity: googleLoading ? 0.7 : 1 }}
                            >
                                <Ionicons name="logo-google" size={24} style={{ marginRight: 8 }} />
                                <Text className="text-center text-gray-700 font-semibold">
                                    {googleLoading ? "Signing in..." : "Sign In with Google"}
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

                            {/* Buttons */}
                            <TouchableOpacity
                                onPress={handleSignup}
                                disabled={!tcAccepted}
                                className="bg-lifelineRed py-4 rounded-full mb-3"
                                style={{ opacity: tcAccepted ? 1 : 0.6 }}
                            >
                                <Text className="text-center text-white font-semibold text-lg">
                                    Signup
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setStep(1)}
                                className="border-2 border-black py-4 rounded-full mb-4"
                            >
                                <Text className="text-center text-gray-700 font-semibold text-lg">
                                    Back
                                </Text>
                            </TouchableOpacity>

                            {/* Terms row (below buttons) */}
                            <Pressable
                                onPress={() => setTCAccepted((v) => !v)}
                                style={{ flexDirection: "row", alignItems: "center" }}
                            >
                                <Ionicons
                                    name={tcAccepted ? "checkbox" : "square-outline"}
                                    size={22}
                                    color={tcAccepted ? "#DF3721" : "#666"}
                                />
                                <Text style={{ marginLeft: 10, color: "#333", flex: 1 }}>
                                    I agree to the{" "}
                                    <Text
                                        style={{ color: "#2563eb", fontWeight: "700" }}
                                        onPress={() => setTCModal(true)}
                                    >
                                        Terms and Conditions
                                    </Text>
                                </Text>
                            </Pressable>
                        </>
                    )}
                </View>

                {/* BOTTOM LOGIN LINK */}
                <View className="mb-10">
                    <Text className="text-center text-gray-600">
                        Already have an account?
                        <Link href="/(auth)/login" className="text-blue-600 font-semibold"> Log In</Link>
                    </Text>
                </View>
            </View>
        </View>
    );
};

export default Signup;
