import { Redirect } from "expo-router";
import { useMe } from "@/features/auth/hooks";
import { ErrorState, LoadingState, Screen } from "@/shared/ui/components";

export default function IndexRoute() {
  const me = useMe();
  if (me.isLoading) return <Screen><LoadingState /></Screen>;
  if (me.isError) return <Screen><ErrorState error={me.error} onRetry={() => void me.refetch()} /></Screen>;
  return <Redirect href={me.data ? "/(app)/(tabs)" : "/(auth)/login"} />;
}
