import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { SegmentPills } from "@/components/SegmentPills";
import { ContactRow } from "@/components/ContactRow";
import { EmptyState } from "@/components/EmptyState";

const SEGMENTS = [
  "All",
  "Hot Leads",
  "Warm",
  "Cold",
  "Candidates",
  "Connected",
  "Needs Follow-up",
];

interface Contact {
  id: string;
  name: string;
  title: string;
  company: string;
  outreachPath: "linkedin" | "email" | "warm-intro" | "mutual-connection";
  relationshipScore: number;
  lastInteraction: string;
}

const mockContacts: Contact[] = [
  {
    id: "1",
    name: "Sarah Chen",
    title: "VP Engineering",
    company: "Vertex Labs",
    outreachPath: "email",
    relationshipScore: 85,
    lastInteraction: "2h ago",
  },
  {
    id: "2",
    name: "Marcus Johnson",
    title: "CTO",
    company: "Relay Inc",
    outreachPath: "linkedin",
    relationshipScore: 62,
    lastInteraction: "3d ago",
  },
  {
    id: "3",
    name: "Alex Rivera",
    title: "Head of Sales",
    company: "Datastream",
    outreachPath: "warm-intro",
    relationshipScore: 45,
    lastInteraction: "1w ago",
  },
  {
    id: "4",
    name: "Priya Patel",
    title: "VP Product",
    company: "CloudFirst",
    outreachPath: "mutual-connection",
    relationshipScore: 38,
    lastInteraction: "2w ago",
  },
  {
    id: "5",
    name: "David Kim",
    title: "VP Sales",
    company: "ScaleUp AI",
    outreachPath: "email",
    relationshipScore: 72,
    lastInteraction: "5h ago",
  },
  {
    id: "6",
    name: "Emily Watson",
    title: "CRO",
    company: "GrowthOS",
    outreachPath: "linkedin",
    relationshipScore: 28,
    lastInteraction: "3w ago",
  },
  {
    id: "7",
    name: "James Park",
    title: "Director of Engineering",
    company: "NovaTech",
    outreachPath: "warm-intro",
    relationshipScore: 55,
    lastInteraction: "4d ago",
  },
  {
    id: "8",
    name: "Lisa Zhang",
    title: "Head of Revenue",
    company: "Amplify",
    outreachPath: "email",
    relationshipScore: 90,
    lastInteraction: "1h ago",
  },
];

export default function PeopleScreen() {
  const router = useRouter();
  const [activeSegment, setActiveSegment] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const filteredContacts = mockContacts.filter((contact) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        contact.name.toLowerCase().includes(query) ||
        contact.company.toLowerCase().includes(query) ||
        contact.title.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-onBackground text-3xl font-bold mb-4">
          People
        </Text>

        {/* Search bar */}
        <View className="bg-surfaceContainerHigh rounded-full flex-row items-center px-4 py-2.5">
          <Search size={18} color="#767680" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search contacts..."
            placeholderTextColor="#767680"
            className="flex-1 ml-2 text-onSurface text-[15px]"
          />
        </View>
      </View>

      {/* Segment pills */}
      <SegmentPills
        segments={SEGMENTS}
        activeSegment={activeSegment}
        onSelect={setActiveSegment}
      />

      {/* Contact list */}
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactRow
            name={item.name}
            title={item.title}
            company={item.company}
            outreachPath={item.outreachPath}
            relationshipScore={item.relationshipScore}
            lastInteraction={item.lastInteraction}
            onPress={() => router.push(`/(tabs)/people/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View className="h-px bg-outlineVariant ml-16" />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No contacts found"
            message="Try adjusting your search or filters."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A237E"
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}
