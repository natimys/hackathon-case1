import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/components";
import { theme } from "@/shared/config/theme";
import { useCameraSession } from "./hooks";
import { HlsPlayer } from "./HlsPlayer";
import type { Camera } from "@/shared/api/services";

export function CameraPlayer({ camera, compact = false }: { camera: Camera; compact?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const session = useCameraSession(camera.id);
  if (session.isLoading) return <State title={camera.name} detail="Подключаемся…" />;
  if (session.isError || !session.data) {
    return <State title={camera.name} detail="Нет сигнала. Проверьте соединение и повторите." onRetry={() => { setAttempt(attempt + 1); void session.refetch(); }} />;
  }
  if (playbackFailed) return <State title={camera.name} detail="Не удалось воспроизвести поток. Подключитесь снова." onRetry={async () => { setPlaybackFailed(false); await session.refetch(); setAttempt((value) => value + 1); }} />;
  return (
    <HlsPlayer key={`${camera.id}-${attempt}`} cameraName={camera.name} uri={session.data.url} token={session.data.token} compact={compact} onPlaybackError={() => setPlaybackFailed(true)} />
  );
}

function State({ title, detail, onRetry }: { title: string; detail: string; onRetry?: () => void }) {
  return (
    <View style={styles.state}>
      <AppText variant="heading" style={styles.stateTitle}>{title}</AppText>
      <AppText variant="caption" style={styles.stateDetail}>{detail}</AppText>
      {onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><AppText variant="body" style={styles.retry}>Повторить подключение</AppText></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { minHeight: 140, backgroundColor: theme.colors.videoBackground, borderRadius: theme.radius.card, padding: 16, justifyContent: "center", gap: 8 },
  stateTitle: { color: theme.colors.videoText },
  stateDetail: { color: theme.colors.videoMuted },
  retryButton: { minHeight: theme.sizes.touchTargetMin, alignSelf: "flex-start", justifyContent: "center" },
  retry: { color: theme.colors.brand.primary, paddingTop: 4, fontWeight: "600" },
});
