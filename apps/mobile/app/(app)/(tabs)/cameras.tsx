import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, Card, EmptyState, ErrorState, LoadingState, Screen } from "@/shared/ui/components";
import { CameraPlayer } from "@/features/cameras/CameraPlayer";
import { useCameraStatus, useCameras } from "@/features/cameras/hooks";
import type { Camera } from "@/shared/api/services";

export default function CamerasScreen() {
  const cameras = useCameras();
  const [grid, setGrid] = useState(false);
  const router = useRouter();
  if (cameras.isLoading) return <Screen><LoadingState label="Загружаем камеры…" /></Screen>;
  if (cameras.isError) return <Screen><ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} /></Screen>;
  const items = cameras.data ?? [];
  const groups = new Map<string, Camera[]>();
  for (const camera of items) {
    const key = `Дом ${camera.building_id}${camera.entrance_id ? ` · подъезд ${camera.entrance_id}` : ""}`;
    groups.set(key, [...(groups.get(key) ?? []), camera]);
  }
  return (
    <Screen>
      <AppText variant="title">Камеры</AppText>
      {items.length === 0 ? <EmptyState title="Камеры недоступны" description="Для вашего дома пока не зарегистрированы камеры." /> : <>
        <Pressable style={styles.toggle} onPress={() => setGrid(!grid)}>
          <AppText variant="body">{grid ? "Показать список" : "Смотреть 4 камеры"}</AppText>
        </Pressable>
        {grid ? <View style={styles.grid}>{items.slice(0, 4).map((camera) => <View key={camera.id} style={styles.tile}><CameraPlayer camera={camera} compact /></View>)}</View> : Array.from(groups, ([label, group]) => (
          <View key={label} style={styles.group}>
            <AppText variant="heading">{label}</AppText>
            {group.map((camera) => <CameraCard key={camera.id} camera={camera} onPress={() => router.push(`/cameras/${camera.id}`)} />)}
          </View>
        ))}
        {grid && items.length < 4 && <AppText variant="muted">Зарегистрировано камер: {items.length}. Для сетки 2×2 нужны четыре камеры.</AppText>}
      </>}
    </Screen>
  );
}

function CameraCard({ camera, onPress }: { camera: Camera; onPress: () => void }) {
  const status = useCameraStatus(camera.id);
  const value = status.data?.status ?? "unknown";
  const label = value === "online" ? "В сети" : value === "offline" ? "Нет сигнала" : "Статус неизвестен";
  return (
    <Card onPress={onPress}>
      <AppText variant="heading">{camera.name}</AppText>
      <AppText variant="muted">Дом {camera.building_id}{camera.entrance_id ? ` · Подъезд ${camera.entrance_id}` : ""}</AppText>
      <AppText variant="muted">{camera.location_description}</AppText>
      <AppText variant="caption">{label}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  toggle: { borderRadius: 10, padding: 12, backgroundColor: "#e8f0fe", alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48%", minHeight: 120 },
  group: { gap: 8 },
});
