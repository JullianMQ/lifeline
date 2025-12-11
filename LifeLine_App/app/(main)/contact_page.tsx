import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenWrapper from "../../components/screen_wrapper";
import { router } from "expo-router";

const dummyContacts = [
    { id: 1, name: "Renell Constantino" },
    { id: 2, name: "Chester Lance Cruz" },
    { id: 3, name: "Jullian Quiambao" },
    { id: 4, name: "Frances Tumampos" },
    { id: 5, name: "Uly Raymundo" },
];

const ContactPage = () => {
    const [search, setSearch] = useState("");

    // Filtered contacts
    const filteredContacts = dummyContacts.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    // Render each contact
    const renderItem = ({ item }: { item: typeof dummyContacts[0] }) => (
        <View className="flex-row items-center mb-4 px-5">
            <Image
                source={require("../../assets/images/user_placeholder.png")}
                className="w-10 h-10 rounded-full mr-3"
            />
            <Text className="text-lg">{item.name}</Text>
        </View>
    );


    // Header component 
    const renderHeader = () => (
        <View className="flex-row items-center mb-4 px-5 pt-6">
            {/* Search Bar */}
            <View className="flex-1 flex-row items-center bg-white px-3 py-.5 rounded-full border-2 mr-3">
                <Ionicons name="search" size={20} color="black" />
                <TextInput
                    placeholder="Search"
                    value={search}
                    onChangeText={setSearch}
                    className="flex-1 ml-2"
                />
            </View>

            {/* Add Button */}
            <TouchableOpacity
                onPress={() => router.push("/add_contact")}
                className="w-14 h-14 items-center justify-center"
            >
                <Ionicons name="add-circle-outline" size={40} color="#404040" />
            </TouchableOpacity>
        </View>
    );

    return (
        <ScreenWrapper scrollable={false}>
            <FlatList
                data={filteredContacts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={{ paddingBottom: 20 }}
            />

        </ScreenWrapper>
    );
};

export default ContactPage;
