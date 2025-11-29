// app/_layout.tsx
import { Drawer } from "expo-router/drawer";
import "./globals.css";
import CustomDrawer from "./navigation/custom_drawer";

export default function RootLayout() {
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawer {...props} />}
      initialRouteName="landing"
      screenOptions={{
        headerShown: false,
        drawerPosition: "right",
      }}
    >

      <Drawer.Screen name="landing" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="(main)" options={{ drawerItemStyle: { display: "none" } }} />
    </Drawer>
  );
}
