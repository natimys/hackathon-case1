import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "@/shared/api/query-client";
import { setSessionExpiredHandler } from "@/shared/api/client";

setSessionExpiredHandler(() => queryClient.clear());

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </QueryClientProvider>
  );
}
