import React, { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as PaperProvider, MD3LightTheme } from "react-native-paper";
import { getSession } from "@/lib/auth";
import "../global.css";

const m3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#1A237E",
    onPrimary: "#FFFFFF",
    primaryContainer: "#DEE0FF",
    onPrimaryContainer: "#00105C",
    secondary: "#5B5D72",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#DFE1F9",
    onSecondaryContainer: "#181A2E",
    tertiary: "#77536D",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#FFD7F1",
    onTertiaryContainer: "#2D1228",
    error: "#BA1A1A",
    onError: "#FFFFFF",
    errorContainer: "#FFDAD6",
    onErrorContainer: "#410002",
    background: "#FEFBFF",
    onBackground: "#1B1B1F",
    surface: "#FEFBFF",
    onSurface: "#1B1B1F",
    surfaceVariant: "#E3E1EC",
    onSurfaceVariant: "#46464F",
    outline: "#767680",
    outlineVariant: "#C7C5D0",
    inverseSurface: "#303034",
    inverseOnSurface: "#F3F0F4",
    surfaceDisabled: "rgba(27, 27, 31, 0.12)",
    onSurfaceDisabled: "rgba(27, 27, 31, 0.38)",
    elevation: {
      level0: "transparent",
      level1: "#F5F2F7",
      level2: "#EFEDF1",
      level3: "#E9E7EC",
      level4: "#E7E5EA",
      level5: "#E3E1E6",
    },
  },
};

function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ token: string } | null | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)/today");
    }
  }, [session, isLoading, segments]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#1A237E" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={m3Theme}>
          <AuthGate>
            <Slot />
          </AuthGate>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
