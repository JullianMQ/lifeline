import React, { useState } from "react";
import { Text, ScrollView, TouchableOpacity, View } from "react-native";
import ScreenWrapper from "../../components/screen_wrapper";

const faqs = [
    {
        question: "Lorem ipsum dolor sit amet?",
        answer: "Morbi sollicitudin pretium eleifend. Maecenas ornare nisl nec.",
    },
    {
        question: "Consectetur adipiscing elit?",
        answer: "Duis porttitor odio odio.",
    },
    {
        question: "Lorem ipsum dolor sit amet?",
        answer: "Morbi sollicitudin pretium eleifend. Maecenas sit amet urna.",
    },
    {
        question: "Consectetur adipiscing elit?",
        answer: "Duis porttitor odio odio.",
    },
];

const FaqsPage = () => {
    const [openStates, setOpenStates] = useState(Array(faqs.length).fill(false));

    const toggleItem = (index: number) => {
        const newState = [...openStates];
        newState[index] = !newState[index];
        setOpenStates(newState);
    };

    return (
        <ScreenWrapper>
            <ScrollView className="flex-1 px-4 py-4 bg-[#EFF2F5]">
                {faqs.map((item, index) => {
                    const isOpen = openStates[index];

                    return (
                        <View key={index} className="mb-4">
                            {/* Question */}
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => toggleItem(index)}
                                className={`rounded-2xl p-4 border ${isOpen ? "border-lifelineRed" : "border-gray-300"
                                    } bg-white`}
                            >
                                <Text
                                    className="text-gray-700 font-semibold text-lg"
                                >
                                    {item.question}
                                </Text>
                            </TouchableOpacity>

                            {/* Answer */}
                            {isOpen && (
                                <View className="rounded-b-xl border border-gray-300 border-t-0 bg-white p-4">
                                    <Text className="text-gray-700">{item.answer}</Text>
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </ScreenWrapper>
    );
};

export default FaqsPage;
