import React, { useEffect, useMemo, useRef, useCallback } from "react";
import {
    Animated,
    Image,
    Modal,
    Pressable,
    SafeAreaView,
    StatusBar,
    Text,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
    visible: boolean;
    callerName?: string;
    avatarUri?: string;
    onAnswer: () => void;
    onDecline: () => void;
    useModal?: boolean;


    autoAnswerAfterMs?: number;
};

export default function SosAlertCallScreen({
    visible,
    callerName = "Unknown",
    avatarUri,
    onAnswer,
    onDecline,
    useModal = true,
    autoAnswerAfterMs,
}: Props) {
    const pulse = useRef(new Animated.Value(0)).current;

    // prevent double actions (tap + auto, or multiple timers)
    const actedRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearAutoTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const safeAnswer = useCallback(() => {
        if (actedRef.current) return;
        actedRef.current = true;
        clearAutoTimer();
        onAnswer();
    }, [onAnswer, clearAutoTimer]);

    const safeDecline = useCallback(() => {
        if (actedRef.current) return;
        actedRef.current = true;
        clearAutoTimer();
        onDecline();
    }, [onDecline, clearAutoTimer]);

    // pulse animation
    useEffect(() => {
        if (!visible) return;

        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
            ])
        );

        loop.start();
        return () => loop.stop();
    }, [visible, pulse]);

    // auto-answer fallback
    useEffect(() => {

        if (!visible) {
            actedRef.current = false;
            clearAutoTimer();
            return;
        }

        actedRef.current = false;
        clearAutoTimer();

        if (typeof autoAnswerAfterMs === "number" && autoAnswerAfterMs > 0) {
            timerRef.current = setTimeout(() => {

                if (!actedRef.current) {
                    actedRef.current = true;
                    timerRef.current = null;
                    onAnswer();
                }
            }, autoAnswerAfterMs);
        }

        return () => {
            clearAutoTimer();
        };
    }, [visible, autoAnswerAfterMs, onAnswer, clearAutoTimer]);

    const pulseStyle = useMemo(() => {
        const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
        const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.05] });
        return { transform: [{ scale }], opacity };
    }, [pulse]);

    const initial = (callerName?.trim()?.[0] || "C").toUpperCase();

    const content = (
        <SafeAreaView className="flex-1 bg-[#2f2f2f]">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View className="flex-1 items-center justify-between px-6 pb-12">
                <View className="h-10" />

                <View className="items-center mt-0 mb-1">
                    <View className="items-center justify-center">
                        <Animated.View
                            style={pulseStyle}
                            className="absolute w-[180px] h-[180px] rounded-full bg-[#3aa6ff]"
                        />
                        <View className="w-[160px] h-[160px] rounded-full border-4 border-[#2fb3ff] bg-[#1f1f1f] items-center justify-center">
                            <View className="w-[150px] h-[150px] rounded-full overflow-hidden bg-[#2c2c2c] items-center justify-center">
                                {avatarUri ? (
                                    <Image source={{ uri: avatarUri }} className="w-full h-full" />
                                ) : (
                                    <Text className="text-white text-[28px] font-bold">{initial}</Text>
                                )}
                            </View>
                        </View>
                    </View>

                    <View className="items-center mt-6">
                        <Text className="text-white text-[44px] font-semibold">{callerName}</Text>
                        <Text className="text-white/65 text-[13px] mt-1">Incoming call</Text>

                        {typeof autoAnswerAfterMs === "number" && autoAnswerAfterMs > 0 ? (
                            <Text className="text-white/45 text-[12px] mt-2">
                                Auto-confirm in {Math.ceil(autoAnswerAfterMs / 1000)}s
                            </Text>
                        ) : null}
                    </View>
                </View>

                <View className="w-full flex-row justify-center px-6 gap-44">
                    <CallAction label="Answer" bg="#2ecc71" icon="call" onPress={safeAnswer} />
                    <CallAction
                        label="Decline"
                        bg="#e74c3c"
                        icon="call"
                        rotateHangup
                        onPress={safeDecline}
                    />
                </View>
            </View>
        </SafeAreaView>
    );

    if (!useModal) return visible ? content : null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            presentationStyle="fullScreen"
            statusBarTranslucent
            onRequestClose={safeDecline}
        >
            {content}
        </Modal>
    );
}

function CallAction({
    label,
    bg,
    icon,
    rotateHangup,
    onPress,
}: {
    label: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
    rotateHangup?: boolean;
    onPress: () => void;
}) {
    return (
        <View className="items-center">
            <Pressable
                onPress={onPress}
                android_ripple={{ color: "rgba(255,255,255,0.18)", borderless: true }}
                className="w-32 h-32 rounded-full items-center justify-center"
                style={{ backgroundColor: bg }}
            >
                <Ionicons
                    name={icon}
                    size={28}
                    color="#fff"
                    style={rotateHangup ? { transform: [{ rotate: "135deg" }] } : undefined}
                />
            </Pressable>
            <Text className="text-white/80 mt-3">{label}</Text>
        </View>
    );
}
