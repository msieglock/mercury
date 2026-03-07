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
      <Text className="text-charcoal text-2xl font-bold">{value}</Text>
      <Text className="text-warm-500 text-[11px] font-medium mt-0.5">
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
    <View className="bg-white mx-5 rounded-2xl p-5 shadow-sm">
      <Text className="text-charcoal text-xl font-serif mb-1">
        Good morning, {firstName}.
      </Text>
      <Text className="text-warm-500 text-sm mb-5">
        Here's your day at a glance.
      </Text>

      <View className="flex-row border-t border-warm-100 pt-4 mb-4">
        <StatItem label="Pending" value={pendingActions} />
        <View className="w-px bg-warm-100" />
        <StatItem label="Meetings" value={meetingsToday} />
        <View className="w-px bg-warm-100" />
        <StatItem label="New Replies" value={newReplies} />
      </View>

      {salesMode && pipelineHealth !== undefined && (
        <View>
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-warm-500 text-xs font-medium">
              Pipeline Health
            </Text>
            <Text className="text-warm-600 text-xs font-semibold">
              {pipelineHealth}%
            </Text>
          </View>
          <View className="h-2 bg-warm-100 rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${
                pipelineHealth >= 70
                  ? "bg-green-500"
                  : pipelineHealth >= 40
                  ? "bg-amber-500"
                  : "bg-sienna"
              }`}
              style={{ width: `${pipelineHealth}%` }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
