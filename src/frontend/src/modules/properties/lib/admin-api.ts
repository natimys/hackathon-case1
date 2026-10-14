import {apiClient} from "@/lib/api";

export interface Company {
    id: number;
    name: string
}

export interface Building {
    id: number;
    management_company_id: number;
    city: string;
    street: string;
    house_number: string;
    building_suffix: string
}

export interface Apartment {
    id: number;
    building_id: number;
    entrance_id: number | null;
    number: string
}

export interface Entrance {
    id: number;
    building_id: number;
    number: string
}

export interface Membership {
    id: number;
    user_id: number;
    company_id: number;
    scoped_role: "company_admin" | "technician";
    is_active: boolean
}

export interface ResidentBinding {
    id: number;
    user_id: number;
    apartment_id: number;
    status: "pending" | "confirmed" | "rejected"
}

export async function createCompany(name: string) {
    return (await apiClient.post<Company>("/properties/companies", {name})).data;
}

export async function createBuilding(input: Omit<Building, "id" | "building_suffix"> & { building_suffix?: string }) {
    return (await apiClient.post<Building>("/properties/buildings", {
        ...input,
        building_suffix: input.building_suffix || null
    })).data;
}

export async function createApartment(input: { building_id: number; entrance_id?: number | null; number: string }) {
    return (await apiClient.post<Apartment>("/properties/apartments", input)).data;
}

export async function createEntrance(input: { building_id: number; number: string }) {
    return (await apiClient.post<Entrance>("/properties/entrances", input)).data;
}

export async function createMembership(input: {
    user_id: number;
    company_id: number;
    scoped_role: "company_admin" | "technician"
}) {
    return (await apiClient.post<Membership>("/access/memberships", input)).data;
}

export async function createResidentBinding(input: { user_id: number; apartment_id: number; status: "confirmed" }) {
    return (await apiClient.post<ResidentBinding>("/access/resident-bindings", input)).data;
}
