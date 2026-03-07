import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MorningBriefing } from "@/components/MorningBriefing";
import { ActionCard, AgentType } from "@/components/ActionCard";

interface ActionItem {
  id: string;
  agentType: AgentType;
  title: string;
  subtitle: string;
  timeEstimate: string;
  actionLabel: string;
}

const mockActions: ActionItem[] = [
  {
    id: "1",
    agentType: "follow-up",
    title: "Follow up with Sarah Chen",
    subtitle:
      "Last email about pricing was 3 weeks ago. She opened your last message twice.",
    timeEstimate: "2 min",
    actionLabel: "Send Draft",
  },
  {
    id: "2",
    agentType: "reply",
    title: "Reply to Marcus Johnson",
    subtitle:
      "Asked about integration capabilities. AI draft ready for review.",
    timeEstimate: "1 min",
    actionLabel: "Review",
  },
  {
    id: "3",
    agentType: "warm-intro",
    title: "Warm intro to Alex Rivera",
    subtitle:
      "Jamie Park can introduce you. Alex matches your ICP perfectly.",
    timeEstimate: "3 min",
    actionLabel: "Request Intro",
  },
  {
    id: "4",
    agentType: "meeting-prep",
    title: "Prep for Vertex Labs call",
    subtitle: "Meeting at 2:00 PM. Key talking points and recent news ready.",
    timeEstimate: "5 min",
    actionLabel: "View Brief",
  },
  {
    id: "5",
    agentType: "deal-cold",
    title: "Relay Inc deal going cold",
    subtitle:
      "No activity in 12 days. Champion may have changed roles.",
    timeEstimate: "3 min",
    actionLabel: "Re-engage",
  },
  {
    id: "6",
    agentType: "new-prospect",
    title: "New prospect: Emily Watson",
    subtitle: "CRO at GrowthOS, 85 employees. Recently raised Series A.",
    timeEstimate: "2 min",
    actionLabel: "Add to Pipeline",
  },
];

export default function TodayScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [actions, setActions] = useState(mockActions);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleDismiss = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSwipeRight = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSwipeLeft = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#D4552A"
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-5">
          <Text className="text-charcoal text-3xl font-serif font-bold">
            Today
          </Text>
        </View>

        {/* Morning Briefing */}
        <MorningBriefing
          name="Alex"
          pendingActions={actions.length}
          meetingsToday={3}
          newReplies={7}
          salesMode
          pipelineHealth={72}
        />

        {/* Action Cards */}
        <View className="mt-6">
          <Text className="px-5 text-warm-500 text-xs font-semibold uppercase tracking-wider mb-3">
            Action Items
          </Text>
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              agentType={action.agentType}
              title={action.title}
              subtitle={action.subtitle}
              timeEstimate={action.timeEstimate}
              actionLabel={action.actionLabel}
              onAction={() => {}}
              onDismiss={() => handleDismiss(action.id)}
              onSwipeRight={() => handleSwipeRight(action.id)}
              onSwipeLeft={() => handleSwipeLeft(action.id)}
            />
          ))}
        </View>

        {/* Auto-actions section */}
        <View className="mx-5 mt-4 bg-warm-50 rounded-2xl p-4">
          <Text className="text-warm-600 text-xs font-semibold uppercase tracking-wider mb-2">
            Auto-Actions Today
          </Text>
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <View className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <Text className="text-warm-600 text-sm">
                3 follow-ups sent automatically
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <Text className="text-warm-600 text-sm">
                2 meeting notes logged to CRM
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <Text className="text-warm-600 text-sm">
                5 contacts enriched with new data
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
