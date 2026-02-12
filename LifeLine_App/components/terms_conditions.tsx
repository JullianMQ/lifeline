import React from "react";
import {
    Modal,
    View,
    Text,
    Pressable,
    ScrollView,
    StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
    visible: boolean;
    accepted: boolean;
    onToggleAccepted: (v: boolean) => void;
    onClose: () => void;
};

export default function TermsConditionsModal({
    visible,
    accepted,
    onToggleAccepted,
    onClose,
}: Props) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <StatusBar barStyle="dark-content" backgroundColor="white" />
            <SafeAreaView
                style={{ flex: 1, backgroundColor: "white" }}
                edges={["top", "bottom"]}
            >
                {/* Header */}
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottomWidth: 1,
                        borderBottomColor: "#eee",
                        backgroundColor: "white",
                    }}
                >
                    <Text style={{ fontSize: 18, fontWeight: "800", color: "#111" }}>
                        TERMS AND CONDITIONS
                    </Text>

                    <Pressable
                        onPress={onClose}
                        hitSlop={10}
                        style={{ padding: 6, borderRadius: 999 }}
                    >
                        <Ionicons name="close" size={22} color="#111" />
                    </Pressable>
                </View>

                {/* Body */}
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
                >
                    <Text style={{ color: "#333", marginBottom: 10 }}>
                        <Text style={{ fontWeight: "700" }}>Last Updated:</Text> February 2026
                    </Text>

                    <Text style={{ color: "#333", lineHeight: 20, marginBottom: 16 }}>
                        Welcome to Lifeline. By accessing or using Lifeline, you agree to be
                        bound by these Terms and Conditions. If you do not agree with any part
                        of these Terms, please do not use the App.
                    </Text>

                    <Section title="ABOUT LIFELINE">
                        Lifeline is a support and assistance application designed to help users
                        notify their chosen emergency contacts when unusual or potentially
                        dangerous situations are detected. The App uses device sensors such as
                        the accelerometer, gyroscope, microphone, GPS, and camera to detect
                        anomalies like erratic or sudden movements.
                        {"\n\n"}
                        Lifeline is available through a mobile application and a web-based
                        dashboard and is developed and operated in the Philippines.
                    </Section>

                    <Section title="ELIGIBILITY">
                        Lifeline is intended for users 18 years old and above. Minors may use
                        the App only with the consent and supervision of a parent or legal
                        guardian.
                    </Section>

                    <Section title="USER ACCOUNTS">
                        To use Lifeline, users must create an account. The App collects the
                        following information:
                        {"\n\n"}
                        • Name{"\n"}• Email address{"\n"}• Phone number{"\n"}• Profile photo
                        (optional; default avatars are provided){"\n"}• Real-time location
                        data{"\n"}• Photo, video, and audio recordings{"\n\n"}
                        Users may be assigned different roles, such as mutual or dependent,
                        which determine how the App functions for them.
                    </Section>

                    <Section title="PURPOSE AND LIMITATIONS">
                        Lifeline is a support and assistance tool only. It does not replace
                        emergency services such as police, ambulance, or medical responders.
                    </Section>

                    <Section title="LOCATION AND EMERGENCY FEATURES">
                        Lifeline may track real-time location and share recordings with
                        emergency contacts when anomalies are detected.
                    </Section>

                    <Section title="USER RESPONSIBILITIES">
                        Users agree to use the App responsibly and understand that emergency
                        contacts are the primary responders.
                    </Section>

                    <Section title="DATA AND PRIVACY">
                        Lifeline processes user data only for its intended functionality and
                        does not sell user data.
                    </Section>

                    <Section title="ACCOUNT SUSPENSION AND TERMINATION">
                        The Lifeline team may suspend or terminate accounts for misuse.
                    </Section>

                    <Section title="LIABILITY AND DISCLAIMERS">
                        Lifeline is provided “as is” and users agree to use the App at their
                        own risk.
                    </Section>

                    <Section title="INTELLECTUAL PROPERTY">
                        Lifeline is a school capstone project developed by the Lifeline team.
                    </Section>

                    <Section title="UPDATES AND CHANGES">
                        Users will be notified of changes via email.
                    </Section>

                    <Section title="GOVERNING LAW">
                        These Terms are governed by the laws of the Republic of the
                        Philippines.
                    </Section>

                    <Section title="CONTACT INFORMATION">
                        For questions, contact the Lifeline development team.
                    </Section>
                </ScrollView>

                {/* Footer */}
                <View
                    style={{
                        padding: 16,
                        borderTopWidth: 1,
                        borderTopColor: "#eee",
                        backgroundColor: "white",
                    }}
                >
                    <Pressable
                        onPress={() => onToggleAccepted(!accepted)}
                        style={{ flexDirection: "row", alignItems: "center" }}
                    >
                        <Ionicons
                            name={accepted ? "checkbox" : "square-outline"}
                            size={22}
                            color={accepted ? "#DF3721" : "#666"}
                        />
                        <Text style={{ marginLeft: 10, color: "#222", flex: 1 }}>
                            I have read and agree to the Terms and Conditions.
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={onClose}
                        disabled={!accepted}
                        style={{
                            marginTop: 14,
                            paddingVertical: 14,
                            borderRadius: 999,
                            backgroundColor: accepted ? "#DF3721" : "#ccc",
                            alignItems: "center",
                        }}
                    >
                        <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
                            Done
                        </Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "900", color: "#111" }}>
                {title}
            </Text>
            <Text style={{ marginTop: 6, color: "#333", lineHeight: 20 }}>
                {children}
            </Text>
        </View>
    );
}
