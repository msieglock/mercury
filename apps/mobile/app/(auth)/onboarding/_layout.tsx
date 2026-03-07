import React from "react";
import { View } from "react-native";
import { Stack, useSegments } from "expo-router";

const ONBOARDING_STEPS = ["email", "linkedin", "mode", "sales-icp", "sales-discovery"];

function ProgressIndicator() {
  const segments = useSegments();
  const currentStep = segments[segments.length - 1] ?? "email";
  const mainSteps = ["email", "linkedin", "mode"];
  const currentIndex = mainSteps.indexOf(currentStep);
  const activeIndex = currentIndex >= 0 ? currentIndex : mainSteps.length;

  return (
    <View className="flex-row px-8 pt-4 pb-2 gap-2">
      {mainSteps.map((step, index) => (
        <View
          key={step}
          className={`flex-1 h-1 rounded-full ${
            index <= activeIndex ? "bg-primary" : "bg-outlineVariant"
          }`}
        />
      ))}
    </View>
  );
}

export default function OnboardingLayout() {
  return (
    <View className="flex-1 bg-background">
      <ProgressIndicator />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FEFBFF" },
          animation: "slide_from_right",
        }}
      />
    </View>
  );
}
