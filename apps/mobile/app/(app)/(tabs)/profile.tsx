import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type NotificationPreferences } from "@/shared/api/services";
import { useMe, useLogout } from "@/features/auth/hooks";
import { useAccessScopes } from "@/features/profile/hooks";
import { AppIcon, AppText, Button, Card, ErrorState, LoadingState, Row, Screen, SectionHeader, StatusBadge, TextField } from "@/shared/ui/components";
import { theme } from "@/shared/config/theme";

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
    try { await logout.mutateAsync(); }
    finally { router.replace("/(auth)/login"); }
  };

  return (
    <Screen>
      <AppText variant="title">Профиль</AppText>
      {me.isLoading || scopes.isLoading ? <LoadingState /> : null}
      {me.isError ? <ErrorState error={me.error} onRetry={() => void me.refetch()} /> : null}
      {scopes.isError ? <ErrorState error={scopes.error} onRetry={() => void scopes.refetch()} /> : null}
      {me.data ? <Card>
        <Row>
          <View style={styles.avatar}><AppIcon name="user" size={26} color={theme.colors.brand.strong} /></View>
          <View style={{ flex: 1, gap: 3 }}><AppText variant="heading">{me.data.name}</AppText><AppText variant="muted">{me.data.email}</AppText></View>
          {scopes.data?.is_resident ? <StatusBadge label="Житель" tone="success" /> : null}
        </Row>
        {scopes.data?.scoped_roles.map((role) => <AppText key={role} variant="caption">{role === "company_admin" ? "Администратор управляющей компании" : "Техник"}</AppText>)}
        {scopes.data?.is_platform_admin ? <AppText variant="caption">Администратор платформы</AppText> : null}
      </Card> : null}

      <SectionHeader title="Уведомления" />
      {preferences.isLoading ? <LoadingState label="Загружаем настройки…" /> : null}
      {preferences.isError ? <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} /> : null}
      {preferences.data ? <Card>
        <AppText variant="muted">Выберите часовой пояс для тихих часов и уведомлений о событиях.</AppText>
        <TextField label="Часовой пояс" value={settings.timezone} onChangeText={(timezone) => setSettings({ ...settings, timezone })} autoCapitalize="none" />
        <Row style={styles.timeFields}>
          <View style={{ flex: 1 }}><TextField label="Тихие часы с" placeholder="22:00" value={settings.quiet_start?.slice(0, 5) ?? ""} onChangeText={(value) => setSettings({ ...settings, quiet_start: value || null })} /></View>
          <View style={{ flex: 1 }}><TextField label="До" placeholder="07:00" value={settings.quiet_end?.slice(0, 5) ?? ""} onChangeText={(value) => setSettings({ ...settings, quiet_end: value || null })} /></View>
        </Row>
        <PreferenceRow label="Камера недоступна" enabled={settings.camera_offline_enabled} onPress={() => setSettings({ ...settings, camera_offline_enabled: !settings.camera_offline_enabled })} />
        <PreferenceRow label="Изменился статус заявки" enabled={settings.ticket_status_enabled} onPress={() => setSettings({ ...settings, ticket_status_enabled: !settings.ticket_status_enabled })} />
        {savePreferences.isError ? <ErrorState error={savePreferences.error} /> : null}
        {pushMessage ? <AppText variant="muted">{pushMessage}</AppText> : null}
        <Button label="Сохранить настройки" onPress={() => savePreferences.mutate(settings)} disabled={savePreferences.isPending || preferences.isLoading} loading={savePreferences.isPending} />
      </Card> : null}

      <SectionHeader title="Push на этом устройстве" />
      <Card>
        <AppText variant="muted">Разрешите push, чтобы получать системные уведомления на устройстве.</AppText>
        <Button label="Зарегистрировать устройство" onPress={() => void registerToken()} secondary icon={<AppIcon name="bell" color={theme.colors.brand.strong} />} />
        {token ? <Button label="Отключить это устройство" onPress={() => void notificationsApi.unregisterDevice(token).then(() => { setToken(""); setPushMessage("Устройство отключено."); }).catch(() => setPushMessage("Не удалось отключить устройство. Попробуйте ещё раз."))} secondary /> : null}
      </Card>

      {logout.isError ? <AppText variant="muted">Не удалось завершить сессию на сервере, локальные токены очищены.</AppText> : null}
      <Button label="Выйти из аккаунта" onPress={() => void signOut()} disabled={logout.isPending} loading={logout.isPending} secondary />
    </Screen>
  );
}

function PreferenceRow({ label, enabled, onPress }: { label: string; enabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} onPress={onPress} style={styles.preferenceRow}>
    <AppText variant="body" style={{ flex: 1 }}>{label}</AppText>
    <StatusBadge label={enabled ? "Включено" : "Выключено"} tone={enabled ? "success" : "neutral"} />
  </Pressable>;
}

const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: theme.colors.brand.subtle },
  timeFields: { alignItems: "flex-start" },
  preferenceRow: { minHeight: theme.sizes.touchTargetMin, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
});
