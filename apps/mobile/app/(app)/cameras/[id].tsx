import { useLocalSearchParams } from "expo-router";
import { AppText, Card, ErrorState, LoadingState, Row, Screen, SectionHeader, StatusBadge } from "@/shared/ui/components";
import { CameraPlayer } from "@/features/cameras/CameraPlayer";
import { useCameraStatus, useCameras } from "@/features/cameras/hooks";
import type { Camera } from "@/shared/api/services";

export default function CameraScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cameras = useCameras();
  const status = useCameraStatus(id);
  if (cameras.isLoading) return <Screen><LoadingState label="Загружаем камеру…" /></Screen>;
  if (cameras.isError) return <Screen><ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} /></Screen>;
  const camera = cameras.data?.find((item) => item.id === id) as Camera | undefined;
  if (!camera) return <Screen><AppText variant="muted">Камера недоступна для вашего аккаунта.</AppText></Screen>;
  const state = status.data?.status;
  return <Screen>
    <AppText variant="title">{camera.name}</AppText>
    <Card>
      <Row><AppText variant="muted">Статус камеры</AppText><StatusBadge label={state === "online" ? "В сети" : state === "offline" ? "Нет связи" : "Статус неизвестен"} tone={state === "online" ? "success" : state === "offline" ? "danger" : "neutral"} /></Row>
      <AppText variant="muted">{camera.location_description}</AppText>
      {status.isError ? <ErrorState error={status.error} onRetry={() => void status.refetch()} /> : null}
    </Card>
    <CameraPlayer camera={camera} />
    <SectionHeader title="О камере" />
    <Card><AppText variant="caption">Расположение</AppText><AppText variant="body">Дом {camera.building_id}{camera.entrance_id ? ` · подъезд ${camera.entrance_id}` : ""} · {camera.location_description}</AppText></Card>
  </Screen>;
}
