import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Send,
  Pencil,
  RefreshCw,
} from "lucide-react-native";
import { ThreadBubble } from "@/components/ThreadBubble";

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isOutgoing: boolean;
  isAiDraft?: boolean;
  senderName?: string;
}

const mockMessages: Message[] = [
  {
    id: "m1",
    content:
      "Hi, I wanted to follow up on our conversation about the enterprise pricing. We're very interested in moving forward with Mercury.",
    timestamp: "Mon 2:15 PM",
    isOutgoing: false,
    senderName: "Sarah Chen",
  },
  {
    id: "m2",
    content:
      "That's great to hear, Sarah! I'd love to walk you through the enterprise tier in more detail. When would be a good time for a call?",
    timestamp: "Mon 3:45 PM",
    isOutgoing: true,
  },
  {
    id: "m3",
    content:
      "Thanks for sending this over. I had a few questions about the enterprise tier, specifically around the API rate limits and SSO support. Also, do you offer volume discounts for teams over 100?",
    timestamp: "Today 10:30 AM",
    isOutgoing: false,
    senderName: "Sarah Chen",
  },
  {
    id: "m4",
    content:
      "Hi Sarah, great questions! Our enterprise tier includes unlimited API calls, full SSO/SAML support, and we absolutely offer volume discounts for teams of 100+. I'd love to put together a custom proposal for your team. Would Thursday work for a 30-minute call to go over the details?",
    timestamp: "Draft",
    isOutgoing: true,
    isAiDraft: true,
  },
];

export default function ThreadDetailScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const [composeText, setComposeText] = useState("");
  const [messages, setMessages] = useState(mockMessages);

  const handleSendDraft = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Send the AI draft
    setMessages((prev) =>
      prev.map((m) => (m.isAiDraft ? { ...m, isAiDraft: false, timestamp: "Just now" } : m))
    );
  };

  const handleEditDraft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const draft = messages.find((m) => m.isAiDraft);
    if (draft) {
      setComposeText(draft.content);
      setMessages((prev) => prev.filter((m) => !m.isAiDraft));
    }
  };

  const handleRegenerateDraft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Would trigger AI regeneration
  };

  const handleSend = () => {
    if (!composeText.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMessages((prev) => [
      ...prev,
      {
        id: `m${prev.length + 1}`,
        content: composeText,
        timestamp: "Just now",
        isOutgoing: true,
      },
    ]);
    setComposeText("");
  };

  const aiDraft = messages.find((m) => m.isAiDraft);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 border-b border-warm-100 bg-cream">
        <Pressable
          onPress={() => router.back()}
          className="mr-4 active:opacity-60"
        >
          <ArrowLeft size={24} color="#1A1815" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-charcoal text-base font-semibold">
            Sarah Chen
          </Text>
          <Text className="text-warm-500 text-xs">Re: Pricing Proposal</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {messages.map((message) => (
            <ThreadBubble
              key={message.id}
              content={message.content}
              timestamp={message.timestamp}
              isOutgoing={message.isOutgoing}
              isAiDraft={message.isAiDraft}
              senderName={message.senderName}
            />
          ))}
        </ScrollView>

        {/* AI Draft actions */}
        {aiDraft && (
          <View className="flex-row items-center justify-center gap-3 px-4 py-2 bg-sienna-50 border-t border-sienna-100">
            <Pressable
              onPress={handleSendDraft}
              className="bg-sienna px-5 py-2 rounded-full flex-row items-center gap-1.5 active:opacity-80"
            >
              <Send size={14} color="white" />
              <Text className="text-white text-sm font-semibold">Send</Text>
            </Pressable>
            <Pressable
              onPress={handleEditDraft}
              className="bg-white px-4 py-2 rounded-full flex-row items-center gap-1.5 border border-warm-200 active:opacity-80"
            >
              <Pencil size={14} color="#1A1815" />
              <Text className="text-charcoal text-sm font-medium">Edit</Text>
            </Pressable>
            <Pressable
              onPress={handleRegenerateDraft}
              className="bg-white px-4 py-2 rounded-full flex-row items-center gap-1.5 border border-warm-200 active:opacity-80"
            >
              <RefreshCw size={14} color="#1A1815" />
              <Text className="text-charcoal text-sm font-medium">Redo</Text>
            </Pressable>
          </View>
        )}

        {/* Compose input */}
        <View className="flex-row items-end px-4 py-3 bg-white border-t border-warm-100">
          <TextInput
            value={composeText}
            onChangeText={setComposeText}
            placeholder="Type a message..."
            placeholderTextColor="#B8B3A7"
            multiline
            className="flex-1 bg-warm-50 rounded-2xl px-4 py-2.5 text-charcoal text-[15px] max-h-24 mr-2"
          />
          <Pressable
            onPress={handleSend}
            disabled={!composeText.trim()}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              composeText.trim() ? "bg-sienna active:opacity-80" : "bg-warm-200"
            }`}
          >
            <Send
              size={18}
              color={composeText.trim() ? "white" : "#B8B3A7"}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
