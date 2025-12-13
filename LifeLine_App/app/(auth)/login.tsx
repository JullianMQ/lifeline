import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { login } from "../../lib/api/auth";
import { saveToken } from "../../lib/api/storage/session";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);

    useEffect(() => {
        setEmail("");
        setPassword("");
    }, []);

    const handleLogin = async () => {
        try {
            console.log("Login pressed", email, password);

            const result = await login(email, password);
            console.log("API response:", result);

            if (!result.token) throw new Error("Wrong email or password");

            await saveToken(result.token);

            router.replace("../landing");

            // Clear errors on successful login
            setEmailError(false);
            setPasswordError(false);
        } catch (err: any) {
            console.log("LOGIN ERROR:", err);

            // Set errors when login fails
            if (err.message.includes("email")) setEmailError(true);
            if (err.message.includes("password")) setPasswordError(true);

            alert("Login failed: " + err.message);
        }
    };

    return (
        <View className="flex-1 bg-white items-center pt-32">
            <View className="w-3/4 flex-1 justify-between">

                {/* TOP CONTENT */}
                <View>
                    <View className="items-center mb-8">
                        <Image
                            source={require("../../assets/images/LifelineLogo.png")}
                            className="w-28 h-28"
                            resizeMode="contain"
                        />
                        <Text className="text-3xl font-extrabold text-gray-700">LOGIN</Text>
                    </View>

                    {/* Email */}
                    <TextInput
                        placeholder="Email"
                        value={email}
                        onChangeText={(text) => {
                            setEmail(text);
                            setEmailError(false);
                        }}
                        className={`border-2 ${emailError ? 'border-lifelineRed' : 'border-black'} rounded-full px-4 py-3 mt-8 mb-6 h-16`}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    {/* Password */}
                    <TextInput
                        placeholder="Password"
                        value={password}
                        onChangeText={(text) => {
                            setPassword(text);
                            setPasswordError(false);
                        }}
                        secureTextEntry
                        className={`border-2 ${passwordError ? 'border-lifelineRed' : 'border-black'} rounded-full px-4 py-3 mb-6 h-16`}
                    />

                    {/* Login */}
                    <TouchableOpacity
                        onPress={handleLogin}
                        className="bg-lifelineRed py-4 rounded-full mb-4"
                    >
                        <Text className="text-center text-white font-semibold text-lg">
                            Login
                        </Text>
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
                        className="border-2 border-black py-4 mt-4 rounded-full flex-row justify-center items-center"
                    >
                        <Ionicons name="logo-google" size={24} />
                        <Text className="text-gray-700 font-semibold ml-2">
                            Login with Google
                        </Text>
                    </TouchableOpacity>

                    {/* QR */}
                    <TouchableOpacity
                        className="border-2 border-black py-4 mt-6 rounded-full flex-row justify-center items-center"
                    >
                        <Ionicons name="qr-code-outline" size={24} />
                        <Text className="text-gray-700 font-semibold ml-2">
                            Scan QR Code
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* BOTTOM SIGNUP */}
                <View className="mb-10">
                    <Text className="text-center text-gray-600">
                        Don’t have an account yet?
                        <Link
                            href="/(auth)/signup"
                            className="text-blue-600 font-semibold"
                        >
                            {" "}Register
                        </Link>
                    </Text>
                </View>

            </View>
        </View>

    );
};

export default Login;
