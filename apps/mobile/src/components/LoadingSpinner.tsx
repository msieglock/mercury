import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({
  message,
  size = "md",
}: LoadingSpinnerProps) {
  const rotation = useSharedValue(0);

  const dotSizes = { sm: 6, md: 8, lg: 12 };
  const containerSizes = { sm: 24, md: 36, lg: 48 };
  const dotSize = dotSizes[size];
  const containerSize = containerSizes[size];

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View className="items-center justify-center gap-3">
      <Animated.View
        style={[
          animatedStyle,
          { width: containerSize, height: containerSize },
        ]}
        className="items-center justify-start"
      >
        <View
          style={{ width: dotSize, height: dotSize }}
          className="bg-primary rounded-full"
        />
      </Animated.View>
      {message && (
        <Text className="text-onSurfaceVariant text-sm font-medium">{message}</Text>
      )}
    </View>
  );
}

interface PulsingDotsProps {
  message?: string;
}

export function PulsingDots({ message }: PulsingDotsProps) {
  const opacity1 = useSharedValue(0.3);
  const opacity2 = useSharedValue(0.3);
  const opacity3 = useSharedValue(0.3);

  useEffect(() => {
    opacity1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.3, { duration: 400 })
      ),
      -1,
      false
    );
    setTimeout(() => {
      opacity2.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1,
        false
      );
    }, 150);
    setTimeout(() => {
      opacity3.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1,
        false
      );
    }, 300);
  }, []);

  const dot1Style = useAnimatedStyle(() => ({ opacity: opacity1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: opacity2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: opacity3.value }));

  return (
    <View className="items-center gap-3">
      <View className="flex-row gap-2">
        <Animated.View
          style={dot1Style}
          className="w-2.5 h-2.5 bg-primary rounded-full"
        />
        <Animated.View
          style={dot2Style}
          className="w-2.5 h-2.5 bg-primary rounded-full"
        />
        <Animated.View
          style={dot3Style}
          className="w-2.5 h-2.5 bg-primary rounded-full"
        />
      </View>
      {message && (
        <Text className="text-onSurfaceVariant text-sm font-medium">{message}</Text>
      )}
    </View>
  );
}
