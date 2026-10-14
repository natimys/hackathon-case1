import { useRouter } from "expo-router";
import { useMe, useLogout } from "@/features/auth/hooks";
import { useAccessScopes } from "@/features/profile/hooks";
import { AppText, Button, Card, ErrorState, LoadingState, Screen } from "@/shared/ui/components";

export default function ProfileScreen() {
  const me = useMe();
  const scopes = useAccessScopes();
  const logout = useLogout();
  const router = useRouter();

  const signOut = async () => {
    try {
      await logout.mutateAsync();
    } finally {
      router.replace("/(auth)/login");
    }
  };

  return (
    <Screen>
      <AppText variant="title">Профиль</AppText>
      {me.isLoading || scopes.isLoading ? <LoadingState /> : null}
      {me.isError ? <ErrorState error={me.error} onRetry={() => void me.refetch()} /> : null}
      {scopes.isError ? <ErrorState error={scopes.error} onRetry={() => void scopes.refetch()} /> : null}
      {me.data ? (
        <Card>
          <AppText variant="heading">{me.data.name}</AppText>
          <AppText variant="muted">{me.data.email}</AppText>
          {scopes.data?.is_resident ? <AppText variant="caption">Житель дома</AppText> : null}
          {scopes.data?.scoped_roles.map((role) => <AppText key={role} variant="caption">{role === "company_admin" ? "Администратор управляющей компании" : "Техник"}</AppText>)}
          {scopes.data?.is_platform_admin ? <AppText variant="caption">Администратор платформы</AppText> : null}
        </Card>
      ) : null}
      {logout.isError ? <AppText variant="muted">Не удалось завершить сессию на сервере, локальные токены очищены.</AppText> : null}
      <Button label={logout.isPending ? "Выходим…" : "Выйти из аккаунта"} onPress={() => void signOut()} disabled={logout.isPending} secondary />
    </Screen>
  );
}
