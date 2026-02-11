import React, { useRef, useState } from "react";
import { View, Text, Pressable, Animated, Alert } from "react-native";
import SvgChild from "../../assets/svg/components/Child";
import SvgParent from "../../assets/svg/components/Parent";
import { useRouter } from "expo-router";

type MemberRole = "mutual" | "dependent";

const SelectRole: React.FC = () => {
    const router = useRouter();
    const [selectedRole, setSelectedRole] = useState<MemberRole | null>(null);

    const mutualScale = useRef(new Animated.Value(1)).current;
    const dependentScale = useRef(new Animated.Value(1)).current;

    const handlePress = (role: MemberRole) => {
        setSelectedRole(role);

        const activeScale = role === "mutual" ? mutualScale : dependentScale;
        const inactiveScale = role === "mutual" ? dependentScale : mutualScale;

        Animated.spring(activeScale, {
            toValue: 1.2,
            useNativeDriver: true,
        }).start();

        Animated.spring(inactiveScale, {
            toValue: 1,
            useNativeDriver: true,
        }).start();
    };

    const handleNext = () => {
        if (!selectedRole) {
            Alert.alert("Please select a role");
            return;
        }

        router.push({
            pathname: "/(main)/member_signup",
            params: { role: selectedRole },
        });
    };

    return (
        <View className="flex-1 items-center pt-20">

            <Text className="text-2xl font-extrabold mb-6 mt-10">
                Select a role for the member
            </Text>

            <View className="flex-row justify-center gap-x-10 mt-10">

                {/* Dependent */}
                <Pressable onPress={() => handlePress("mutual")}>
                    <Animated.View
                        style={{
                            transform: [{ scale: mutualScale }],
                            alignItems: "center",
                        }}
                    >
                        <SvgParent width={128} height={128} />
                        <Text className="text-lg mt-2 font-extrabold text-gray-700">
                            Mutual
                        </Text>
                    </Animated.View>
                </Pressable>

                {/* Mutual */}
                <Pressable onPress={() => handlePress("dependent")}>
                    <Animated.View
                        style={{
                            transform: [{ scale: dependentScale }],
                            alignItems: "center",
                        }}
                    >
                        <SvgChild width={128} height={128} />
                        <Text className="text-lg mt-2 font-extrabold text-gray-700">
                            Dependent
                        </Text>
                    </Animated.View>
                </Pressable>

            </View>

            <View className="flex-1 justify-end w-3/4 mb-10">

                <Pressable
                    onPress={handleNext}
                    disabled={!selectedRole}
                    className={`py-4 rounded-full items-center ${selectedRole ? "bg-lifelineRed" : "bg-gray-400"
                        }`}
                >
                    <Text className="text-white text-lg font-semibold">
                        Next
                    </Text>
                </Pressable>

                <Pressable
                    onPress={() => router.back()}
                    className="bg-white border border-black py-4 rounded-full items-center mt-6"
                >
                    <Text className="text-black text-lg font-semibold">
                        Back
                    </Text>
                </Pressable>

            </View>
        </View>
    );
};

export default SelectRole;
