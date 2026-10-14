import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/components";
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
      <AppText variant="heading">{title}</AppText>
      <AppText variant="caption">{detail}</AppText>
      {onRetry && <Pressable onPress={onRetry}><AppText variant="body" style={styles.retry}>Повторить</AppText></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { minHeight: 120, backgroundColor: "#111827", borderRadius: 12, padding: 16, justifyContent: "center", gap: 8 },
  retry: { color: "#60a5fa", paddingTop: 4 },
});
