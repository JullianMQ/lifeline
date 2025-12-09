import React from "react";
import { View } from "react-native";
import { Drawer } from "expo-router/drawer";
import BottomNav from "../navigation/bottom_nav";
import CustomDrawer from "../navigation/custom_drawer";

const MainLayout: React.FC = () => {
    return (
        <View className="flex-1">
            <Drawer
                drawerContent={(props) => <CustomDrawer {...props} />}
                screenOptions={{
                    headerShown: false,
                    drawerPosition: "right",
                }}
            >

                <Drawer.Screen name="home_page" />
                <Drawer.Screen name="contact_page" />
                <Drawer.Screen name="faqs_page" />
                <BottomNav />
            </Drawer>



        </View>
    );
};

export default MainLayout;
