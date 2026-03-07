import React from "react";
import { View, Text, Pressable } from "react-native";
import { Inbox } from "lucide-react-native";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="w-16 h-16 bg-surfaceContainerHigh rounded-full items-center justify-center mb-5">
        {icon ?? <Inbox size={28} color="#767680" />}
      </View>
      <Text className="text-onSurface text-lg font-semibold text-center mb-2">
        {title}
      </Text>
      <Text className="text-onSurfaceVariant text-sm text-center leading-5 mb-6">
        {message}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="bg-primary px-6 py-3 rounded-full active:opacity-80"
        >
          <Text className="text-onPrimary font-semibold text-sm">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
