import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  LogOut,
  Mail,
  Linkedin,
  Calendar,
  ChevronRight,
  Bell,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { signOut } from "@/lib/auth";

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-3.5 active:opacity-70"
    >
      <View className="w-8 h-8 bg-surfaceContainerHigh rounded-lg items-center justify-center mr-3">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-onSurface text-[15px] font-medium">{label}</Text>
        {value && (
          <Text className="text-onSurfaceVariant text-xs mt-0.5">{value}</Text>
        )}
      </View>
      {trailing ?? <ChevronRight size={18} color="#767680" />}
    </Pressable>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}) {
  return (
    <View className="flex-row items-center py-3">
      <View className="flex-1 mr-3">
        <Text className="text-onSurface text-[15px] font-medium">{label}</Text>
        <Text className="text-onSurfaceVariant text-xs mt-0.5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(val) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(val);
        }}
        trackColor={{ false: "#E3E1EC", true: "#1A237E" }}
        thumbColor="white"
      />
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-surface rounded-2xl px-4 py-3 mb-4 shadow-sm">
      <Text className="text-onSurfaceVariant text-xs font-semibold uppercase tracking-wider mb-2 pt-1">
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function MeScreen() {
  const [autoFollowUp, setAutoFollowUp] = useState(true);
  const [autoRespond, setAutoRespond] = useState(false);
  const [autoLogMeetings, setAutoLogMeetings] = useState(true);
  const [formality, setFormality] = useState(65);
  const [warmth, setWarmth] = useState(75);

  const handleSignOut = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-onBackground text-3xl font-bold">
            Me
          </Text>
        </View>

        {/* Profile card */}
        <View className="mx-5 bg-surface rounded-2xl p-5 mb-6 shadow-sm items-center">
          <Avatar name="Alex Thompson" size="xl" />
          <Text className="text-onSurface text-lg font-semibold mt-3">
            Alex Thompson
          </Text>
          <Text className="text-onSurfaceVariant text-sm mt-0.5">
            Account Executive
          </Text>
          <Text className="text-outline text-xs mt-0.5">Acme Corp</Text>
        </View>

        <View className="px-5">
          {/* Linked Accounts */}
          <SectionCard title="Linked Accounts">
            <SettingsRow
              icon={<Mail size={16} color="#1A237E" />}
              label="Google Workspace"
              value="alex@acmecorp.com"
              trailing={
                <CheckCircle2 size={18} color="#16A34A" />
              }
            />
            <View className="h-px bg-outlineVariant" />
            <SettingsRow
              icon={<Linkedin size={16} color="#0A66C2" />}
              label="LinkedIn"
              value="247 connections synced"
              trailing={
                <CheckCircle2 size={18} color="#16A34A" />
              }
            />
            <View className="h-px bg-outlineVariant" />
            <SettingsRow
              icon={<Calendar size={16} color="#1B1B1F" />}
              label="Calendar"
              value="Not connected"
              trailing={
                <AlertCircle size={18} color="#D97706" />
              }
            />
          </SectionCard>

          {/* AI Voice */}
          <SectionCard title="AI Voice">
            <View className="bg-surfaceContainerLow rounded-xl p-3 mb-3">
              <Text className="text-onSurfaceVariant text-[10px] font-semibold uppercase tracking-wider mb-1">
                Sample Email
              </Text>
              <Text className="text-onSurface text-[13px] leading-5 italic">
                "Hi Sarah, great chatting today! I wanted to follow up on the
                pricing discussion. I think our enterprise tier would be a
                perfect fit for Vertex Labs, especially with the SSO and API
                features you mentioned. Let me know if you'd like to dig deeper
                into anything."
              </Text>
            </View>

            <View className="gap-3">
              <View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-onSurfaceVariant text-xs font-medium">
                    Formality
                  </Text>
                  <Text className="text-onSurfaceVariant text-xs">{formality}%</Text>
                </View>
                <View className="h-2 bg-surfaceContainerHigh rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${formality}%` }}
                  />
                </View>
                <View className="flex-row justify-between mt-0.5">
                  <Text className="text-outline text-[10px]">Casual</Text>
                  <Text className="text-outline text-[10px]">Formal</Text>
                </View>
              </View>

              <View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-onSurfaceVariant text-xs font-medium">
                    Warmth
                  </Text>
                  <Text className="text-onSurfaceVariant text-xs">{warmth}%</Text>
                </View>
                <View className="h-2 bg-surfaceContainerHigh rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${warmth}%` }}
                  />
                </View>
                <View className="flex-row justify-between mt-0.5">
                  <Text className="text-outline text-[10px]">Direct</Text>
                  <Text className="text-outline text-[10px]">Warm</Text>
                </View>
              </View>
            </View>
          </SectionCard>

          {/* Automations */}
          <SectionCard title="Automations">
            <ToggleRow
              label="Auto follow-up"
              description="Automatically follow up on cold threads"
              value={autoFollowUp}
              onToggle={setAutoFollowUp}
            />
            <View className="h-px bg-outlineVariant" />
            <ToggleRow
              label="Auto-respond"
              description="Send AI drafts without review"
              value={autoRespond}
              onToggle={setAutoRespond}
            />
            <View className="h-px bg-outlineVariant" />
            <ToggleRow
              label="Auto-log meetings"
              description="Log meeting notes to CRM automatically"
              value={autoLogMeetings}
              onToggle={setAutoLogMeetings}
            />
          </SectionCard>

          {/* Mode Switch */}
          <SectionCard title="Mode">
            <View className="flex-row gap-2 py-1">
              {["Sales", "Recruit", "Manage"].map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() =>
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }
                  className={`flex-1 py-2.5 rounded-xl items-center ${
                    mode === "Sales" ? "bg-primary" : "bg-surfaceContainerHigh"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      mode === "Sales" ? "text-onPrimary" : "text-onSurfaceVariant"
                    }`}
                  >
                    {mode}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SectionCard>

          {/* Other settings */}
          <SectionCard title="Settings">
            <SettingsRow
              icon={<Bell size={16} color="#1B1B1F" />}
              label="Notifications"
              value="Push & Email"
            />
            <View className="h-px bg-outlineVariant" />
            <SettingsRow
              icon={<Sliders size={16} color="#1B1B1F" />}
              label="Advanced Settings"
            />
          </SectionCard>

          {/* Sign out */}
          <Pressable
            onPress={handleSignOut}
            className="bg-surface rounded-2xl py-4 items-center flex-row justify-center gap-2 shadow-sm active:opacity-80"
          >
            <LogOut size={18} color="#BA1A1A" />
            <Text className="text-error text-base font-semibold">
              Sign Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
