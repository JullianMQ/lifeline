import React, { useState } from "react";
import { Text, ScrollView, TouchableOpacity } from "react-native";
import ScreenWrapper from "../components/screen_wrapper";

const faqs = [
    {
        question: "Lorem ipsum dolor sit amet?",
        answer:
            "Morbi sollicitudin pretium eleifend. Maecenas ornare nisl nec.",
    },
    {
        question: "Consectetur adipiscing elit?",
        answer: "Duis porttitor odio odio.",
    },
    {
        question: "Lorem ipsum dolor sit amet?",
        answer:
            "Morbi sollicitudin pretium eleifend. Maecenas sit amet urna.",
    },
    {
        question: "Consectetur adipiscing elit?",
        answer: "Duis porttitor odio odio.",
    },
];

const FaqsPage = () => {
    const [openStates, setOpenStates] = useState(
        Array(faqs.length).fill(false)
    );

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
                        <TouchableOpacity
                            key={index}
                            activeOpacity={0.7}
                            onPress={() => toggleItem(index)}
                            className={`rounded-xl p-4 mb-4 bg-white border 
                ${isOpen ? "border-lifelineRed" : "border-gray-300"}`}
                        >
                            <Text
                                className={`text-lg font-semibold mb-2 ${isOpen ? "text-lifelineRed" : "text-black"
                                    }`}
                            >
                                {item.question}
                            </Text>

                            {/* Answer */}
                            {isOpen && (
                                <Text className="text-gray-700">
                                    {item.answer}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </ScreenWrapper>
    );
};

export default FaqsPage;
