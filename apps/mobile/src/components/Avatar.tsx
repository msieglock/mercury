import React from "react";
import { View, Text } from "react-native";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  imageUrl?: string;
  online?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
  xl: "w-20 h-20",
};

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-2xl",
};

const onlineDotSizeClasses = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
  xl: "w-4 h-4",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = [
    "bg-sienna-200",
    "bg-warm-200",
    "bg-sienna-100",
    "bg-warm-300",
    "bg-sienna-300",
  ];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function Avatar({ name, size = "md", online }: AvatarProps) {
  const initials = getInitials(name);
  const bgColor = getColorFromName(name);

  return (
    <View className="relative">
      <View
        className={`${sizeClasses[size]} ${bgColor} rounded-full items-center justify-center`}
      >
        <Text
          className={`${textSizeClasses[size]} font-semibold text-charcoal`}
        >
          {initials}
        </Text>
      </View>
      {online !== undefined && (
        <View
          className={`absolute bottom-0 right-0 ${onlineDotSizeClasses[size]} rounded-full border-2 border-cream ${
            online ? "bg-green-500" : "bg-warm-400"
          }`}
        />
      )}
    </View>
  );
}
