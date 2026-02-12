import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
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
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

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

    // ringtone
    const ringtoneSource = useMemo(
        () => require("../assets/sounds/lifeline-ringtone.mp3"),
        []
    );
    const playerOptions = useMemo(() => ({ downloadFirst: true }), []);
    const player = useAudioPlayer(ringtoneSource, playerOptions);

    // prevent double actions (tap + auto)
    const actedRef = useRef(false);
    const prevVisibleRef = useRef<boolean>(false);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // live countdown
    const [remainingMs, setRemainingMs] = useState<number>(0);

    const clearAutoTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const clearCountdownInterval = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const stopRingtone = useCallback(async () => {
        try {
            player.pause();
        } catch {
            // ignore
        }
        // seekTo may reject; consume it
        Promise.resolve(player.seekTo(0)).catch(() => { });
    }, [player]);

    const safeAnswer = useCallback(async () => {
        if (actedRef.current) return;
        actedRef.current = true;

        clearAutoTimer();
        clearCountdownInterval();

        await stopRingtone();
        onAnswer();
    }, [onAnswer, clearAutoTimer, clearCountdownInterval, stopRingtone]);

    const safeDecline = useCallback(async () => {
        if (actedRef.current) return;
        actedRef.current = true;

        clearAutoTimer();
        clearCountdownInterval();

        await stopRingtone();
        onDecline();
    }, [onDecline, clearAutoTimer, clearCountdownInterval, stopRingtone]);

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

    // ringtone: play while visible, stop + rewind when hidden
    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!visible) {
                await stopRingtone();
                return;
            }

            try {
                await setAudioModeAsync({
                    interruptionMode: "doNotMix",
                    shouldPlayInBackground: true,
                });

                if (cancelled) return;

                player.loop = true;
                player.volume = 1.0;

                // start from beginning; consume rejection
                await Promise.resolve(player.seekTo(0)).catch(() => { });
                player.play();
            } catch {
                // ignore
            }
        };

        run();

        return () => {
            cancelled = true;
            try {
                player.pause();
            } catch { }
            player.seekTo(0).catch(() => { });
        };
    }, [visible, player, stopRingtone]);

    // auto-answer fallback + live countdown
    useEffect(() => {
        const prevVisible = prevVisibleRef.current;

        // when hidden: clear timers/intervals
        if (!visible) {
            clearAutoTimer();
            clearCountdownInterval();
            setRemainingMs(0);
            prevVisibleRef.current = visible;
            return;
        }

        // only reset actedRef when transitioning false -> true
        if (!prevVisible && visible) {
            actedRef.current = false;
        }

        clearAutoTimer();
        clearCountdownInterval();

        if (typeof autoAnswerAfterMs === "number" && autoAnswerAfterMs > 0) {
            const deadline = Date.now() + autoAnswerAfterMs;

            setRemainingMs(autoAnswerAfterMs);

            // live countdown ticker
            intervalRef.current = setInterval(() => {
                const msLeft = Math.max(0, deadline - Date.now());
                setRemainingMs(msLeft);

                if (msLeft <= 0) {
                    clearCountdownInterval();
                }
            }, 250);

            // auto-answer timer
            timerRef.current = setTimeout(() => {
                void safeAnswer();
            }, autoAnswerAfterMs);
        } else {
            setRemainingMs(0);
        }

        prevVisibleRef.current = visible;

        return () => {
            clearAutoTimer();
            clearCountdownInterval();
        };
    }, [
        visible,
        autoAnswerAfterMs,
        safeAnswer,
        clearAutoTimer,
        clearCountdownInterval,
    ]);

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
                                Auto-confirm in {Math.ceil(remainingMs / 1000)}s
                            </Text>
                        ) : null}
                    </View>
                </View>

                <View className="w-full flex-row justify-center px-6 gap-44">
                    <CallAction label="Answer" bg="#2ecc71" icon="call" onPress={() => void safeAnswer()} />
                    <CallAction
                        label="Decline"
                        bg="#e74c3c"
                        icon="call"
                        rotateHangup
                        onPress={() => void safeDecline()}
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
            onRequestClose={() => void safeDecline()}
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
