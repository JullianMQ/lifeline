import { Link } from "expo-router";
import { Image, View } from "react-native";

const landing = () => {
  return (
    <View className="flex-1 justify-between items-center pb-32 pt-32">

      <View className="items-center">
        <Image
          source={require("../assets/images/lifeline_logo.png")}
          className="w-50 h-50 mb-4"
          resizeMode="contain"
        />
      </View>


      <Link
        href="/home_page"
        className="bg-black w-3/4 py-6 rounded-3xl text-white text-2xl font-semibold text-center"
      >
        Start Monitoring
      </Link>

    </View>
  );
};

export default landing;
