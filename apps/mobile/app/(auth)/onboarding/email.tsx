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
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="flex-1 justify-center px-8">
        <View className="items-center mb-10">
          <View className="w-16 h-16 bg-primaryContainer rounded-full items-center justify-center mb-5">
            <Mail size={28} color="#1A237E" />
          </View>
          <Text className="text-onBackground text-2xl text-center mb-2 font-semibold">
            Link your email
          </Text>
          <Text className="text-onSurfaceVariant text-base text-center leading-6">
            Mercury learns your communication style{"\n"}from your existing
            emails.
          </Text>
        </View>

        {isLinking && (
          <View className="items-center mb-8">
            <PulsingDots message="Training your AI voice..." />
            <View className="w-48 h-1.5 bg-surfaceContainerHigh rounded-full mt-4 overflow-hidden">
              <View className="h-full bg-primary rounded-full w-1/3" />
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
              className="w-full bg-surface border border-outlineVariant rounded-2xl py-4 px-6 flex-row items-center justify-center active:bg-surfaceContainerLow"
            >
              <Text className="text-lg font-bold text-onSurface mr-3">G</Text>
              <Text className="text-onSurface text-base font-semibold">
                Google Workspace
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleLinkEmail("microsoft")}
              className="w-full bg-surface border border-outlineVariant rounded-2xl py-4 px-6 flex-row items-center justify-center active:bg-surfaceContainerLow"
            >
              <Text className="text-lg font-bold text-onSurface mr-3">M</Text>
              <Text className="text-onSurface text-base font-semibold">
                Microsoft 365
              </Text>
            </Pressable>
          </View>
        )}

        {isLinked && (
          <Pressable
            onPress={handleContinue}
            className="bg-primary py-4 rounded-full items-center active:opacity-80 mt-4"
          >
            <Text className="text-onPrimary text-base font-semibold">Continue</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
