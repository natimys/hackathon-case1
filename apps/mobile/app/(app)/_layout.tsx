import { useEffect } from "react";
import { Redirect, Stack, useRouter } from "expo-router";
import { useMe } from "@/features/auth/hooks";
import { ErrorState, LoadingState, Screen } from "@/shared/ui/components";

export default function PrivateLayout() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (!me.isLoading && (me.isError || !me.data)) router.replace("/(auth)/login");
  }, [me.isError, me.isLoading, me.data, router]);
  if (me.isLoading) return <Screen><LoadingState /></Screen>;
  if (me.isError) {
    const status = me.error && typeof me.error === "object" && "status" in me.error
      ? (me.error as { status: number | null }).status
      : null;
    if (status === 401) return <Redirect href="/(auth)/login" />;
    return <Screen><ErrorState error={me.error} onRetry={() => void me.refetch()} /></Screen>;
  }
  if (!me.data) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
