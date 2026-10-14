import { useQuery } from "@tanstack/react-query";
import { profileApi } from "@/shared/api/services";

export function useAccessScopes() {
  return useQuery({ queryKey: ["access", "scopes"], queryFn: profileApi.scopes });
}

export function useBuildings() {
  return useQuery({ queryKey: ["properties", "buildings"], queryFn: profileApi.buildings });
}

export function useApartments(buildingId?: number) {
  return useQuery({
    queryKey: ["properties", "apartments", buildingId],
    queryFn: () => profileApi.apartments(buildingId),
    enabled: buildingId === undefined || Number.isInteger(buildingId),
  });
}
