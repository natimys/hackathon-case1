import { useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/shared/config/theme";
import { errorMessage } from "@/shared/api/errors";

export function Screen({ children, scroll = true, contentStyle }: PropsWithChildren<{ scroll?: boolean; contentStyle?: ViewStyle }>) {
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 360 ? 16 : theme.sizes.horizontalPagePadding;
  const content = <View style={[styles.screenContent, { paddingHorizontal: horizontalPadding }, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>{content}</ScrollView> : content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type TextVariant = "title" | "heading" | "body" | "muted" | "caption" | "section" | "amount" | "display";

export type IconName = "home" | "camera" | "card" | "ticket" | "user" | "bell" | "location" | "chevron" | "document" | "clock" | "settings" | "plus" | "arrow" | "logout";

const iconGlyph: Record<IconName, string> = {
  home: "⌂", camera: "◉", card: "▱", ticket: "☷", user: "◯", bell: "♢",
  location: "⌖", chevron: "⌄", document: "▤", clock: "◷", settings: "⚙",
  plus: "+", arrow: "›", logout: "↪",
};

export function AppIcon({ name, size = 22, color = theme.colors.icon }: { name: IconName; size?: number; color?: string }) {
  const stroke = Math.max(1.6, size / 11);
  const line = { borderColor: color, borderWidth: stroke } as const;
  let artwork: ReactNode;
  if (name === "home") artwork = <View style={{ width: size * 0.68, height: size * 0.68, alignItems: "center", justifyContent: "flex-end" }}><View style={{ width: size * 0.48, height: size * 0.48, borderLeftWidth: stroke, borderTopWidth: stroke, borderColor: color, transform: [{ rotate: "45deg" }], position: "absolute", top: size * 0.04 }} /><View style={{ width: size * 0.55, height: size * 0.42, borderTopWidth: 0, ...line, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} /></View>;
  else if (name === "camera") artwork = <View style={{ width: size * 0.82, height: size * 0.62, borderRadius: 4, alignItems: "center", justifyContent: "center", ...line }}><View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size, ...line }} /><View style={{ position: "absolute", top: -size * 0.13, left: size * 0.15, width: size * 0.24, height: size * 0.14, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderTopWidth: stroke, borderLeftWidth: stroke, borderRightWidth: stroke, borderColor: color }} /></View>;
  else if (name === "card") artwork = <View style={{ width: size * 0.88, height: size * 0.64, borderRadius: 3, ...line }}><View style={{ position: "absolute", top: size * 0.18, left: 0, right: 0, height: stroke * 1.25, backgroundColor: color }} /></View>;
  else if (name === "ticket") artwork = <View style={{ width: size * 0.68, height: size * 0.82, borderRadius: 3, justifyContent: "center", gap: size * 0.12, paddingHorizontal: size * 0.11, ...line }}><View style={{ height: stroke, backgroundColor: color }} /><View style={{ height: stroke, backgroundColor: color }} /><View style={{ width: "70%", height: stroke, backgroundColor: color }} /></View>;
  else if (name === "user") artwork = <View style={{ alignItems: "center", justifyContent: "center", gap: size * 0.08 }}><View style={{ width: size * 0.29, height: size * 0.29, borderRadius: size, ...line }} /><View style={{ width: size * 0.68, height: size * 0.34, borderTopLeftRadius: size, borderTopRightRadius: size, borderLeftWidth: stroke, borderRightWidth: stroke, borderTopWidth: stroke, borderColor: color, marginTop: size * 0.03 }} /></View>;
  else if (name === "bell") artwork = <View style={{ alignItems: "center", justifyContent: "center" }}><View style={{ width: size * 0.58, height: size * 0.62, borderTopLeftRadius: size * 0.34, borderTopRightRadius: size * 0.34, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, ...line }} /><View style={{ position: "absolute", bottom: size * 0.13, width: size * 0.72, height: stroke, backgroundColor: color }} /><View style={{ position: "absolute", top: size * 0.04, width: stroke, height: size * 0.11, backgroundColor: color }} /></View>;
  else artwork = <Text style={{ color, fontSize: size, lineHeight: size + 4, textAlign: "center", minWidth: size }}>{iconGlyph[name]}</Text>;
  return <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>{artwork}</View>;
}

export function AppText({ children, variant = "body", style, ...props }: PropsWithChildren<{ variant?: TextVariant; style?: TextStyle; accessibilityLabel?: string }>) {
  return <Text accessibilityLabel={props.accessibilityLabel} style={[styles[variant], style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
  loading = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        pressed && !inactive && (secondary ? styles.buttonSecondaryPressed : styles.buttonPressed),
        inactive && styles.buttonDisabled,
      ]}
    >
      {loading ? <ActivityIndicator color={secondary ? theme.colors.brand.strong : theme.colors.onBrand} /> : icon}
      <Text style={[styles.buttonLabel, secondary && styles.buttonSecondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

export function TextField({ label, error, multiline, ...props }: TextInputProps & { label: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  const onFocus = props.onFocus;
  const onBlur = props.onBlur;
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        multiline={multiline}
        placeholderTextColor={theme.colors.textMuted}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, focused && styles.inputFocused, error && styles.inputError, multiline && styles.multiline, props.style]}
      />
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function LoadingState({ label = "Загружаем…" }: { label?: string }) {
  return <View style={styles.state}><ActivityIndicator color={theme.colors.brand.strong} /><AppText variant="muted">{label}</AppText></View>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.errorState}>
      <AppText style={styles.errorText}>{errorMessage(error)}</AppText>
      {onRetry ? <Button label="Повторить" onPress={onRetry} secondary /> : null}
    </View>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <View style={styles.empty}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <AppText variant="heading" style={styles.center}>{title}</AppText>
      {description ? <AppText variant="muted" style={styles.center}>{description}</AppText> : null}
      {action}
    </View>
  );
}

export function Card({ children, onPress, style, accessibilityLabel }: PropsWithChildren<{ onPress?: () => void; style?: ViewStyle; accessibilityLabel?: string }>) {
  if (onPress) return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]}>{children}</Pressable>;
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Surface({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function Row({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}>
    <AppText variant="section" style={styles.sectionTitle}>{title}</AppText>
    {action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={styles.textAction}><AppText style={styles.actionText}>{action}</AppText></Pressable> : null}
  </View>;
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  return <View style={[styles.badge, styles[`badge_${tone}`]]}><Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  screenContent: { flexGrow: 1, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md },
  display: { color: theme.colors.text, ...theme.type.display },
  title: { color: theme.colors.text, ...theme.type.title },
  section: { color: theme.colors.text, ...theme.type.section },
  heading: { color: theme.colors.text, ...theme.type.heading },
  amount: { color: theme.colors.text, ...theme.type.amount, fontVariant: ["tabular-nums"] },
  body: { color: theme.colors.text, ...theme.type.body },
  muted: { color: theme.colors.textSecondary, ...theme.type.supporting },
  caption: { color: theme.colors.textMuted, ...theme.type.caption },
  button: { minHeight: theme.sizes.buttonHeight, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderRadius: theme.radius.sm, backgroundColor: theme.colors.brand.primary, paddingHorizontal: 18, paddingVertical: 14 },
  buttonPressed: { backgroundColor: theme.colors.brand.pressed, transform: [{ scale: 0.99 }] },
  buttonDisabled: { backgroundColor: theme.colors.disabledBg, opacity: 1 },
  buttonSecondary: { minHeight: theme.sizes.secondaryButtonHeight, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  buttonSecondaryPressed: { backgroundColor: theme.colors.surfaceAlt },
  buttonLabel: { color: theme.colors.onBrand, fontWeight: theme.type.button.fontWeight, fontSize: theme.type.button.fontSize, lineHeight: theme.type.button.lineHeight, textAlign: "center" },
  buttonSecondaryLabel: { color: theme.colors.brand.strong },
  fieldGroup: { gap: 8 },
  fieldLabel: { color: theme.colors.text, fontWeight: "600", fontSize: 14, lineHeight: 20 },
  input: { minHeight: theme.sizes.inputHeight, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, fontSize: 16, lineHeight: 22, paddingHorizontal: 14, paddingVertical: 13 },
  inputFocused: { borderColor: theme.colors.brand.primary, borderWidth: 1.5 },
  inputError: { borderColor: theme.colors.danger },
  multiline: { minHeight: 128, textAlignVertical: "top" },
  errorText: { color: theme.colors.danger, fontSize: 13, lineHeight: 19 },
  state: { minHeight: 112, padding: 22, alignItems: "center", justifyContent: "center", gap: 12 },
  errorState: { padding: 16, alignItems: "flex-start", gap: 12, backgroundColor: theme.colors.dangerBg, borderRadius: theme.radius.sm },
  empty: { padding: 24, alignItems: "center", gap: 10, backgroundColor: theme.colors.surface, borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.border },
  emptyIcon: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: theme.colors.brand.subtle },
  center: { textAlign: "center" },
  card: { padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.border, gap: theme.spacing.sm },
  cardPressed: { borderColor: theme.colors.brand.subtleBorder, backgroundColor: theme.colors.surfacePressed },
  surface: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, padding: theme.spacing.md, gap: theme.spacing.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  sectionTitle: { flexShrink: 1 },
  textAction: { minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" },
  actionText: { color: theme.colors.brand.strong, fontWeight: "600" },
  badge: { alignSelf: "flex-start", borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
  badge_success: { backgroundColor: theme.colors.successBg },
  badge_warning: { backgroundColor: theme.colors.warningBg },
  badge_danger: { backgroundColor: theme.colors.dangerBg },
  badge_info: { backgroundColor: theme.colors.infoBg },
  badge_neutral: { backgroundColor: theme.colors.surfaceAlt },
  badgeText_success: { color: theme.colors.success },
  badgeText_warning: { color: theme.colors.warning },
  badgeText_danger: { color: theme.colors.danger },
  badgeText_info: { color: theme.colors.info },
  badgeText_neutral: { color: theme.colors.textSecondary },
});
