import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Linkedin, Upload, Loader2 } from "lucide-react-native";

export default function OnboardingLinkedInScreen() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);

  const handleUploadCSV = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsUploading(true);

    // Simulate file upload
    setTimeout(() => {
      setIsUploaded(true);
      setIsUploading(false);
    }, 2000);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/onboarding/mode");
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/onboarding/mode");
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["bottom"]}>
      <View className="flex-1 justify-center px-8">
        <View className="items-center mb-10">
          <View className="w-16 h-16 bg-blue-50 rounded-full items-center justify-center mb-5">
            <Linkedin size={28} color="#0A66C2" />
          </View>
          <Text className="text-charcoal text-2xl font-serif text-center mb-2">
            Import your network
          </Text>
          <Text className="text-warm-500 text-base text-center leading-6">
            Upload your LinkedIn connections{"\n"}to unlock warm introductions.
          </Text>
        </View>

        {!isUploading && !isUploaded && (
          <Pressable
            onPress={handleUploadCSV}
            className="w-full bg-white border-2 border-dashed border-warm-300 rounded-2xl py-8 items-center active:bg-warm-50"
          >
            <Upload size={32} color="#98917F" />
            <Text className="text-charcoal text-base font-semibold mt-3">
              Upload LinkedIn CSV
            </Text>
            <Text className="text-warm-500 text-sm mt-1">
              Export from LinkedIn Settings
            </Text>
          </Pressable>
        )}

        {isUploading && (
          <View className="w-full bg-white border border-warm-200 rounded-2xl py-8 items-center">
            <Loader2 size={32} color="#D4552A" />
            <Text className="text-charcoal text-base font-semibold mt-3">
              Processing contacts...
            </Text>
          </View>
        )}

        {isUploaded && (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 items-center">
            <Text className="text-green-800 font-semibold text-sm">
              Network imported successfully
            </Text>
            <Text className="text-green-600 text-xs mt-1">
              247 connections found
            </Text>
          </View>
        )}

        {/* Background activity indicator */}
        <View className="flex-row items-center justify-center mt-6 gap-2">
          <View className="w-2 h-2 bg-green-500 rounded-full" />
          <Text className="text-warm-500 text-xs">
            Working in background...
          </Text>
        </View>

        <View className="mt-8 gap-3">
          {isUploaded && (
            <Pressable
              onPress={handleContinue}
              className="bg-sienna py-4 rounded-2xl items-center active:opacity-80"
            >
              <Text className="text-white text-base font-semibold">
                Continue
              </Text>
            </Pressable>
          )}
          {!isUploaded && (
            <Pressable
              onPress={handleSkip}
              className="py-4 items-center active:opacity-60"
            >
              <Text className="text-warm-500 text-base font-medium">
                Skip for now
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
