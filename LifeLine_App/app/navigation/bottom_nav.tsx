import { Ionicons } from "@expo/vector-icons";
import { useDrawerStatus } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { Link, usePathname } from "expo-router";
import React from "react";
import { TouchableOpacity, View } from "react-native";

type RouteHref = "/home_page" | "/contact_page" | "/faqs_page" | "/menu_page";

const navItems: { name: string; href: RouteHref; icon: string }[] = [
    { name: "Contacts", href: "/contact_page", icon: "people-outline" },
    { name: "Home", href: "/home_page", icon: "home-outline" },
    { name: "FAQs", href: "/faqs_page", icon: "information-circle-outline" },
];

const BottomNav = () => {
    const pathname = usePathname();
    const navigation = useNavigation<any>();
    const drawerStatus = useDrawerStatus();

    const activeColor = "#DF3721";
    const inactiveColor = "black";

    return (
        <View className="absolute bottom-5 left-5 right-5 h-20 bg-white flex-row justify-around items-center rounded-2xl shadow-lg elevation-10 shadow-black/100">
            {navItems.map((item) => (
                <Link key={item.href} href={item.href} asChild>
                    <TouchableOpacity>
                        <Ionicons
                            name={item.icon as any}
                            size={35}
                            color={pathname === item.href ? activeColor : inactiveColor}
                        />
                    </TouchableOpacity>
                </Link>
            ))}

            {/* State of drawer */}
            <TouchableOpacity onPress={() => navigation.openDrawer()}>
                <Ionicons
                    name="menu-outline"
                    size={40}
                    color={drawerStatus === "open" ? activeColor : inactiveColor}
                />
            </TouchableOpacity>
        </View>
    );
};

export default BottomNav;
