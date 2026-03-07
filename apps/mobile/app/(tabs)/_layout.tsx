import React from "react";
import { Tabs } from "expo-router";
import { View, Platform } from "react-native";
import {
  Sun,
  Users,
  Inbox,
  User,
} from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FEFBFF",
          borderTopColor: "#C7C5D0",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
        },
        tabBarActiveTintColor: "#1A237E",
        tabBarInactiveTintColor: "#767680",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              className={`px-4 py-1 rounded-full ${
                focused ? "bg-secondaryContainer" : ""
              }`}
            >
              <Sun size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: "People",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              className={`px-4 py-1 rounded-full ${
                focused ? "bg-secondaryContainer" : ""
              }`}
            >
              <Users size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              className={`px-4 py-1 rounded-full ${
                focused ? "bg-secondaryContainer" : ""
              }`}
            >
              <Inbox size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              className={`px-4 py-1 rounded-full ${
                focused ? "bg-secondaryContainer" : ""
              }`}
            >
              <User size={size} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
