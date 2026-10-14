import {useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {DataTable, PageHeader, SectionCard, StatusBadge} from "@/components/ui";
import * as api from "@/modules/cameras/lib/api";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";

export default function CamerasPage() {
    const client = useQueryClient();
    const scopes = useAccessScopes();
    const [formError, setFormError] = useState("");
    const [checkedStatuses, setCheckedStatuses] = useState<Record<string, api.CameraStatus>>({});
    const isAdmin = Boolean(scopes.data?.is_platform_admin || scopes.data?.scoped_roles.includes("company_admin"));
    const list = useQuery({queryKey: ["cameras"], queryFn: api.listCameras, enabled: isAdmin});
    const buildings = useQuery({queryKey: ["properties", "buildings"], queryFn: api.listBuildings, enabled: isAdmin});
    const refresh = () => client.invalidateQueries({queryKey: ["cameras"]});
    const create = useMutation({mutationFn: api.createCamera, onSuccess: refresh});
    const update = useMutation({mutationFn: ({id, patch}: {id: string; patch: Parameters<typeof api.updateCamera>[1]}) => api.updateCamera(id, patch), onSuccess: refresh});
    const status = useMutation({mutationFn: api.checkCamera, onSuccess: (result, id) => setCheckedStatuses((current) => ({...current, [id]: result.status}))});
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault(); setFormError("");
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            await create.mutateAsync({name: String(data.get("name")), building_id: Number(data.get("building_id")), entrance_id: data.get("entrance_id") ? Number(data.get("entrance_id")) : null, location_description: String(data.get("location_description")), stream_path: String(data.get("stream_path")), source_type: String(data.get("source_type")) as "rtsp" | "simulator", enabled: true});
            form.reset();
        } catch { setFormError("Не удалось зарегистрировать камеру. Проверьте данные и повторите попытку."); }
    }
    if (scopes.isLoading) return <p>Проверяем доступ…</p>;
    if (scopes.isError || !isAdmin) return <div role="alert">Раздел доступен только администраторам.</div>;
    const buildingLabels = new Map((buildings.data ?? []).map((building) => [building.id, `${building.city}, ${building.street}, ${building.house_number}${building.building_suffix ? ` ${building.building_suffix}` : ""}`]));
    const statusText = (camera: api.Camera) => !camera.enabled ? "Отключена" : checkedStatuses[camera.id] === "online" ? "На связи" : checkedStatuses[camera.id] === "offline" ? "Нет связи" : checkedStatuses[camera.id] === "unknown" ? "Статус не определён" : "Не проверена";
    return <div className="camera-admin-page">
        <PageHeader eyebrow="Система наблюдения" title="Камеры и оборудование" description="Реестр, состояние и диагностика камер."/>
        <SectionCard title="Реестр камер">
            {list.isLoading ? <p>Загружаем камеры…</p> : list.isError ? <p role="alert">Не удалось загрузить камеры. Проверьте права и повторите попытку.</p> : <DataTable label="Реестр камер"><thead><tr><th>Камера</th><th>Дом</th><th>Расположение</th><th>Состояние</th><th>Действия</th></tr></thead><tbody>{(list.data ?? []).map((camera) => <tr key={camera.id}>
                <td><strong>{camera.name}</strong><small className="table-secondary">{camera.source_type === "rtsp" ? "Сетевая камера" : "Тестовый источник"}</small></td><td>{buildingLabels.get(camera.building_id) ?? `Дом №${camera.building_id}`}{camera.entrance_id ? ` · подъезд ${camera.entrance_id}` : ""}</td><td>{camera.location_description}</td>
                <td><StatusBadge tone={!camera.enabled ? "neutral" : checkedStatuses[camera.id] === "online" ? "success" : checkedStatuses[camera.id] === "offline" ? "danger" : "warning"}>{statusText(camera)}</StatusBadge></td>
                <td className="camera-actions"><button type="button" disabled={status.isPending && status.variables === camera.id} onClick={() => status.mutate(camera.id)}>{status.isPending && status.variables === camera.id ? "Проверяем…" : "Проверить связь"}</button><button type="button" onClick={() => update.mutate({id: camera.id, patch: {enabled: !camera.enabled}})}>{camera.enabled ? "Отключить" : "Включить"}</button><details><summary>Изменить данные</summary><form className="camera-edit-form" onSubmit={(event) => {event.preventDefault(); const data = new FormData(event.currentTarget); update.mutate({id: camera.id, patch: {name: String(data.get("name")), location_description: String(data.get("location_description")), entrance_id: data.get("entrance_id") ? Number(data.get("entrance_id")) : null}});}}><label>Название<input name="name" required maxLength={160} defaultValue={camera.name}/></label><label>Расположение<input name="location_description" required maxLength={250} defaultValue={camera.location_description}/></label><label>ID подъезда<input name="entrance_id" type="number" min={1} defaultValue={camera.entrance_id ?? ""}/></label><button className="button-primary">Сохранить</button></form></details></td>
            </tr>)}</tbody></DataTable>}
            {!list.isLoading && !list.isError && !list.data?.length && <p className="helper-text">Камеры не зарегистрированы.</p>}
        </SectionCard>
        <SectionCard title="Зарегистрировать камеру" description="Добавьте камеру к дому и укажите её расположение и источник.">
            <form className="camera-register-form" onSubmit={submit}><label>Название<input required name="name" maxLength={160}/></label><label>Дом<select required name="building_id" defaultValue=""><option value="" disabled>Выберите дом</option>{(buildings.data ?? []).map((building) => <option key={building.id} value={building.id}>{buildingLabels.get(building.id)}</option>)}</select></label><label>Номер подъезда, если есть<input name="entrance_id" type="number" min={1}/></label><label>Расположение<input required name="location_description" maxLength={250}/></label><label>Внутренний путь потока<input required name="stream_path" pattern="[a-zA-Z0-9/_-]+" maxLength={200} placeholder="demo/camera-001"/></label><label>Тип источника<select name="source_type"><option value="rtsp">Сетевая камера</option><option value="simulator">Симулятор</option></select></label>{formError && <p role="alert">{formError}</p>}{buildings.isError && <p role="alert">Не удалось загрузить доступные дома.</p>}<button className="button-primary" disabled={create.isPending || buildings.isLoading || !buildings.data?.length}>{create.isPending ? "Регистрируем…" : "Зарегистрировать камеру"}</button></form>
        </SectionCard>
    </div>;
}
