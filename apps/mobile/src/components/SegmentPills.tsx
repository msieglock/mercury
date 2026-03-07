import React from "react";
import { ScrollView, Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";

interface SegmentPillsProps {
  segments: string[];
  activeSegment: string;
  onSelect: (segment: string) => void;
}

export function SegmentPills({
  segments,
  activeSegment,
  onSelect,
}: SegmentPillsProps) {
  const handlePress = (segment: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(segment);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      className="flex-grow-0 py-3"
    >
      {segments.map((segment) => {
        const isActive = segment === activeSegment;
        return (
          <Pressable
            key={segment}
            onPress={() => handlePress(segment)}
            className={`px-4 py-2 rounded-full ${
              isActive ? "bg-charcoal" : "bg-warm-100"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isActive ? "text-cream" : "text-warm-600"
              }`}
            >
              {segment}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
