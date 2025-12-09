import React, { PropsWithChildren } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import TopNav from '../navigation/top_nav';
import BottomNav from '../navigation/bottom_nav';


const BOTTOM_NAV_PADDING = 100;


const ScreenWrapper: React.FC<PropsWithChildren> = ({ children }) => {
    return (
        <View style={styles.container}>
            <TopNav />


            <ScrollView contentContainerStyle={styles.content}>
                {children}
            </ScrollView>


            <BottomNav />
        </View>
    );
};

export default ScreenWrapper;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ECF0F3',
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: 10,
        paddingBottom: BOTTOM_NAV_PADDING,
    }
});