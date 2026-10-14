import {useMutation, useQueryClient} from "@tanstack/react-query";
import * as api from "@/modules/properties/lib/admin-api";

function useInvalidateProperties() {
    const client = useQueryClient();
    return () => Promise.all([
        client.invalidateQueries({queryKey: ["properties"]}),
        client.invalidateQueries({queryKey: ["access"]}),
    ]);
}

export function useCreateCompany() {
    const invalidate = useInvalidateProperties();
    return useMutation({mutationFn: api.createCompany, onSuccess: invalidate});
}

export function useCreateBuilding() {
    const invalidate = useInvalidateProperties();
    return useMutation({mutationFn: api.createBuilding, onSuccess: invalidate});
}

export function useCreateEntrance() {
    const invalidate = useInvalidateProperties();
    return useMutation({mutationFn: api.createEntrance, onSuccess: invalidate});
}

export function useCreateApartment() {
    const invalidate = useInvalidateProperties();
    return useMutation({mutationFn: api.createApartment, onSuccess: invalidate});
}

export function useCreateMembership() {
    const invalidate = useInvalidateProperties();
    return useMutation({mutationFn: api.createMembership, onSuccess: invalidate});
}

export function useCreateResidentBinding() {
    const invalidate = useInvalidateProperties();
    return useMutation({mutationFn: api.createResidentBinding, onSuccess: invalidate});
}
