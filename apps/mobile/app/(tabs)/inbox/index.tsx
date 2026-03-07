import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { SegmentPills } from "@/components/SegmentPills";
import { EmptyState } from "@/components/EmptyState";

const FILTERS = ["All", "Needs Reply", "AI Drafted", "Sent", "Snoozed"];

interface Thread {
  id: string;
  senderName: string;
  subject: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  intentBadge?: string;
  intentVariant?: "sienna" | "success" | "warning" | "info" | "muted";
  hasAiDraft?: boolean;
}

const mockThreads: Thread[] = [
  {
    id: "t1",
    senderName: "Sarah Chen",
    subject: "Re: Pricing Proposal",
    preview: "Thanks for sending this over. I had a few questions about the enterprise tier...",
    timestamp: "2h ago",
    unread: true,
    intentBadge: "Interested",
    intentVariant: "success",
  },
  {
    id: "t2",
    senderName: "Marcus Johnson",
    subject: "Integration capabilities",
    preview: "Hi, can you tell me more about your API and how it integrates with Salesforce?",
    timestamp: "5h ago",
    unread: true,
    intentBadge: "Question",
    intentVariant: "info",
    hasAiDraft: true,
  },
  {
    id: "t3",
    senderName: "Lisa Zhang",
    subject: "Intro: Alex Rivera <> You",
    preview: "Connecting you two since I think there's a great opportunity to collaborate...",
    timestamp: "1d ago",
    unread: false,
    intentBadge: "Warm Intro",
    intentVariant: "sienna",
  },
  {
    id: "t4",
    senderName: "David Kim",
    subject: "Re: Demo Follow-up",
    preview: "The demo was great. Let me loop in our CTO to discuss next steps.",
    timestamp: "1d ago",
    unread: false,
    intentBadge: "Moving Forward",
    intentVariant: "success",
  },
  {
    id: "t5",
    senderName: "James Park",
    subject: "Partnership opportunity",
    preview: "We've been looking for a solution like yours. Would love to explore a partnership...",
    timestamp: "2d ago",
    unread: false,
    intentBadge: "Opportunity",
    intentVariant: "warning",
    hasAiDraft: true,
  },
  {
    id: "t6",
    senderName: "Emily Watson",
    subject: "Quick question about onboarding",
    preview: "How long does the typical onboarding process take? We need to plan for Q2...",
    timestamp: "3d ago",
    unread: false,
    intentBadge: "Question",
    intentVariant: "info",
  },
];

function ThreadRow({
  thread,
  onPress,
}: {
  thread: Thread;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      className={`flex-row px-5 py-4 active:bg-warm-50 ${
        thread.unread ? "bg-white" : "bg-cream"
      }`}
    >
      <View className="relative">
        <Avatar name={thread.senderName} size="md" />
        {thread.unread && (
          <View className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-sienna rounded-full border-2 border-cream" />
        )}
      </View>

      <View className="flex-1 ml-3">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text
            className={`text-[15px] flex-1 mr-2 ${
              thread.unread
                ? "text-charcoal font-semibold"
                : "text-warm-700 font-medium"
            }`}
            numberOfLines={1}
          >
            {thread.senderName}
          </Text>
          <Text className="text-warm-400 text-[11px]">{thread.timestamp}</Text>
        </View>

        <Text
          className={`text-[13px] mb-1 ${
            thread.unread
              ? "text-charcoal font-medium"
              : "text-warm-600"
          }`}
          numberOfLines={1}
        >
          {thread.subject}
        </Text>

        <Text className="text-warm-500 text-[13px]" numberOfLines={1}>
          {thread.preview}
        </Text>

        <View className="flex-row items-center gap-2 mt-1.5">
          {thread.intentBadge && (
            <Badge
              label={thread.intentBadge}
              variant={thread.intentVariant}
              size="sm"
            />
          )}
          {thread.hasAiDraft && (
            <Badge label="AI Draft Ready" variant="sienna" size="sm" />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-charcoal text-3xl font-serif font-bold">
          Inbox
        </Text>
      </View>

      {/* Filter pills */}
      <SegmentPills
        segments={FILTERS}
        activeSegment={activeFilter}
        onSelect={setActiveFilter}
      />

      {/* Thread list */}
      <FlatList
        data={mockThreads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ThreadRow
            thread={item}
            onPress={() => router.push(`/(tabs)/inbox/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View className="h-px bg-warm-100 ml-16" />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Inbox zero!"
            message="You're all caught up. New messages will appear here."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#D4552A"
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}
