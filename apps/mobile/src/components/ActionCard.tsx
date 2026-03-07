import React, { useCallback } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Check,
  X,
  Clock,
  MessageSquare,
  UserPlus,
  TrendingDown,
  Calendar,
  Search,
  Pencil,
  Mail,
} from "lucide-react-native";
import { Badge } from "./Badge";

export type AgentType =
  | "follow-up"
  | "reply"
  | "warm-intro"
  | "meeting-prep"
  | "new-prospect"
  | "deal-cold"
  | "candidate"
  | "log-notes";

interface ActionCardProps {
  agentType: AgentType;
  title: string;
  subtitle: string;
  timeEstimate?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
}

const agentConfig: Record<
  AgentType,
  { label: string; color: string; icon: React.ReactNode }
> = {
  "follow-up": {
    label: "Follow Up",
    color: "sienna",
    icon: <Mail size={14} color="#D4552A" />,
  },
  reply: {
    label: "Reply Needed",
    color: "info",
    icon: <MessageSquare size={14} color="#2563EB" />,
  },
  "warm-intro": {
    label: "Warm Intro",
    color: "success",
    icon: <UserPlus size={14} color="#16A34A" />,
  },
  "meeting-prep": {
    label: "Meeting Prep",
    color: "warning",
    icon: <Calendar size={14} color="#D97706" />,
  },
  "new-prospect": {
    label: "New Prospect",
    color: "success",
    icon: <Search size={14} color="#16A34A" />,
  },
  "deal-cold": {
    label: "Deal Going Cold",
    color: "warning",
    icon: <TrendingDown size={14} color="#D97706" />,
  },
  candidate: {
    label: "Candidate",
    color: "info",
    icon: <UserPlus size={14} color="#2563EB" />,
  },
  "log-notes": {
    label: "Log Notes",
    color: "muted",
    icon: <Pencil size={14} color="#7A7265" />,
  },
};

const SWIPE_THRESHOLD = 100;
const SCREEN_WIDTH = Dimensions.get("window").width;

export function ActionCard({
  agentType,
  title,
  subtitle,
  timeEstimate,
  actionLabel = "Review",
  onAction,
  onDismiss,
  onSwipeRight,
  onSwipeLeft,
}: ActionCardProps) {
  const translateX = useSharedValue(0);
  const config = agentConfig[agentType];

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleSwipeRight = useCallback(() => {
    triggerHaptic();
    onSwipeRight?.();
  }, [onSwipeRight, triggerHaptic]);

  const handleSwipeLeft = useCallback(() => {
    triggerHaptic();
    onSwipeLeft?.();
  }, [onSwipeLeft, triggerHaptic]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 });
        runOnJS(handleSwipeRight)();
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 });
        runOnJS(handleSwipeLeft)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 0 ? Math.min(translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  const leftActionStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? Math.min(-translateX.value / SWIPE_THRESHOLD, 1) : 0,
  }));

  return (
    <View className="mx-5 mb-3 relative">
      {/* Swipe right background - Approve */}
      <Animated.View
        style={rightActionStyle}
        className="absolute inset-0 bg-green-500 rounded-2xl items-start justify-center pl-6"
      >
        <Check size={24} color="white" />
      </Animated.View>

      {/* Swipe left background - Dismiss */}
      <Animated.View
        style={leftActionStyle}
        className="absolute inset-0 bg-warm-400 rounded-2xl items-end justify-center pr-6"
      >
        <X size={24} color="white" />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={cardStyle}
          className="bg-white rounded-2xl p-4 shadow-sm"
        >
          {/* Agent badge row */}
          <View className="flex-row items-center justify-between mb-2.5">
            <View className="flex-row items-center gap-1.5">
              {config.icon}
              <Badge
                label={config.label}
                variant={config.color as any}
                size="sm"
              />
            </View>
            {timeEstimate && (
              <View className="flex-row items-center gap-1">
                <Clock size={11} color="#98917F" />
                <Text className="text-warm-500 text-[11px]">
                  {timeEstimate}
                </Text>
              </View>
            )}
          </View>

          {/* Content */}
          <Text className="text-charcoal text-base font-semibold mb-1">
            {title}
          </Text>
          <Text className="text-warm-500 text-sm leading-5 mb-4">
            {subtitle}
          </Text>

          {/* Actions */}
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAction?.();
              }}
              className="bg-sienna px-5 py-2.5 rounded-full active:opacity-80"
            >
              <Text className="text-white text-sm font-semibold">
                {actionLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDismiss?.();
              }}
              className="px-4 py-2.5 active:opacity-60"
            >
              <Text className="text-warm-500 text-sm font-medium">
                Dismiss
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
