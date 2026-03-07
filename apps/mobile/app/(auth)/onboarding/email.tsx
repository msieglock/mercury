import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Mail } from "lucide-react-native";
import { PulsingDots } from "@/components/LoadingSpinner";

export default function OnboardingEmailScreen() {
  const router = useRouter();
  const [isLinking, setIsLinking] = useState(false);
  const [isLinked, setIsLinked] = useState(false);

  const handleLinkEmail = async (provider: "google" | "microsoft") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLinking(true);

    // Simulate linking and background processing
    setTimeout(() => {
      setIsLinked(true);
      setIsLinking(false);
    }, 3000);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/onboarding/linkedin");
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["bottom"]}>
      <View className="flex-1 justify-center px-8">
        <View className="items-center mb-10">
          <View className="w-16 h-16 bg-sienna-50 rounded-full items-center justify-center mb-5">
            <Mail size={28} color="#D4552A" />
          </View>
          <Text className="text-charcoal text-2xl font-serif text-center mb-2">
            Link your email
          </Text>
          <Text className="text-warm-500 text-base text-center leading-6">
            Mercury learns your communication style{"\n"}from your existing
            emails.
          </Text>
        </View>

        {isLinking && (
          <View className="items-center mb-8">
            <PulsingDots message="Training your AI voice..." />
            <View className="w-48 h-1.5 bg-warm-100 rounded-full mt-4 overflow-hidden">
              <View className="h-full bg-sienna rounded-full w-1/3" />
            </View>
          </View>
        )}

        {isLinked && (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 items-center">
            <Text className="text-green-800 font-semibold text-sm">
              Email connected successfully
            </Text>
            <Text className="text-green-600 text-xs mt-1">
              AI voice training in progress...
            </Text>
          </View>
        )}

        {!isLinking && !isLinked && (
          <View className="gap-4">
            <Pressable
              onPress={() => handleLinkEmail("google")}
              className="w-full bg-white border border-warm-200 rounded-2xl py-4 px-6 flex-row items-center justify-center active:bg-warm-50"
            >
              <Text className="text-lg font-bold text-charcoal mr-3">G</Text>
              <Text className="text-charcoal text-base font-semibold">
                Google Workspace
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleLinkEmail("microsoft")}
              className="w-full bg-white border border-warm-200 rounded-2xl py-4 px-6 flex-row items-center justify-center active:bg-warm-50"
            >
              <Text className="text-lg font-bold text-charcoal mr-3">M</Text>
              <Text className="text-charcoal text-base font-semibold">
                Microsoft 365
              </Text>
            </Pressable>
          </View>
        )}

        {isLinked && (
          <Pressable
            onPress={handleContinue}
            className="bg-sienna py-4 rounded-2xl items-center active:opacity-80 mt-4"
          >
            <Text className="text-white text-base font-semibold">Continue</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
