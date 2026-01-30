import { useFocusEffect } from "@react-navigation/native";
import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenWrapper from "../../components/screen_wrapper";
import { router } from "expo-router";
import { getContacts, Contact } from "@/lib/api/contact";

const RenderHeader = ({
  search,
  setSearch,
}: {
  search: string;
  setSearch: (text: string) => void;
}) => (
  <View className="flex-row items-center mb-4 px-5 pt-6">
    <View className="flex-1 flex-row items-center px-3 py-.5 rounded-full border-2 mr-3">
      <Ionicons name="search" size={20} color="black" />
      <TextInput
        placeholder="Search"
        value={search}
        onChangeText={setSearch}
        className="flex-1 ml-2 text-xl"
        blurOnSubmit={false}
        keyboardType="default"
        returnKeyType="done"
      />
    </View>

    <TouchableOpacity
      onPress={() => router.push("/(auth)/add_member_existing")}
      className="w-14 h-14 items-center justify-center"
    >
      <Ionicons name="add-circle-outline" size={40} color="#404040" />
    </TouchableOpacity>
  </View>
);

const ContactRow = ({ item }: { item: Contact }) => (
  <View className="flex-row items-center mb-4 px-5">
    <Image
      source={require("../../assets/images/user_placeholder.png")}
      className="w-10 h-10 rounded-full mr-3"
    />
    <Text className="text-lg">{item.name}</Text>
  </View>
);

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

  useFocusEffect(
    useCallback(() => {
      fetchContacts();
    }, [])
  );

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return contacts.filter(
      (c) => typeof c.name === "string" && c.name.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const mutualContacts = useMemo(
    () => filteredContacts.filter((c) => c.role === "mutual"),
    [filteredContacts]
  );

  const dependentContacts = useMemo(
    () => filteredContacts.filter((c) => c.role === "dependent"),
    [filteredContacts]
  );

  return (
    <ScreenWrapper scrollable={false}>
      {loading ? (
        <ActivityIndicator size="large" color="#ff0000" className="mt-20" />
      ) : (
        <FlatList
          data={[]} // keep FlatList for scrolling only
          keyExtractor={(_, i) => String(i)}
          renderItem={null as any}
          ListHeaderComponent={
            <View>
              <RenderHeader search={search} setSearch={setSearch} />

              {/* MUTUAL */}
              {mutualContacts.length > 0 && (
                <>
                  <Text className="px-5 mb-2 font-bold text-lg">Mutual</Text>
                  {mutualContacts.map((c) => (
                    <ContactRow key={c.id} item={c} />
                  ))}
                </>
              )}

              {/* DEPENDENT */}
              {dependentContacts.length > 0 && (
                <>
                  <Text className="px-5 mb-2 font-bold text-lg">Dependent</Text>
                  {dependentContacts.map((c) => (
                    <ContactRow key={c.id} item={c} />
                  ))}
                </>
              )}

              {/* EMPTY */}
              {mutualContacts.length === 0 && dependentContacts.length === 0 && (
                <View className="items-center mt-10">
                  <Text className="text-gray-500 text-center">
                    No contacts found.
                  </Text>
                  <Text className="text-yellow-1000 mt-2">Add now!</Text>
                </View>
              )}
            </View>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </ScreenWrapper>
  );
};

export default ContactPage;
