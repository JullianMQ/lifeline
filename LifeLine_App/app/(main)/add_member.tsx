import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { TouchableOpacity, Image } from "react-native";
import { router } from "expo-router";
const AddMember = () => {
    return (
        <View className="flex-1 bg-white items-center pt-32">
            <View className="w-3/4 flex-1 justify-between">

                {/* TOP CONTENT */}

                <View className='items-center mb-8'>
                    <Text className="text-3xl font-extrabold">
                        Add a family member
                    </Text>
                    <Image
                        source={require("../../assets/images/AddMember.png")}
                        className="w-100 h-100 mt-8"
                        resizeMode="contain"
                    />
                    <Text className='text-2xl text-center font-bold'>
                        Connect with your emergency contacts now
                    </Text>
                </View>


                {/* BOTTOM BUTTONS */}
                <View className="mb-10">
                    {/* Add */}
                    <TouchableOpacity
                        onPress={() => router.push("/(main)/select_role")}
                        className="bg-lifelineRed py-4 rounded-full mb-4"
                    >
                        <Text className="text-center text-white font-semibold text-lg">
                            Create New
                        </Text>
                    </TouchableOpacity>

                    {/* Skip */}
                    <TouchableOpacity
                        onPress={() => router.push("/(main)/add_member_existing")}
                        className="border-2 border-black py-4 mt-2 rounded-full flex-row justify-center items-center"
                    >
                        <Text className="text-center text-black font-semibold text-lg">
                            Add Existing
                        </Text>
                    </TouchableOpacity>
                </View>

            </View>
        </View>
    )
}

export default AddMember

const styles = StyleSheet.create({})