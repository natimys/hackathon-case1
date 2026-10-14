import { Tabs } from "expo-router";
import { theme } from "@/shared/config/theme";
import { AppIcon, type IconName } from "@/shared/ui/components";

const tabOptions = (name: IconName, title: string) => ({
  title,
  tabBarLabel: title,
  tabBarIcon: ({ focused, size }: { focused: boolean; size: number }) => (
    <AppIcon name={name} size={size} color={focused ? theme.colors.brand.strong : theme.colors.textMuted} />
  ),
});

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.colors.brand.strong,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 1 },
      tabBarStyle: { minHeight: theme.sizes.tabBarVisualHeight, paddingTop: 5, paddingBottom: 4, backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border, borderTopWidth: 1, elevation: 0 },
    }}>
      <Tabs.Screen name="index" options={tabOptions("home", "Главная")} />
      <Tabs.Screen name="cameras" options={tabOptions("camera", "Камеры")} />
      <Tabs.Screen name="billing" options={tabOptions("card", "Платежи")} />
      <Tabs.Screen name="tickets" options={tabOptions("ticket", "Заявки")} />
      <Tabs.Screen name="profile" options={tabOptions("user", "Профиль")} />
    </Tabs>
  );
}
