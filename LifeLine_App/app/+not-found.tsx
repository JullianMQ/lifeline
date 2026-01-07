import { Stack } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import React from 'react';

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: '404 - Not Found' }} />
            <View style={styles.container}>
                <Text style={styles.text}>404 - Page Not Found tes</Text>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
    }
});