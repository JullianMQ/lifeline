import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { login, signInWithGoogle } from "../../lib/api/auth";
import { saveUser } from "@/lib/api/storage/user";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setEmail("");
        setPassword("");
    }, []);

    // Standard email/password login
    const handleLogin = async () => {
        setLoading(true);
        try {
            console.log("Attempting login with email:", email);
            const data = await login(email, password);
            await saveUser(data.user);
            router.replace("/(main)/landing");
            setEmailError(false);
            setPasswordError(false);
        } catch (err: any) {
            console.log("LOGIN ERROR:", err);
            setEmailError(true);
            setPasswordError(true);
            alert("Login failed");
        } finally {
            setLoading(false);
        }
    };

    // Google login
    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            console.log("Starting Google OAuth login...");

            const data = await signInWithGoogle();

            await saveUser(data.user);
            router.replace("/(main)/landing");

        } catch (err: any) {
            console.error("Google login error:", err);
            alert(err.message || "Google login failed");
        } finally {
            setLoading(false);
        }
    };




    return (
        <View className="flex-1 bg-white items-center pt-32">
            <View className="w-3/4 flex-1 justify-between">

                {/* Top Content */}
                <View>
                    <View className="items-center mb-8">
                        <Image
                            source={require("../../assets/images/LifelineLogo.png")}
                            className="w-28 h-28"
                            resizeMode="contain"
                        />
                        <Text className="text-3xl font-extrabold text-gray-700">LOGIN</Text>
                    </View>

                    {/* Email Input */}
                    <TextInput
                        placeholder="Email"
                        value={email}
                        onChangeText={(text) => { setEmail(text); setEmailError(false); }}
                        className={`border-2 ${emailError ? "border-lifelineRed" : "border-black"} rounded-full px-4 py-3 mt-8 mb-6 h-16`}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    {/* Password Input */}
                    <TextInput
                        placeholder="Password"
                        value={password}
                        onChangeText={(text) => { setPassword(text); setPasswordError(false); }}
                        secureTextEntry
                        className={`border-2 ${passwordError ? "border-lifelineRed" : "border-black"} rounded-full px-4 py-3 mb-6 h-16`}
                    />

                    {/* Login Button */}
                    <TouchableOpacity
                        onPress={handleLogin}
                        className="bg-lifelineRed py-4 rounded-full mb-4"
                        disabled={loading}
                    >
                        <Text className="text-center text-white font-semibold text-lg">
                            {loading ? "Logging in..." : "Login"}
                        </Text>
                    </TouchableOpacity>

                    {/* Separator */}
                    <View className="flex-row items-center justify-center">
                        <View className="flex-1 border-t border-gray-400" />
                        <Ionicons name="location-sharp" size={24} color="#DF3721" style={{ marginHorizontal: 8 }} />
                        <View className="flex-1 border-t border-gray-400" />
                    </View>

                    {/* Google Login */}
                    <TouchableOpacity
                        className="border-2 border-black py-4 mt-4 rounded-full flex-row justify-center items-center"
                        onPress={handleGoogleLogin}
                        disabled={loading}
                    >
                        <Ionicons name="logo-google" size={24} />
                        <Text className="text-gray-700 font-semibold ml-2">
                            {loading ? "Opening Google..." : "Login with Google"}
                        </Text>
                    </TouchableOpacity>

                    {/* QR Code Button */}
                    <TouchableOpacity
                        className="border-2 border-black py-4 mt-6 rounded-full flex-row justify-center items-center"
                    >
                        <Ionicons name="qr-code-outline" size={24} />
                        <Text className="text-gray-700 font-semibold ml-2">
                            Scan QR Code
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Bottom SignUp */}
                <View className="mb-10">
                    <Text className="text-center text-gray-600">
                        Don’t have an account yet?
                        <Link href="/(auth)/signup" className="text-blue-600 font-semibold">
                            {" "}Register
                        </Link>
                    </Text>
                </View>

            </View>
        </View>
    );
};

export default Login;
