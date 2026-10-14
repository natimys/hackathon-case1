import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/shared/config/theme";
import { errorMessage } from "@/shared/api/errors";

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const content = <View style={styles.screenContent}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function AppText({
  children,
  variant = "body",
  style,
}: PropsWithChildren<{ variant?: "title" | "heading" | "body" | "muted" | "caption"; style?: TextStyle }>) {
  return <Text style={[styles[variant], style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonLabel, secondary && styles.buttonSecondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

export function TextField({ label, error, multiline, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={theme.colors.muted}
        style={[styles.input, multiline && styles.multiline, props.style]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function LoadingState({ label = "Загружаем…" }: { label?: string }) {
  return <View style={styles.state}><ActivityIndicator color={theme.colors.primary} /><AppText variant="muted">{label}</AppText></View>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.state}>
      <AppText style={{ color: theme.colors.danger }}>{errorMessage(error)}</AppText>
      {onRetry ? <Button label="Повторить" onPress={onRetry} secondary /> : null}
    </View>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <AppText variant="heading">{title}</AppText>
      {description ? <AppText variant="muted">{description}</AppText> : null}
      {action}
    </View>
  );
}

export function Card({ children, onPress }: PropsWithChildren<{ onPress?: () => void }>) {
  if (onPress) return <Pressable onPress={onPress} style={styles.card}>{children}</Pressable>;
  return <View style={styles.card}>{children}</View>;
}

export function Row({ children }: PropsWithChildren) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  screenContent: { padding: theme.spacing.md, gap: theme.spacing.md, paddingBottom: 36 },
  title: { color: theme.colors.text, fontSize: 28, lineHeight: 34, fontWeight: "700" },
  heading: { color: theme.colors.text, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  body: { color: theme.colors.text, fontSize: 16, lineHeight: 23 },
  muted: { color: theme.colors.muted, fontSize: 14, lineHeight: 20 },
  caption: { color: theme.colors.muted, fontSize: 12, lineHeight: 17 },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: theme.radius, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 12 },
  buttonPressed: { backgroundColor: theme.colors.primaryPressed },
  buttonDisabled: { opacity: 0.55 },
  buttonSecondary: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  buttonLabel: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  buttonSecondaryLabel: { color: theme.colors.primary },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: theme.colors.text, fontWeight: "600", fontSize: 14 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.surface, color: theme.colors.text, fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 },
  multiline: { minHeight: 112, textAlignVertical: "top" },
  errorText: { color: theme.colors.danger, fontSize: 13 },
  state: { padding: 22, alignItems: "center", gap: 12 },
  empty: { padding: 24, alignItems: "center", gap: 8, backgroundColor: theme.colors.surface, borderRadius: theme.radius },
  card: { padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
});
