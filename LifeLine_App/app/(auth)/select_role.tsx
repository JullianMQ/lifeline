import React, { useRef, useState } from "react";
import { View, Text, Image, Pressable, Animated, Alert } from "react-native";
import SvgChild from "../../assets/svg/components/Child";
import SvgParent from "../../assets/svg/components/Parent";
import { useRouter } from "expo-router";

const SelectRole: React.FC = () => {
    const router = useRouter();
    const [selectedRole, setSelectedRole] = useState<"child" | "parent" | null>(null);

    const childScale = useRef(new Animated.Value(1)).current;
    const parentScale = useRef(new Animated.Value(1)).current;

    const handlePress = (role: "child" | "parent") => {
        setSelectedRole(role);

        const scaleAnim = role === "child" ? childScale : parentScale;
        const otherScaleAnim = role === "child" ? parentScale : childScale;

        Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: true }).start();
        Animated.spring(otherScaleAnim, { toValue: 1, useNativeDriver: true }).start();
    };

    const handleNext = async () => {
        if (!selectedRole) {
            Alert.alert("Please select a role");
            return;
        }

        console.log("Selected role:", selectedRole);


        try {

            if (selectedRole === "child") router.push("/(auth)/child_info");
            else router.push("/(auth)/parent_info");

        } catch (err) {
            console.error("Error sending role to API:", err);
            Alert.alert("Error", "Failed to save role. Try again.");
        }
    };

    return (
        <View className="flex-1 bg-gray-200 items-center pt-20">
            <View className="items-center mb-10">
                <Image
                    source={require("../../assets/images/LifelineLogo.png")}
                    className="w-28 h-28"
                    resizeMode="contain"
                />
                <Text className="text-3xl font-extrabold text-black mt-2">SIGN UP</Text>
            </View>

            <Text className="text-2xl mb-6">Are you a?</Text>

            <View className="flex-row mb-8 justify-center space-x-12">
                <Pressable onPress={() => handlePress("child")}>
                    <Animated.View style={{ transform: [{ scale: childScale }], alignItems: "center" }}>
                        <View>
                            <SvgChild width={128} height={128} />
                        </View>
                        <Text className="text-lg mt-2 font-medium text-center">Child</Text>
                    </Animated.View>
                </Pressable>

                <Pressable onPress={() => handlePress("parent")}>
                    <Animated.View style={{ transform: [{ scale: parentScale }], alignItems: "center" }}>
                        <View>
                            <SvgParent width={128} height={128} />
                        </View>
                        <Text className="text-lg mt-2 font-medium text-center">Parent</Text>
                    </Animated.View>
                </Pressable>
            </View>

            <View className="flex-1 justify-end w-3/4 mb-10">
                <Pressable
                    onPress={handleNext}
                    className={`py-4 rounded-full items-center ${selectedRole ? "bg-lifelineRed" : "bg-gray-400"}`}
                    disabled={!selectedRole}
                >
                    <Text className="text-white text-lg font-semibold">Next</Text>
                </Pressable>

                <Pressable
                    onPress={() => router.back()}
                    className="bg-white border border-black py-4 rounded-full items-center mt-6"
                >
                    <Text className="text-black text-lg font-semibold">Back</Text>
                </Pressable>
            </View>
        </View>
    );
};

export default SelectRole;
