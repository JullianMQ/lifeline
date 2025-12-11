import React, { PropsWithChildren } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import TopNav from '../app/navigation/top_nav';
import BottomNav from '../app/navigation/bottom_nav';

const BOTTOM_NAV_PADDING = 100;

interface ScreenWrapperProps {
    showBottomNav?: boolean;
    topNavProps?: { backButtonOnly?: boolean; onBackPress?: () => void };
    scrollable?: boolean; // new prop
}

const ScreenWrapper: React.FC<PropsWithChildren<ScreenWrapperProps>> = ({
    children,
    showBottomNav = true,
    topNavProps,
    scrollable = true,
}) => {
    return (
        <View style={styles.container}>
            <TopNav {...topNavProps} />

            {scrollable ? (
                <ScrollView
                    contentContainerStyle={[
                        styles.content,
                        { paddingBottom: showBottomNav ? BOTTOM_NAV_PADDING : 20 },
                    ]}
                >
                    {children}
                </ScrollView>
            ) : (
                <View style={[styles.content, { flex: 1 }]}>{children}</View>
            )}

            {showBottomNav && <BottomNav />}
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
    },
});
