import { useRouter } from "expo-router";
import { Image, View, TouchableOpacity, Text } from "react-native";

const Landing = () => {
  const router = useRouter();

  return (
    <View className="flex-1 justify-center items-center">
      <Image
        source={require("../assets/images/lifeline_logo.png")}
        className="w-50 h-50 mb-4"
        resizeMode="contain"
      />

      <TouchableOpacity
        onPress={() => router.push("/home_page")}
        className="bg-black w-3/4 py-6 rounded-full"
      >
        <Text className="text-white text-2xl font-semibold text-center">
          Start Monitoring
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default Landing;
