import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../components/screen_wrapper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Notification {
    id: number;
    message: string;
    read: boolean;
}

const dummyNotifs: Notification[] = [
    { id: 1, message: "Renell Constantino added you as emergency contact.", read: false },
    { id: 2, message: "Chester Lance added you as emergency contact.", read: false },
    { id: 3, message: "Is this you? Login detected.", read: true },
];

const NotifPage = () => {
    const [notifs, setNotifs] = useState<Notification[]>(dummyNotifs);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const handleSelect = (id: number) => {
        setSelectedId(selectedId === id ? null : id);
    };

    const handleDelete = (id: number) => {
        setNotifs(prev => prev.filter(n => n.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const renderItem = ({ item }: { item: Notification }) => {
        const isSelected = item.id === selectedId;

        return (
            <TouchableOpacity
                onPress={() => handleSelect(item.id)}
                className={`flex-row items-center justify-between border-2 rounded-xl p-4 bg-white ${isSelected ? 'border-lifelineRed' : 'border-gray-300'}`}
            >
                <Text className="flex-1 text-gray-600 text-base">{item.message}</Text>
                {isSelected && (
                    <TouchableOpacity onPress={() => handleDelete(item.id)}>
                        <Ionicons name="close-outline" size={24} s />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <ScreenWrapper scrollable={false}
            topNavProps={{
                backButtonOnly: true,
                onBackPress: () => router.back(),
            }}
        >
            <FlatList
                data={notifs}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16 }}
                ItemSeparatorComponent={() => <View className="h-3" />}
            />
        </ScreenWrapper>
    );
};

export default NotifPage;
