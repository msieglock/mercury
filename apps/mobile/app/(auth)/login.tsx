import React from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { signInWithGoogle, signInWithMicrosoft } from "@/lib/auth";

function OAuthButton({
  label,
  onPress,
  variant,
}: {
  label: string;
  onPress: () => void;
  variant: "google" | "microsoft";
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      className="w-full bg-surface border border-outlineVariant rounded-full py-4 px-6 flex-row items-center justify-center active:bg-surfaceContainerLow"
    >
      <View className="w-6 h-6 mr-3 items-center justify-center">
        {variant === "google" ? (
          <Text className="text-lg font-bold text-onSurface">G</Text>
        ) : (
          <Text className="text-lg font-bold text-onSurface">M</Text>
        )}
      </View>
      <Text className="text-onSurface text-base font-semibold">{label}</Text>
    </Pressable>
  );
}

export default function LoginScreen() {
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign-in error:", error);
    }
  };

  const handleMicrosoftSignIn = async () => {
    try {
      await signInWithMicrosoft();
    } catch (error) {
      console.error("Microsoft sign-in error:", error);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center px-8">
        {/* Logo */}
        <View className="items-center mb-16">
          <Text className="text-primary text-5xl font-bold tracking-tight">
            Mercury
          </Text>
          <View className="w-8 h-0.5 bg-primary mt-3 rounded-full" />
        </View>

        {/* Welcome text */}
        <View className="items-center mb-12">
          <Text className="text-onBackground text-2xl text-center mb-2 font-semibold">
            Welcome to Mercury
          </Text>
          <Text className="text-onSurfaceVariant text-base text-center leading-6">
            Your AI-powered command center
          </Text>
        </View>

        {/* Auth buttons */}
        <View className="gap-4">
          <OAuthButton
            label="Continue with Google"
            variant="google"
            onPress={handleGoogleSignIn}
          />
          <OAuthButton
            label="Continue with Microsoft"
            variant="microsoft"
            onPress={handleMicrosoftSignIn}
          />
        </View>

        {/* Footer */}
        <View className="mt-12 items-center">
          <Text className="text-outline text-xs text-center leading-5">
            By continuing, you agree to Mercury's{"\n"}Terms of Service and
            Privacy Policy
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
