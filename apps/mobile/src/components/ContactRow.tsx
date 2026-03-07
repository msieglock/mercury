import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Linkedin, Mail, UserPlus, Users } from "lucide-react-native";
import { Avatar } from "./Avatar";

type OutreachPath = "linkedin" | "email" | "warm-intro" | "mutual-connection";

interface ContactRowProps {
  name: string;
  title: string;
  company: string;
  outreachPath?: OutreachPath;
  relationshipScore?: number; // 0-100
  lastInteraction?: string; // relative time string
  onPress?: () => void;
}

const outreachIcons: Record<OutreachPath, React.ReactNode> = {
  linkedin: <Linkedin size={12} color="#0A66C2" />,
  email: <Mail size={12} color="#1A237E" />,
  "warm-intro": <UserPlus size={12} color="#16A34A" />,
  "mutual-connection": <Users size={12} color="#7C3AED" />,
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-primary" : score >= 40 ? "bg-amber-500" : "bg-outline";

  return (
    <View className="w-12 h-1.5 bg-surfaceContainerHigh rounded-full overflow-hidden">
      <View
        className={`h-full rounded-full ${color}`}
        style={{ width: `${score}%` }}
      />
    </View>
  );
}

export function ContactRow({
  name,
  title,
  company,
  outreachPath,
  relationshipScore,
  lastInteraction,
  onPress,
}: ContactRowProps) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      className="flex-row items-center px-5 py-3.5 bg-surface active:bg-surfaceContainerLow"
    >
      <Avatar name={name} size="md" />

      <View className="flex-1 ml-3 mr-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-onSurface text-[15px] font-semibold" numberOfLines={1}>
            {name}
          </Text>
          {outreachPath && (
            <View className="w-5 h-5 bg-surfaceContainerLow rounded-full items-center justify-center">
              {outreachIcons[outreachPath]}
            </View>
          )}
        </View>
        <Text className="text-onSurfaceVariant text-[13px] mt-0.5" numberOfLines={1}>
          {title} @ {company}
        </Text>
      </View>

      <View className="items-end gap-1.5">
        {relationshipScore !== undefined && (
          <ScoreBar score={relationshipScore} />
        )}
        {lastInteraction && (
          <Text className="text-outline text-[11px]">{lastInteraction}</Text>
        )}
      </View>
    </Pressable>
  );
}
