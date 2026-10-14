import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { AppIcon, AppText, Button, Screen } from "@/shared/ui/components";
import { theme } from "@/shared/config/theme";

const slides = [
  { icon: "home" as const, title: "Ваш дом под наблюдением", body: "Камеры двора и подъезда — прямо в телефоне." },
  { icon: "bell" as const, title: "Всё важное — вовремя", body: "Узнавайте о неполадках и обращайтесь в поддержку." },
  { icon: "card" as const, title: "Удобно и безопасно", body: "Контролируйте доступ к камерам и оплачивайте услуги." },
];

export default function WelcomeScreen() {
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const finish = async () => {
    try { await SecureStore.setItemAsync("dozordom.welcome-seen", "true"); } catch { /* Continue to sign-in if local storage is unavailable. */ }
    router.replace("/(auth)/login");
  };
  const current = slides[index];

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <AppText variant="heading">ДозорДом</AppText>
          <Pressable accessibilityRole="button" onPress={() => void finish()} style={styles.skip}><AppText style={styles.skipText}>Пропустить</AppText></Pressable>
        </View>
        <View style={styles.hero}>
          <View style={styles.heroCircle}><AppIcon name={current.icon} size={52} color={theme.colors.brand.strong} /></View>
          <View style={styles.brandMark}><AppIcon name="camera" size={22} color={theme.colors.brand.strong} /></View>
        </View>
        <View style={styles.copy}>
          <AppText variant="title" style={styles.title}>{current.title}</AppText>
          <AppText variant="body" style={styles.body}>{current.body}</AppText>
        </View>
        <View style={styles.dots} accessibilityLabel={`Экран ${index + 1} из ${slides.length}`}>
          {slides.map((slide, dotIndex) => <View key={slide.title} style={[styles.dot, dotIndex === index && styles.dotActive]} />)}
        </View>
        <View style={styles.actions}>
          <Button label={index === slides.length - 1 ? "Начать" : "Далее"} onPress={() => index === slides.length - 1 ? void finish() : setIndex(index + 1)} />
          <Pressable accessibilityRole="button" onPress={() => void finish()} style={styles.loginAction}>
            <AppText style={styles.loginText}>У меня есть аккаунт</AppText>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1, justifyContent: "center", paddingTop: 0 },
  content: { flex: 1, width: "100%", maxWidth: 440, alignSelf: "center", justifyContent: "space-between", paddingVertical: theme.spacing.md },
  topBar: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  skipText: { color: theme.colors.textSecondary, fontWeight: "600" },
  hero: { minHeight: 230, alignItems: "center", justifyContent: "center", position: "relative" },
  heroCircle: { width: 176, height: 176, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brand.subtle, alignItems: "center", justifyContent: "center" },
  brandMark: { position: "absolute", right: "25%", bottom: 28, width: 48, height: 48, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  copy: { gap: theme.spacing.sm, alignItems: "flex-start" },
  title: { maxWidth: 360 },
  body: { maxWidth: 360, color: theme.colors.textSecondary },
  dots: { minHeight: 32, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.border },
  dotActive: { width: 22, backgroundColor: theme.colors.brand.primary },
  actions: { gap: theme.spacing.xs },
  loginAction: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  loginText: { color: theme.colors.brand.strong, fontWeight: "600" },
});
