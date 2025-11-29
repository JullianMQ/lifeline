import { Stack } from "expo-router";
import React from "react";
import BottomNav from "../navigation/bottom_nav";
import TopNav from "../navigation/top_nav";

export default function MainLayout() {
    return (
        <>
            <TopNav />
            <Stack screenOptions={{ headerShown: false }}>

            </Stack>
            <BottomNav />
        </>
    );
}
