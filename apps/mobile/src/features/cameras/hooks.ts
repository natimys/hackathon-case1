import { useQuery } from "@tanstack/react-query";
import { camerasApi } from "@/shared/api/services";

export function useCameras() {
  return useQuery({ queryKey: ["cameras"], queryFn: camerasApi.list });
}

export function useCameraStatus(id: string) {
  return useQuery({ queryKey: ["cameras", id, "status"], queryFn: () => camerasApi.status(id), refetchInterval: 15_000 });
}

export function useCameraSession(id: string, enabled = true) {
  return useQuery({
    queryKey: ["cameras", id, "stream-session"],
    queryFn: () => camerasApi.streamSession(id),
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
