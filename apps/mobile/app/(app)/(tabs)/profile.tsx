import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, TextInput } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type NotificationPreferences } from "@/shared/api/services";
import { useMe, useLogout } from "@/features/auth/hooks";
import { useAccessScopes } from "@/features/profile/hooks";
import { AppText, Button, Card, ErrorState, LoadingState, Screen } from "@/shared/ui/components";

export default function ProfileScreen() {
  const me = useMe();
  const scopes = useAccessScopes();
  const logout = useLogout();
  const router = useRouter();
  const client = useQueryClient();
  const preferences = useQuery({ queryKey: ["notification-preferences"], queryFn: notificationsApi.preferences });
  const [settings, setSettings] = useState<NotificationPreferences>({ timezone: "Asia/Yakutsk", quiet_start: null, quiet_end: null, camera_offline_enabled: true, ticket_status_enabled: true });
  const [token, setToken] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  useEffect(() => { if (preferences.data) setSettings(preferences.data); }, [preferences.data]);
  const savePreferences = useMutation({ mutationFn: notificationsApi.savePreferences, onSuccess: () => { setPushMessage("Настройки уведомлений сохранены."); void client.invalidateQueries({ queryKey: ["notification-preferences"] }); } });
  const registerToken = async () => {
    try {
      if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Уведомления", importance: Notifications.AndroidImportance.DEFAULT });
      let status = (await Notifications.getPermissionsAsync()).status;
      if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
      if (status !== "granted") throw new Error("Разрешение на уведомления не предоставлено.");
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
      if (!projectId) throw new Error("Для push нужен EXPO_PUBLIC_EAS_PROJECT_ID из настроек EAS.");
      const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await notificationsApi.registerDevice(expoToken);
      setToken(expoToken);
      setPushMessage("Устройство зарегистрировано для push-уведомлений.");
    } catch (error) { setPushMessage(error instanceof Error ? error.message : "Не удалось зарегистрировать устройство."); }
  };

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
      <Card>
        <AppText variant="heading">Push-уведомления</AppText>
        <AppText variant="muted">Тихие часы рассчитываются в выбранном часовом поясе.</AppText>
        <AppText variant="caption">Часовой пояс IANA</AppText>
        <TextInput accessibilityLabel="Часовой пояс" value={settings.timezone} onChangeText={(timezone) => setSettings({ ...settings, timezone })} autoCapitalize="none" />
        <AppText variant="caption">Тихие часы, например 22:00–07:00</AppText>
        <TextInput accessibilityLabel="Начало тихих часов" placeholder="22:00" value={settings.quiet_start?.slice(0, 5) ?? ""} onChangeText={(value) => setSettings({ ...settings, quiet_start: value || null })} />
        <TextInput accessibilityLabel="Окончание тихих часов" placeholder="07:00" value={settings.quiet_end?.slice(0, 5) ?? ""} onChangeText={(value) => setSettings({ ...settings, quiet_end: value || null })} />
        <Button label={settings.camera_offline_enabled ? "Отключить уведомления о камерах" : "Включить уведомления о камерах"} onPress={() => setSettings({ ...settings, camera_offline_enabled: !settings.camera_offline_enabled })} secondary />
        <Button label={settings.ticket_status_enabled ? "Отключить статусы заявок" : "Включить статусы заявок"} onPress={() => setSettings({ ...settings, ticket_status_enabled: !settings.ticket_status_enabled })} secondary />
        <Button label="Сохранить настройки" onPress={() => savePreferences.mutate(settings)} disabled={savePreferences.isPending} />
        <Button label="Зарегистрировать устройство" onPress={() => void registerToken()} secondary />
        {token ? <Button label="Отключить это устройство" onPress={() => void notificationsApi.unregisterDevice(token).then(() => { setToken(""); setPushMessage("Устройство отключено."); })} secondary /> : null}
        {pushMessage ? <AppText variant="muted">{pushMessage}</AppText> : null}
      </Card>
      {logout.isError ? <AppText variant="muted">Не удалось завершить сессию на сервере, локальные токены очищены.</AppText> : null}
      <Button label={logout.isPending ? "Выходим…" : "Выйти из аккаунта"} onPress={() => void signOut()} disabled={logout.isPending} secondary />
    </Screen>
  );
}
