import React, { useContext } from "react"; // 1. Import useContext
import { useRouter } from "expo-router";
import { Image, View, TouchableOpacity, Text } from "react-native";
import { SensorContext } from "@/context/sensor_context";

const Landing = () => {
  const router = useRouter();

  // 3. Pull the start function from the context
  const { startMonitoring } = useContext(SensorContext);

  const handleStart = async () => {
    // 4. Trigger the background sensor logic
    await startMonitoring();

    // 5. Navigate to the next screen
    router.push("/home_page");
  };

  return (
    <View className="flex-1 justify-center items-center">
      <Image
        source={require("../../assets/images/lifeline_logo.png")}
        className="w-50 h-50 mb-4"
        resizeMode="contain"
      />

      <TouchableOpacity
        onPress={handleStart} // 6. Use the new handler
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