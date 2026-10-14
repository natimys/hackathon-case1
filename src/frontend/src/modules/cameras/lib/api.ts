import {apiClient} from "@/lib/api";

export interface Camera {
    id: string;
    name: string;
    building_id: number;
    entrance_id: number | null;
    location_description: string;
    stream_path: string;
    source_type: "rtsp" | "simulator";
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface Building {
    id: number;
    city: string;
    street: string;
    house_number: string;
    building_suffix: string
}

export interface CameraInput {
    name: string;
    building_id: number;
    entrance_id: number | null;
    location_description: string;
    stream_path: string;
    source_type: "rtsp" | "simulator";
    enabled: boolean
}

export type CameraStatus = "online" | "offline" | "unknown";

export async function listCameras() {
    return (await apiClient.get<Camera[]>("/cameras")).data;
}

export async function listBuildings() {
    return (await apiClient.get<Building[]>("/properties/buildings")).data;
}

export async function createCamera(input: CameraInput) {
    return (await apiClient.post<Camera>("/cameras", input)).data;
}

export async function updateCamera(id: string, input: Partial<Pick<Camera, "name" | "entrance_id" | "location_description" | "enabled">>) {
    return (await apiClient.patch<Camera>(`/cameras/${id}`, input)).data;
}

export async function checkCamera(id: string) {
    return (await apiClient.get<{ status: CameraStatus }>(`/cameras/${id}/status`)).data;
}
