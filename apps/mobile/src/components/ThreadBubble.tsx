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
        <Text className="text-onSurfaceVariant text-[11px] font-medium mb-1 ml-1">
          {senderName}
        </Text>
      )}
      <View
        className={`rounded-2xl px-4 py-3 ${
          isAiDraft
            ? "bg-tertiaryContainer border border-dashed border-outline"
            : isOutgoing
            ? "bg-primaryContainer"
            : "bg-surfaceContainerHigh border border-outlineVariant"
        }`}
        style={isAiDraft ? { opacity: 0.85 } : undefined}
      >
        {isAiDraft && (
          <Text className="text-tertiary text-[10px] font-semibold uppercase tracking-wider mb-1">
            AI Draft
          </Text>
        )}
        <Text
          className={`text-[15px] leading-[22px] ${
            isAiDraft
              ? "text-onTertiaryContainer"
              : isOutgoing
              ? "text-onPrimaryContainer"
              : "text-onSurface"
          }`}
        >
          {content}
        </Text>
      </View>
      <Text
        className={`text-outline text-[10px] mt-1 ${
          isOutgoing ? "text-right mr-1" : "ml-1"
        }`}
      >
        {timestamp}
      </Text>
    </View>
  );
}
