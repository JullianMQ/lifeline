import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { login } from "../api/auth";
import { saveToken } from "../storage/session";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

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
        } catch (err: any) {
            console.log("LOGIN ERROR:", err);
            alert("Login failed: " + err.message);
        }
    };

    const handleGoogle = () => {
        console.log("Google OAuth pressed");
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
                    <Text className="text-3xl font-extrabold text-black">LOGIN</Text>
                </View>

                <TextInput
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    className="border border-black rounded-full px-4 py-3 mt-16 mb-6 h-16"
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <TextInput
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    className="border border-black rounded-full px-4 py-3 mb-6 h-16"
                />

                <TouchableOpacity
                    onPress={handleLogin}
                    className="bg-lifelineRed py-4 rounded-full mb-4"
                >
                    <Text className="text-center text-white font-semibold text-lg">
                        Login
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleGoogle}
                    className="border border-black py-4 mt-8 rounded-full mb-6 flex-row justify-center items-center"
                >
                    <Ionicons name="logo-google" size={24} />
                    <Text className="text-center text-gray-700 font-semibold ml-2">
                        Continue with Google
                    </Text>
                </TouchableOpacity>

                <Text className="text-center text-gray-600">
                    Don’t have an account yet?
                    <Link href="/(auth)/signup" className="text-blue-600 font-semibold">
                        {" "}
                        Register
                    </Link>
                </Text>
            </View>
        </View>
    );
};

export default Login;
