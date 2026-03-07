import React from "react";
import { View, Text } from "react-native";

type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "info"
  | "muted";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

const variantClasses: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: "bg-surfaceContainerHigh", text: "text-onSurfaceVariant" },
  primary: { bg: "bg-primaryContainer", text: "text-onPrimaryContainer" },
  success: { bg: "bg-green-100", text: "text-green-800" },
  warning: { bg: "bg-amber-100", text: "text-amber-800" },
  info: { bg: "bg-blue-100", text: "text-blue-800" },
  muted: { bg: "bg-surfaceContainer", text: "text-onSurfaceVariant" },
};

export function Badge({ label, variant = "default", size = "sm" }: BadgeProps) {
  const { bg, text } = variantClasses[variant];
  const padding = size === "sm" ? "px-2 py-0.5" : "px-3 py-1";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <View className={`${bg} ${padding} rounded-full self-start`}>
      <Text className={`${text} ${textSize} font-medium`}>{label}</Text>
    </View>
  );
}
