import React from "react";
import { Stack } from "expo-router";

export default function PeopleLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FAFAF8" },
        animation: "slide_from_right",
      }}
    />
  );
}
