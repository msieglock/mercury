import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeInRight,
} from "react-native-reanimated";
import { Flame, Route, Sparkles, ArrowRight } from "lucide-react-native";
import { PulsingDots } from "@/components/LoadingSpinner";

interface DiscoveryResult {
  name: string;
  company: string;
  detail: string;
}

interface DiscoverySection {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  results: DiscoveryResult[];
}

const mockSections: DiscoverySection[] = [
  {
    title: "Warm leads that went cold",
    subtitle: "Conversations from the past 90 days",
    icon: <Flame size={18} color="#D97706" />,
    results: [
      {
        name: "Sarah Chen",
        company: "Vertex Labs",
        detail: "Last replied 3 weeks ago about pricing",
      },
      {
        name: "Marcus Johnson",
        company: "Relay Inc",
        detail: "Demo scheduled but never followed up",
      },
    ],
  },
  {
    title: "Warm paths in your network",
    subtitle: "Connections that can introduce you",
    icon: <Route size={18} color="#16A34A" />,
    results: [
      {
        name: "Alex Rivera",
        company: "Datastream",
        detail: "Connected through Jamie Park (2nd degree)",
      },
      {
        name: "Priya Patel",
        company: "CloudFirst",
        detail: "Both attended SaaStr 2024",
      },
    ],
  },
  {
    title: "New prospects",
    subtitle: "Matching your ideal customer profile",
    icon: <Sparkles size={18} color="#1A237E" />,
    results: [
      {
        name: "David Kim",
        company: "ScaleUp AI",
        detail: "VP Sales, 120 employees, Series B",
      },
      {
        name: "Emily Watson",
        company: "GrowthOS",
        detail: "CRO, 85 employees, recently funded",
      },
    ],
  },
];

function ResultCard({
  result,
  index,
}: {
  result: DiscoveryResult;
  index: number;
}) {
  return (
    <Animated.View
      entering={FadeInRight.delay(index * 200).duration(400)}
      className="bg-surfaceContainerLow rounded-xl p-3 mb-2"
    >
      <Text className="text-onSurface text-sm font-semibold">
        {result.name}
      </Text>
      <Text className="text-onSurfaceVariant text-xs">{result.company}</Text>
      <Text className="text-onSurfaceVariant text-xs mt-1">{result.detail}</Text>
    </Animated.View>
  );
}

export default function SalesDiscoveryScreen() {
  const router = useRouter();
  const [visibleSections, setVisibleSections] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleSections(1), 1500),
      setTimeout(() => setVisibleSections(2), 3500),
      setTimeout(() => {
        setVisibleSections(3);
        setTimeout(() => setIsComplete(true), 1000);
      }, 5500),
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/(tabs)/today");
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 32, paddingHorizontal: 20 }}
      >
        <View className="items-center mb-8">
          <Text className="text-onBackground text-2xl text-center mb-2 font-semibold">
            Finding opportunities
          </Text>
          <Text className="text-onSurfaceVariant text-base text-center">
            Mercury is analyzing your network...
          </Text>
        </View>

        {mockSections.slice(0, visibleSections).map((section, sectionIndex) => (
          <Animated.View
            key={section.title}
            entering={FadeInDown.delay(200).duration(500)}
            className="mb-6"
          >
            <View className="flex-row items-center gap-2 mb-2">
              {section.icon}
              <Text className="text-onSurface text-base font-semibold">
                {section.title}
              </Text>
            </View>
            <Text className="text-onSurfaceVariant text-xs mb-3">
              {section.subtitle}
            </Text>
            {section.results.map((result, resultIndex) => (
              <ResultCard
                key={result.name}
                result={result}
                index={sectionIndex * 2 + resultIndex}
              />
            ))}
          </Animated.View>
        ))}

        {!isComplete && (
          <View className="items-center py-6">
            <PulsingDots
              message={
                visibleSections === 0
                  ? "Scanning your emails..."
                  : visibleSections === 1
                  ? "Mapping your network..."
                  : "Finding new prospects..."
              }
            />
          </View>
        )}

        {isComplete && (
          <Animated.View entering={FadeInDown.duration(500)}>
            <Pressable
              onPress={handleContinue}
              className="bg-primary py-4 rounded-full flex-row items-center justify-center gap-2 active:opacity-80 mt-4"
            >
              <Text className="text-onPrimary text-base font-semibold">
                Go to your dashboard
              </Text>
              <ArrowRight size={18} color="white" />
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
