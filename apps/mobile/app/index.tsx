import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useMe } from "@/features/auth/hooks";
import { ErrorState, LoadingState, Screen } from "@/shared/ui/components";

export default function IndexRoute() {
  const me = useMe();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);
  useEffect(() => {
    void SecureStore.getItemAsync("dozordom.welcome-seen").then((value) => setWelcomeSeen(value === "true")).catch(() => setWelcomeSeen(true));
  }, []);
  if (me.isLoading) return <Screen><LoadingState /></Screen>;
  if (me.isError) return <Screen><ErrorState error={me.error} onRetry={() => void me.refetch()} /></Screen>;
  if (me.data) return <Redirect href="/(app)/(tabs)" />;
  if (welcomeSeen === null) return <Screen><LoadingState /></Screen>;
  return <Redirect href={welcomeSeen ? "/(auth)/login" : "/(auth)/welcome"} />;
}
