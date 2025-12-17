import { useFocusEffect } from "@react-navigation/native";
import React, { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, FlatList, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenWrapper from "../../components/screen_wrapper";
import { router } from "expo-router";
import { getContacts, Contact } from "@/lib/api/contact";

const ContactPage = () => {
    const [search, setSearch] = useState("");
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchContacts = async () => {
        setLoading(true);
        const data = await getContacts();
        setContacts(data);
        setLoading(false);
    };

    // Fetch on page focus
    useFocusEffect(
        useCallback(() => {
            fetchContacts();
        }, [])
    );

    const filteredContacts = contacts.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    const renderItem = ({ item }: { item: Contact }) => (
        <View className="flex-row items-center mb-4 px-5">
            <Image
                source={require("../../assets/images/user_placeholder.png")}
                className="w-10 h-10 rounded-full mr-3"
            />
            <Text className="text-lg">{item.name}</Text>
        </View>
    );

    const renderHeader = () => (
        <View className="flex-row items-center mb-4 px-5 pt-6">
            <View className="flex-1 flex-row items-center bg-white px-3 py-.5 rounded-full border-2 mr-3">
                <Ionicons name="search" size={20} color="black" />
                <TextInput
                    placeholder="Search"
                    value={search}
                    onChangeText={setSearch}
                    className="flex-1 ml-2"
                />
            </View>

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
            {loading ? (
                <ActivityIndicator size="large" color="#ff0000" className="mt-20" />
            ) : (
                <FlatList
                    data={filteredContacts}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    ListHeaderComponent={renderHeader}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={
                        <Text className="text-center mt-10 text-gray-500">
                            No contacts found.
                        </Text>
                    }
                />
            )}
        </ScreenWrapper>
    );
};

export default ContactPage;
