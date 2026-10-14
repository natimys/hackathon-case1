import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppIcon, AppText, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionHeader, StatusBadge } from "@/shared/ui/components";
import { CameraPlayer } from "@/features/cameras/CameraPlayer";
import { useCameraStatus, useCameras } from "@/features/cameras/hooks";
import type { Camera } from "@/shared/api/services";
import { theme } from "@/shared/config/theme";

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
      <AppText variant="muted">Прямой эфир с камер вашего дома</AppText>
      {items.length === 0 ? <EmptyState title="Камеры пока не подключены" description="Доступные камеры появятся здесь после привязки к вашему дому." /> : <>
        {grid ? <Button label="Показать список" onPress={() => setGrid(false)} secondary icon={<AppIcon name="document" color={theme.colors.brand.strong} />} /> : <Button label="Смотреть до 4 камер" onPress={() => setGrid(true)} secondary icon={<AppIcon name="camera" color={theme.colors.brand.strong} />} />}
        {grid ? <View style={styles.grid}>{items.slice(0, 4).map((camera) => <View key={camera.id} style={styles.tile}><Card style={styles.cameraTile}><CameraPlayer camera={camera} compact /></Card></View>)}</View> : Array.from(groups, ([label, group]) => (
          <View key={label} style={styles.group}>
            <SectionHeader title={label} />
            {group.map((camera) => <CameraCard key={camera.id} camera={camera} onPress={() => router.push(`/cameras/${camera.id}`)} />)}
          </View>
        ))}
        {grid && items.length < 4 && <AppText variant="caption">Сейчас доступно камер: {items.length}. Свободные ячейки не показывают тестовые потоки.</AppText>}
      </>}
    </Screen>
  );
}

function CameraCard({ camera, onPress }: { camera: Camera; onPress: () => void }) {
  const status = useCameraStatus(camera.id);
  const value = status.data?.status ?? "unknown";
  const label = status.isLoading ? "Проверяем" : value === "online" ? "В сети" : value === "offline" ? "Нет связи" : "Статус неизвестен";
  return (
    <Card onPress={onPress}>
      <View style={styles.cameraCardRow}>
        <View style={styles.cameraInfo}><AppText variant="heading">{camera.name}</AppText><AppText variant="muted">{camera.location_description}</AppText><AppText variant="caption">Дом {camera.building_id}{camera.entrance_id ? ` · Подъезд ${camera.entrance_id}` : ""}</AppText></View>
        <StatusBadge label={label} tone={value === "online" ? "success" : value === "offline" ? "danger" : "neutral"} />
      </View>
      {status.isError ? <AppText variant="caption">Не удалось проверить соединение.</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  tile: { width: "48%", minHeight: 128 },
  cameraTile: { flex: 1, padding: 8, overflow: "hidden" },
  group: { gap: theme.spacing.xs },
  cameraCardRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  cameraInfo: { flex: 1, gap: 4 },
});
