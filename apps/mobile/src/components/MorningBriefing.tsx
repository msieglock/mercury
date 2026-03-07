import React from "react";
import { View, Text } from "react-native";

interface MorningBriefingProps {
  name: string;
  pendingActions: number;
  meetingsToday: number;
  newReplies: number;
  pipelineHealth?: number; // 0-100
  salesMode?: boolean;
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <View className="items-center flex-1">
      <Text className="text-primary text-2xl font-bold">{value}</Text>
      <Text className="text-onSurfaceVariant text-[11px] font-medium mt-0.5">
        {label}
      </Text>
    </View>
  );
}

export function MorningBriefing({
  name,
  pendingActions,
  meetingsToday,
  newReplies,
  pipelineHealth,
  salesMode,
}: MorningBriefingProps) {
  const firstName = name.split(" ")[0];

  return (
    <View className="bg-surfaceContainerLow mx-5 rounded-2xl p-5 shadow-sm">
      <Text className="text-onSurface text-xl mb-1 font-semibold">
        Good morning, {firstName}.
      </Text>
      <Text className="text-onSurfaceVariant text-sm mb-5">
        Here's your day at a glance.
      </Text>

      <View className="flex-row border-t border-outlineVariant pt-4 mb-4">
        <StatItem label="Pending" value={pendingActions} />
        <View className="w-px bg-outlineVariant" />
        <StatItem label="Meetings" value={meetingsToday} />
        <View className="w-px bg-outlineVariant" />
        <StatItem label="New Replies" value={newReplies} />
      </View>

      {salesMode && pipelineHealth !== undefined && (
        <View>
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-onSurfaceVariant text-xs font-medium">
              Pipeline Health
            </Text>
            <Text className="text-onSurfaceVariant text-xs font-semibold">
              {pipelineHealth}%
            </Text>
          </View>
          <View className="h-2 bg-surfaceContainerHigh rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${
                pipelineHealth >= 70
                  ? "bg-primary"
                  : pipelineHealth >= 40
                  ? "bg-amber-500"
                  : "bg-error"
              }`}
              style={{ width: `${pipelineHealth}%` }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
