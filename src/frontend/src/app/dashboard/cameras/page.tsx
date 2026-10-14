"use client";

import {useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import * as api from "@/modules/cameras/lib/api";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";

export default function CamerasPage() {
    const client = useQueryClient();
    const scopes = useAccessScopes();
    const [formError, setFormError] = useState("");
    const [view, setView] = useState<1 | 4>(4);
    const [selectedCamera, setSelectedCamera] = useState("");
    const [checkedStatuses, setCheckedStatuses] = useState<Record<string, api.CameraStatus>>({});
    const isAdmin = Boolean(scopes.data?.is_platform_admin || scopes.data?.scoped_roles.includes("company_admin"));
    const isResident = Boolean(scopes.data?.is_resident);
    const list = useQuery({queryKey: ["cameras"], queryFn: api.listCameras, enabled: isAdmin || isResident});
    const buildings = useQuery({queryKey: ["properties", "buildings"], queryFn: api.listBuildings, enabled: isAdmin});
    const refresh = () => client.invalidateQueries({queryKey: ["cameras"]});
    const create = useMutation({mutationFn: api.createCamera, onSuccess: refresh});
    const update = useMutation({
        mutationFn: ({id, patch}: {
            id: string;
            patch: Parameters<typeof api.updateCamera>[1]
        }) => api.updateCamera(id, patch), onSuccess: refresh
    });
    const status = useMutation({mutationFn: api.checkCamera, onSuccess: (result, id) => setCheckedStatuses((current) => ({...current, [id]: result.status}))});

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormError("");
        const form = event.currentTarget;
        const data = new FormData(event.currentTarget);
        const buildingId = Number(data.get("building_id"));
        try {
            await create.mutateAsync({
                name: String(data.get("name")), building_id: buildingId,
                entrance_id: data.get("entrance_id") ? Number(data.get("entrance_id")) : null,
                location_description: String(data.get("location_description")),
                stream_path: String(data.get("stream_path")),
                source_type: String(data.get("source_type")) as "rtsp" | "simulator", enabled: true,
            });
            form.reset();
        } catch (error) {
            setFormError("Не удалось зарегистрировать камеру. Проверьте данные и повторите попытку.");
        }
    }

    if (scopes.isLoading) return <p>Проверяем доступ…</p>;
    if (!isAdmin && !isResident) return <div role="alert">Раздел недоступен для вашей учётной записи.</div>;

    const cameras = list.data ?? [];
    const displayed = view === 1 ? cameras.filter((camera) => camera.id === selectedCamera || (!selectedCamera && camera === cameras[0])) : cameras.slice(0, 4);
    const buildingLabels = new Map((buildings.data ?? []).map((building) => [building.id, `${building.city}, ${building.street}, ${building.house_number}${building.building_suffix ? ` ${building.building_suffix}` : ""}`]));
    const statusText = (camera: api.Camera) => !camera.enabled ? "Отключена" : checkedStatuses[camera.id] === "online" ? "На связи" : checkedStatuses[camera.id] === "offline" ? "Нет связи" : checkedStatuses[camera.id] === "unknown" ? "Статус не определён" : "Статус не проверен";

    if (isResident && !isAdmin) return <section>
        <header><div><p>Система наблюдения</p><h1>Мои камеры</h1><p>Камеры, доступные по вашему адресу.</p></div></header>
        <section className="overview-section">
            <div className="overview-section-head"><h2>Камеры</h2><div className="filter-pills" aria-label="Режим просмотра">
                {[1, 4].map((count) => <button type="button" key={count} aria-pressed={view === count} onClick={() => setView(count as 1 | 4)}>{count === 1 ? "Одна камера" : "Четыре камеры"}</button>)}
            </div></div>
            {list.isLoading ? <div className="overview-empty">Загружаем камеры…</div> : list.isError ?
                <div role="alert">Не удалось загрузить камеры. <button type="button" onClick={() => void list.refetch()}>Повторить</button></div> : !cameras.length ?
                    <div className="overview-empty">Камеры пока не подключены.</div> : <>
                        {view === 1 && <label style={{maxWidth: 420, marginBottom: 12}}>Выбранная камера<select value={selectedCamera || cameras[0]?.id} onChange={(event) => setSelectedCamera(event.target.value)}>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}</select></label>}
                        <div className="camera-grid">{displayed.map((camera) => <article className="camera-tile" key={camera.id}>
                            <div className="camera-screen"><span>Предпросмотр пока недоступен</span></div>
                            <div className="camera-tile-info"><div><strong>{camera.name}</strong><small>{camera.location_description}</small></div><span className={`status-pill ${checkedStatuses[camera.id] === "online" ? "is-online" : checkedStatuses[camera.id] === "offline" ? "is-offline" : ""}`}>{statusText(camera)}</span></div>
                            <button type="button" disabled={!camera.enabled || (status.isPending && status.variables === camera.id)} onClick={() => status.mutate(camera.id)}>{status.isPending && status.variables === camera.id ? "Проверяем…" : "Проверить связь"}</button>
                        </article>)}</div>
                        <p className="helper-text" style={{margin: "12px 0 0", fontSize: ".82rem"}}>Просмотр видеопотока в веб-версии пока недоступен.</p>
                    </>}
        </section>
    </section>;

    return <section>
        <header><div><p>Система наблюдения</p><h1>Камеры</h1><p>Реестр оборудования и доступность предпросмотра.</p></div></header>
        <section className="overview-section">
            <div className="overview-section-head"><h2>Предпросмотр камер</h2><div className="filter-pills" aria-label="Режим просмотра">
                {[1, 4].map((count) => <button type="button" key={count} aria-pressed={view === count} onClick={() => setView(count as 1 | 4)}>{count === 1 ? "Одна камера" : "Четыре камеры"}</button>)}
            </div></div>
            {list.isLoading ? <div className="overview-empty">Загружаем камеры…</div> : list.isError ? <div role="alert">Не удалось загрузить камеры. <button type="button" onClick={() => void list.refetch()}>Повторить</button></div> : !cameras.length ? <div className="overview-empty">Камер пока нет.</div> : <>
                {view === 1 && <label style={{maxWidth: 420, marginBottom: 12}}>Выбранная камера<select value={selectedCamera || cameras[0]?.id} onChange={(event) => setSelectedCamera(event.target.value)}>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}</select></label>}
                <div className="camera-grid">{displayed.map((camera) => <article className="camera-tile" key={camera.id}>
                    <div className="camera-screen"><span>Предпросмотр пока недоступен</span></div>
                    <div className="camera-tile-info"><div><strong>{camera.name}</strong><small>{buildingLabels.get(camera.building_id) ?? "Объект"} · {camera.location_description}</small></div><span className={`status-pill ${checkedStatuses[camera.id] === "online" ? "is-online" : checkedStatuses[camera.id] === "offline" ? "is-offline" : ""}`}>{statusText(camera)}</span></div>
                    <button type="button" disabled={!camera.enabled || (status.isPending && status.variables === camera.id)} onClick={() => status.mutate(camera.id)}>{status.isPending && status.variables === camera.id ? "Проверяем…" : "Проверить связь"}</button>
                </article>)}</div>
            </>}
        </section>
        <form onSubmit={submit}>
            <h2>Добавить камеру</h2>
            <label>Название<input required name="name" maxLength={160}/></label>
            <label>Дом<select required name="building_id" defaultValue="">
                <option value="" disabled>Выберите дом</option>
                {(buildings.data ?? []).map((item) => <option key={item.id}
                                                              value={item.id}>{item.city}, {item.street}, {item.house_number}{item.building_suffix}</option>)}
            </select></label>
            <label>Номер подъезда, если есть<input name="entrance_id" type="number" min={1}/></label>
            <label>Расположение<input required name="location_description" maxLength={250}/></label>
            <label>Внутренний путь потока<input required name="stream_path" pattern="[a-zA-Z0-9/_-]+" maxLength={200}
                                                placeholder="demo/camera-001"/></label>
            <label>Тип источника<select name="source_type">
                <option value="rtsp">Сетевая камера</option>
                <option value="simulator">Симулятор</option>
            </select></label>
            {formError && <p role="alert">{formError}</p>}
            {buildings.isError && <p>Не удалось загрузить доступные дома.</p>}
            <button disabled={create.isPending || buildings.isLoading || !buildings.data?.length}>Зарегистрировать
            </button>
        </form>
        {list.isLoading ? <p>Загрузка камер…</p> : list.isError ?
            <p role="alert">Не удалось загрузить камеры. Проверьте права доступа и повторите попытку.</p> : <div className="table-scroll">
                <table>
                    <thead>
                    <tr>{["Камера", "Объект", "Расположение", "Статус", "Действия"].map((label) => <th
                        key={label}>{label}</th>)}</tr>
                    </thead>
                    <tbody>{(list.data ?? []).map((camera) => {
                        return <tr key={camera.id}>
                            <td><strong>{camera.name}</strong>
                                <div>{camera.source_type === "rtsp" ? "Сетевая камера" : "Тестовый источник"}</div>
                            </td>
                            <td>{buildingLabels.get(camera.building_id) ?? "Объект"}{camera.entrance_id ? ` · подъезд ${camera.entrance_id}` : ""}</td>
                            <td>{camera.location_description}</td>
                            <td>{statusText(camera)}</td>
                            <td>
                                <button onClick={() => status.mutate(camera.id)}>{status.isPending && status.variables === camera.id ? "Проверяем…" : "Проверить"}</button>
                                <button onClick={() => update.mutate({
                                    id: camera.id,
                                    patch: {enabled: !camera.enabled}
                                })}>{camera.enabled ? "Отключить" : "Включить"}</button>
                                <details>
                                    <summary>Изменить данные</summary>
                                    <form onSubmit={(event) => {
                                        event.preventDefault();
                                        const data = new FormData(event.currentTarget);
                                        update.mutate({
                                            id: camera.id,
                                            patch: {
                                                name: String(data.get("name")),
                                                location_description: String(data.get("location_description")),
                                                entrance_id: data.get("entrance_id") ? Number(data.get("entrance_id")) : null
                                            }
                                        });
                                    }}><input name="name" required maxLength={160} defaultValue={camera.name}/><input
                                        name="location_description" required maxLength={250}
                                        defaultValue={camera.location_description}/><input name="entrance_id"
                                                                                           type="number" min={1}
                                                                                           placeholder="ID подъезда"
                                                                                           defaultValue={camera.entrance_id ?? ""}/>
                                        <button>Сохранить</button>
                                    </form>
                                </details>
                            </td>
                        </tr>;
                    })}</tbody>
                </table>
                {!list.data?.length && <p>Камеры не зарегистрированы.</p>}</div>}
        <p className="helper-text">Безопасный просмотр видеопотока в браузере пока недоступен. Проверка связи и управление камерой работают отдельно от предпросмотра.</p>
    </section>;
}
