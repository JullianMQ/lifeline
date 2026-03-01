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
    const [invalidFields, setInvalidFields] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [googleLoading, setGoogleLoading] = useState(false);

    // Terms & Conditions state
    const [tcModal, setTCModal] = useState(false);
    const [tcAccepted, setTCAccepted] = useState(false);

    const inputClass = "border-2 border-black rounded-full px-4 py-3 mb-4 h-16";

    const handleChange = (field: keyof SignupForm, value: string) => {
        // Mirror lifeline_web: phone number input is digits only, must start with 09, max 11 digits
        if (field === "phone_no") {
            let v = value.replace(/\D/g, "");
            const phoneError = () => {
                setInvalidFields((prev) => Array.from(new Set([...prev, "phoneNo"])));
                setError("Phone number must start with 09 and be 11 digits.");
            };

            if (v.length > 0 && v[0] !== "0") { phoneError(); return; }
            if (v.length > 1 && v[1] !== "9") { phoneError(); return; }
            v = v.slice(0, 11);

            setForm((prev) => ({ ...prev, phone_no: v }));
            setInvalidFields((prev) => prev.filter((f) => f !== "phoneNo"));
            setError(null);
            return;
        }

        setForm((prev) => ({ ...prev, [field]: value }));
        const invalidKey =
            field === "firstName" ? "firstName" :
                field === "lastName" ? "lastName" :
                    field === "email" ? "email" :
                        field === "password" ? "password" :
                            field === "confirmPassword" ? "confirmPassword" :
                                String(field);

        setInvalidFields((prev) => prev.filter((f) => f !== invalidKey));
        setError(null);
    };

    const handleNext = async () => {
        setError(null);
        setInvalidFields([]);

        const { firstName, lastName, email, phone_no } = form;

        const errors: string[] = [];
        if (!firstName.trim()) errors.push("firstName");
        if (!lastName.trim()) errors.push("lastName");
        if (!email.trim()) errors.push("email");
        if (!phone_no.trim()) errors.push("phoneNo");

        if (errors.length > 0) {
            setInvalidFields(errors);
            return;
        }

        const phoneRegex = /^09\d{9}$/;
        if (!phoneRegex.test(phone_no)) {
            setInvalidFields((prev) => Array.from(new Set([...prev, "phoneNo"])));
            setError("Invalid phone number. Must start with 09 and be 11 digits.");
            return;
        }

        try {
            await checkEmail(email);
        } catch (err: any) {
            setInvalidFields((prev) => Array.from(new Set([...prev, "email"])));
            setError(err?.message || "Email already in use");
            return;
        }

        try {
            await checkPhone(phone_no);
        } catch (err: any) {
            const rawLower = String(err?.message ?? "").toLowerCase();
            setInvalidFields((prev) => Array.from(new Set([...prev, "phoneNo"])));
            if (rawLower.includes("exists") || rawLower.includes("already")) {
                setError("Phone number already exists.");
            } else {
                setError(err?.message || "Signup failed");
            }
            return;
        }

        setStep(2);
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
        setError(null);

        const { password, confirmPassword, firstName, lastName, email, phone_no } = form;

        const errors: string[] = [];

        const phoneRegex = /^09\d{9}$/;
        if (!phone_no.trim()) {
            errors.push("phoneNo");
            setError("Phone number is required");
        } else if (!phoneRegex.test(phone_no)) {
            errors.push("phoneNo");
            setError("Invalid phone number. Must start with 09 and be 11 digits.");
        }

        if (!password.trim()) errors.push("password");
        if (!confirmPassword.trim() || password !== confirmPassword) {
            errors.push("confirmPassword");
            setError(!confirmPassword.trim() ? "Please confirm your password" : "Passwords do not match");
        }

        if (errors.length > 0) {
            setInvalidFields(Array.from(new Set(errors)));
            return;
        }

        // Enforce T&C on Step 2 (keep existing mobile flow)
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

            const raw = String(err?.message ?? "").trim();
            const rawLower = raw.toLowerCase();

            if (raw === "USER_ALREADY_EXISTS" || rawLower.includes("user_already_exists")) {
                setInvalidFields(["email"]);
                setError("Email already exists.");
            } else if (rawLower.includes("phone") || rawLower.includes("phone_no") || rawLower.includes("phoneno")) {
                setInvalidFields(["phoneNo"]);
                setError("Phone number already exists.");
            } else if (raw) {
                setError(raw);
            } else {
                setError("Signup failed");
            }
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
                                    onChangeText={(text) => handleChange(field.key as keyof SignupForm, text)}
                                    className={`${inputClass} ${invalidFields.includes(field.key === "phone_no" ? "phoneNo" : String(field.key)) ? "border-lifelineRed" : "border-black"}`}
                                    keyboardType={field.keyboardType}
                                    autoCapitalize={field.autoCapitalize}
                                />
                            ))}

                            {error && (
                                <Text className="text-lifelineRed mb-4">
                                    {error}
                                </Text>
                            )}

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
                                onChangeText={(text) => handleChange("password", text)}
                                secureTextEntry
                                className={`${inputClass} ${invalidFields.includes("password") ? "border-lifelineRed" : "border-black"}`}
                            />
                            <TextInput
                                placeholder="Confirm Password"
                                value={form.confirmPassword}
                                onChangeText={(text) => handleChange("confirmPassword", text)}
                                secureTextEntry
                                className={`${inputClass} ${invalidFields.includes("confirmPassword") ? "border-lifelineRed" : "border-black"}`}
                            />

                            {error && (
                                <Text className="text-lifelineRed mb-4">
                                    {error}
                                </Text>
                            )}

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

                            {/* Terms */}
                            <Pressable onPress={() => setTCModal(true)} className="mb-2">
                                <Text className="text-center text-blue-600 font-semibold">
                                    View Terms and Conditions
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => setTCAccepted((prev) => !prev)}
                                className="flex-row items-center justify-center"
                            >
                                <Ionicons
                                    name={tcAccepted ? "checkbox" : "square-outline"}
                                    size={22}
                                    color={tcAccepted ? "#DF3721" : "#111"}
                                    style={{ marginRight: 8 }}
                                />
                                <Text className="text-gray-700 font-semibold">
                                    I agree to the Terms and Conditions
                                </Text>
                            </Pressable>
                        </>
                    )}
                </View>

                {/* Bottom Login */}
                <View className="mb-10">
                    <Text className="text-center text-gray-600">
                        Already have an account?
                        <Link href="/(auth)/login" className="text-blue-600 font-semibold">
                            {" "}Login
                        </Link>
                    </Text>
                </View>
            </View>
        </View>
    );
};

export default Signup;