import { useLocalSearchParams } from "expo-router";
import { AppText, ErrorState, LoadingState, Screen } from "@/shared/ui/components";
import { CameraPlayer } from "@/features/cameras/CameraPlayer";
import { useCameras } from "@/features/cameras/hooks";
import type { Camera } from "@/shared/api/services";

export default function CameraScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cameras = useCameras();
  if (cameras.isLoading) return <Screen><LoadingState label="Загружаем камеру…" /></Screen>;
  if (cameras.isError) return <Screen><ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} /></Screen>;
  const camera = cameras.data?.find((item) => item.id === id) as Camera | undefined;
  if (!camera) return <Screen><AppText variant="muted">Камера недоступна для вашего аккаунта.</AppText></Screen>;
  return <Screen><AppText variant="title">{camera.name}</AppText><AppText variant="muted">{camera.location_description}</AppText><CameraPlayer camera={camera} /></Screen>;
}
