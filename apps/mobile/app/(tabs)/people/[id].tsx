import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Linkedin,
  Calendar,
  Pencil,
  Sparkles,
  ExternalLink,
} from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      className="items-center gap-1.5 active:opacity-60"
    >
      <View className="w-11 h-11 bg-white border border-warm-200 rounded-full items-center justify-center">
        {icon}
      </View>
      <Text className="text-warm-600 text-[10px] font-medium">{label}</Text>
    </Pressable>
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
    <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
      <Text className="text-warm-600 text-xs font-semibold uppercase tracking-wider mb-3">
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Mock data - would be fetched by id
  const contact = {
    name: "Sarah Chen",
    title: "VP Engineering",
    company: "Vertex Labs",
    outreachPath: "email" as const,
    relationshipScore: 85,
    email: "sarah@vertexlabs.com",
    phone: "+1 (555) 123-4567",
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3">
        <Pressable
          onPress={() => router.back()}
          className="mr-4 active:opacity-60"
        >
          <ArrowLeft size={24} color="#1A1815" />
        </Pressable>
        <Text className="text-charcoal text-lg font-semibold flex-1">
          Contact
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Profile header */}
        <View className="items-center px-5 py-6">
          <Avatar name={contact.name} size="xl" />
          <Text className="text-charcoal text-xl font-semibold mt-3">
            {contact.name}
          </Text>
          <Text className="text-warm-500 text-sm mt-0.5">
            {contact.title} at {contact.company}
          </Text>
          <View className="mt-3">
            <Badge label="Via Email" variant="sienna" size="md" />
          </View>
        </View>

        {/* Action buttons */}
        <View className="flex-row justify-center gap-6 pb-6">
          <ActionButton
            icon={<Mail size={18} color="#1A1815" />}
            label="Email"
          />
          <ActionButton
            icon={<MessageSquare size={18} color="#1A1815" />}
            label="Text"
          />
          <ActionButton
            icon={<Linkedin size={18} color="#0A66C2" />}
            label="LinkedIn"
          />
          <ActionButton
            icon={<Calendar size={18} color="#1A1815" />}
            label="Schedule"
          />
          <ActionButton
            icon={<Pencil size={18} color="#1A1815" />}
            label="Note"
          />
        </View>

        <View className="px-5">
          {/* AI Insights */}
          <SectionCard title="AI Insights">
            <View className="bg-sienna-50 rounded-xl p-3 mb-2">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Sparkles size={12} color="#D4552A" />
                <Text className="text-sienna text-xs font-semibold">
                  Recommendation
                </Text>
              </View>
              <Text className="text-charcoal text-sm leading-5">
                Sarah showed high interest in your pricing proposal 3 weeks ago
                but hasn't responded. Consider following up with a case study
                from a similar company.
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-warm-500 text-xs">Relationship Score</Text>
              <View className="flex-row items-center gap-2">
                <View className="w-20 h-1.5 bg-warm-100 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${contact.relationshipScore}%` }}
                  />
                </View>
                <Text className="text-warm-600 text-xs font-semibold">
                  {contact.relationshipScore}
                </Text>
              </View>
            </View>
          </SectionCard>

          {/* Interaction Timeline */}
          <SectionCard title="Recent Activity">
            {[
              { time: "2h ago", event: "Opened your email about pricing", type: "open" },
              { time: "3d ago", event: "You sent follow-up email", type: "sent" },
              { time: "1w ago", event: "Had a 30-min discovery call", type: "meeting" },
              { time: "2w ago", event: "Connected on LinkedIn", type: "social" },
            ].map((item, index) => (
              <View
                key={index}
                className={`flex-row gap-3 py-2.5 ${
                  index > 0 ? "border-t border-warm-50" : ""
                }`}
              >
                <View className="w-2 h-2 bg-warm-300 rounded-full mt-1.5" />
                <View className="flex-1">
                  <Text className="text-charcoal text-sm">{item.event}</Text>
                  <Text className="text-warm-400 text-xs mt-0.5">
                    {item.time}
                  </Text>
                </View>
              </View>
            ))}
          </SectionCard>

          {/* Enrichment Data */}
          <SectionCard title="Enrichment Data">
            <View className="gap-2.5">
              {[
                { label: "Company", value: "Vertex Labs" },
                { label: "Industry", value: "AI / Machine Learning" },
                { label: "Size", value: "120 employees" },
                { label: "Funding", value: "Series B ($45M)" },
                { label: "Location", value: "San Francisco, CA" },
              ].map((item) => (
                <View key={item.label} className="flex-row justify-between">
                  <Text className="text-warm-500 text-sm">{item.label}</Text>
                  <Text className="text-charcoal text-sm font-medium">
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable className="flex-row items-center gap-1.5 mt-3 pt-3 border-t border-warm-100 active:opacity-60">
              <ExternalLink size={14} color="#D4552A" />
              <Text className="text-sienna text-sm font-medium">
                View full profile on Apollo
              </Text>
            </Pressable>
          </SectionCard>

          {/* Relationship Graph Placeholder */}
          <SectionCard title="Relationship Map">
            <View className="h-32 bg-warm-50 rounded-xl items-center justify-center">
              <Text className="text-warm-400 text-sm">
                Network graph coming soon
              </Text>
            </View>
          </SectionCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
