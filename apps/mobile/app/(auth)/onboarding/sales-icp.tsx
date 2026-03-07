import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Building2, Target, MapPin, Users } from "lucide-react-native";

interface ICPField {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
}

export default function SalesICPScreen() {
  const router = useRouter();

  const [companyName] = useState("Acme Corp");
  const [industry, setIndustry] = useState("B2B SaaS");
  const [companySize, setCompanySize] = useState("50-500 employees");
  const [targetRoles, setTargetRoles] = useState("VP Sales, CRO, Head of Revenue");
  const [geography, setGeography] = useState("North America");

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(auth)/onboarding/sales-discovery");
  };

  const fields: ICPField[] = [
    {
      icon: <Building2 size={18} color="#1A237E" />,
      label: "Target Industry",
      value: industry,
      placeholder: "e.g., B2B SaaS, Healthcare",
    },
    {
      icon: <Users size={18} color="#1A237E" />,
      label: "Company Size",
      value: companySize,
      placeholder: "e.g., 50-500 employees",
    },
    {
      icon: <Target size={18} color="#1A237E" />,
      label: "Target Roles",
      value: targetRoles,
      placeholder: "e.g., VP Sales, CRO",
    },
    {
      icon: <MapPin size={18} color="#1A237E" />,
      label: "Geography",
      value: geography,
      placeholder: "e.g., North America",
    },
  ];

  const setters: Record<string, (val: string) => void> = {
    "Target Industry": setIndustry,
    "Company Size": setCompanySize,
    "Target Roles": setTargetRoles,
    Geography: setGeography,
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView className="flex-1 px-8" contentContainerStyle={{ paddingVertical: 32 }}>
        <View className="items-center mb-8">
          <Text className="text-onBackground text-2xl text-center mb-2 font-semibold">
            Your ideal customer
          </Text>
          <Text className="text-onSurfaceVariant text-base text-center leading-6">
            Mercury analyzed your account. Review and{"\n"}adjust your target
            customer profile.
          </Text>
        </View>

        {/* Company info card */}
        <View className="bg-surface rounded-2xl p-5 mb-6 shadow-sm">
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-10 h-10 bg-primaryContainer rounded-xl items-center justify-center">
              <Building2 size={20} color="#1A237E" />
            </View>
            <View>
              <Text className="text-onSurface text-base font-semibold">
                {companyName}
              </Text>
              <Text className="text-onSurfaceVariant text-xs">
                Company profile from Apollo
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="bg-secondaryContainer px-2.5 py-1 rounded-full">
              <Text className="text-onSecondaryContainer text-[10px] font-semibold uppercase">
                AI Suggested
              </Text>
            </View>
          </View>
        </View>

        {/* Editable ICP fields */}
        <View className="gap-4 mb-8">
          {fields.map((field) => (
            <View key={field.label} className="bg-surface rounded-2xl p-4 shadow-sm">
              <View className="flex-row items-center gap-2 mb-2">
                {field.icon}
                <Text className="text-onSurfaceVariant text-xs font-semibold uppercase tracking-wider">
                  {field.label}
                </Text>
              </View>
              <TextInput
                value={field.value}
                onChangeText={(text) => setters[field.label]?.(text)}
                placeholder={field.placeholder}
                placeholderTextColor="#767680"
                className="text-onSurface text-base py-1"
              />
            </View>
          ))}
        </View>

        <Pressable
          onPress={handleConfirm}
          className="bg-primary py-4 rounded-full items-center active:opacity-80"
        >
          <Text className="text-onPrimary text-base font-semibold">
            Confirm & Find Opportunities
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
