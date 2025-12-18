import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { TouchableOpacity, View } from "react-native";

type RouteHref = "/home_page" | "/contact_page" | "/faqs_page" | "/menu_page";

const navItems: { name: string; href: RouteHref; icon: string; activeIcon?: string }[] = [
    { name: "Contacts", href: "/contact_page", icon: "people-outline" },
    { name: "Home", href: "/home_page", icon: "home-outline" },
    { name: "FAQs", href: "/faqs_page", icon: "information-circle-outline" },
    { name: "Menu", href: "/menu_page", icon: "menu-outline", activeIcon: "close-outline" },
];

const BottomNav = () => {
    const pathname = usePathname();
    const router = useRouter();

    const activeColor = "#DF3721";
    const inactiveColor = "black";

    return (
        <View className="absolute bottom-5 left-5 right-5 h-20 bg-white flex-row justify-around items-center rounded-2xl shadow-lg elevation-10 shadow-black/100">
            {navItems.map((item) => {
                const isMenu = item.name === "Menu";
                const iconName = isMenu && pathname === "/menu_page" ? item.activeIcon : item.icon;
                const isActive = pathname === item.href;
                const iconColor = isActive ? activeColor : inactiveColor;

                return (
                    <TouchableOpacity
                        key={item.href}
                        onPress={() => {
                            if (isMenu && pathname === "/menu_page") {

                                router.push("/home_page");
                            } else {

                                router.push(item.href);
                            }
                        }}
                    >
                        <Ionicons name={iconName as any} size={35} color={iconColor} />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

export default BottomNav;
