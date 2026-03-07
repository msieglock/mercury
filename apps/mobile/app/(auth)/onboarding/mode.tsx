import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface ModeOption {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

const modes: ModeOption[] = [
  {
    id: "sales",
    emoji: "\uD83D\uDCB0",
    title: "Close deals",
    description:
      "AI-powered pipeline management, lead scoring, and automated outreach for sales professionals.",
  },
  {
    id: "recruit",
    emoji: "\uD83E\uDDD1\u200D\uD83D\uDCBC",
    title: "Hire talent",
    description:
      "Candidate sourcing, automated follow-ups, and interview coordination for recruiters.",
  },
  {
    id: "inbox",
    emoji: "\uD83D\uDCEC",
    title: "Manage messages",
    description:
      "Smart inbox management, auto-drafting, and priority sorting for busy professionals.",
  },
];

export default function OnboardingModeScreen() {
  const router = useRouter();
  const [selectedModes, setSelectedModes] = useState<string[]>([]);

  const toggleMode = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedModes((prev) =>
      prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id]
    );
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedModes.includes("sales")) {
      router.push("/(auth)/onboarding/sales-icp");
    } else {
      router.replace("/(tabs)/today");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        className="px-8"
      >
        <View className="items-center mb-10">
          <Text className="text-onBackground text-2xl text-center mb-2 font-semibold">
            How will you use Mercury?
          </Text>
          <Text className="text-onSurfaceVariant text-base text-center leading-6">
            Select one or more. You can always{"\n"}change this later.
          </Text>
        </View>

        <View className="gap-4 mb-8">
          {modes.map((mode) => {
            const isSelected = selectedModes.includes(mode.id);
            return (
              <Pressable
                key={mode.id}
                onPress={() => toggleMode(mode.id)}
                className={`bg-surfaceContainerLow rounded-2xl p-5 border-2 active:opacity-90 ${
                  isSelected ? "border-primary" : "border-transparent"
                }`}
                style={{
                  shadowColor: "#1B1B1F",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Text className="text-3xl mb-2">{mode.emoji}</Text>
                <Text className="text-onSurface text-lg font-semibold mb-1">
                  {mode.title}
                </Text>
                <Text className="text-onSurfaceVariant text-sm leading-5">
                  {mode.description}
                </Text>
                {isSelected && (
                  <View className="absolute top-4 right-4 w-6 h-6 bg-primary rounded-full items-center justify-center">
                    <Text className="text-onPrimary text-xs font-bold">
                      {"\u2713"}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleContinue}
          disabled={selectedModes.length === 0}
          className={`py-4 rounded-full items-center ${
            selectedModes.length > 0 ? "bg-primary active:opacity-80" : "bg-surfaceContainerHigh"
          }`}
        >
          <Text
            className={`text-base font-semibold ${
              selectedModes.length > 0 ? "text-onPrimary" : "text-outline"
            }`}
          >
            Continue
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
