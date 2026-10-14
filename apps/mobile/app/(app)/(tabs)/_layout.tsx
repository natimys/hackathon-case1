import { Tabs } from "expo-router";
import { theme } from "@/shared/config/theme";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.muted,
      tabBarStyle: { height: 62, paddingTop: 5, paddingBottom: 5 },
    }}>
      <Tabs.Screen name="index" options={{ title: "Главная", tabBarLabel: "Главная" }} />
      <Tabs.Screen name="billing" options={{ title: "Счета", tabBarLabel: "Счета" }} />
      <Tabs.Screen name="tickets" options={{ title: "Заявки", tabBarLabel: "Заявки" }} />
      <Tabs.Screen name="cameras" options={{ title: "Камеры", tabBarLabel: "Камеры" }} />
      <Tabs.Screen name="profile" options={{ title: "Профиль", tabBarLabel: "Профиль" }} />
    </Tabs>
  );
}
