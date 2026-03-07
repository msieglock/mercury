import React from "react";
import { View, Text } from "react-native";

interface ThreadBubbleProps {
  content: string;
  timestamp: string;
  isOutgoing: boolean;
  isAiDraft?: boolean;
  senderName?: string;
}

export function ThreadBubble({
  content,
  timestamp,
  isOutgoing,
  isAiDraft,
  senderName,
}: ThreadBubbleProps) {
  return (
    <View
      className={`max-w-[80%] mb-3 ${isOutgoing ? "self-end" : "self-start"}`}
    >
      {!isOutgoing && senderName && (
        <Text className="text-warm-500 text-[11px] font-medium mb-1 ml-1">
          {senderName}
        </Text>
      )}
      <View
        className={`rounded-2xl px-4 py-3 ${
          isAiDraft
            ? "bg-sienna-50 border border-dashed border-sienna-200"
            : isOutgoing
            ? "bg-charcoal"
            : "bg-white border border-warm-100"
        }`}
        style={isAiDraft ? { opacity: 0.85 } : undefined}
      >
        {isAiDraft && (
          <Text className="text-sienna text-[10px] font-semibold uppercase tracking-wider mb-1">
            AI Draft
          </Text>
        )}
        <Text
          className={`text-[15px] leading-[22px] ${
            isOutgoing && !isAiDraft ? "text-cream" : "text-charcoal"
          }`}
        >
          {content}
        </Text>
      </View>
      <Text
        className={`text-warm-400 text-[10px] mt-1 ${
          isOutgoing ? "text-right mr-1" : "ml-1"
        }`}
      >
        {timestamp}
      </Text>
    </View>
  );
}
