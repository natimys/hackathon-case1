"use client";

import {useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import * as api from "@/modules/cameras/lib/api";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const buttonClass = "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

export default function CamerasPage() {
    const client = useQueryClient();
    const [formError, setFormError] = useState("");
    const list = useQuery({queryKey: ["cameras"], queryFn: api.listCameras});
    const buildings = useQuery({queryKey: ["properties", "buildings"], queryFn: api.listBuildings});
    const refresh = () => client.invalidateQueries({queryKey: ["cameras"]});
    const create = useMutation({mutationFn: api.createCamera, onSuccess: refresh});
    const update = useMutation({
        mutationFn: ({id, patch}: {
            id: string;
            patch: Parameters<typeof api.updateCamera>[1]
        }) => api.updateCamera(id, patch), onSuccess: refresh
    });
    const status = useMutation({mutationFn: api.checkCamera});

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
            setFormError(error instanceof Error ? error.message : "Не удалось зарегистрировать камеру.");
        }
    }

    return <section>
        <header><h1>Камеры</h1><p>пока что не рабоатет</p></header>
        <form onSubmit={submit}>
            <h2>Добавить камеру</h2>
            <label>Название<input required name="name" maxLength={160}/></label>
            <label>Дом<select required name="building_id" defaultValue="">
                <option value="" disabled>Выберите дом</option>
                {(buildings.data ?? []).map((item) => <option key={item.id}
                                                              value={item.id}>ID {item.id} · {item.street}, {item.house_number}{item.building_suffix}</option>)}
            </select></label>
            <label>Подъезд ID, необязательно<input name="entrance_id" type="number" min={1}/></label>
            <label>Расположение<input required name="location_description" maxLength={250}/></label>
            <label>Внутренний stream path<input required name="stream_path" pattern="[a-zA-Z0-9/_-]+" maxLength={200}
                                                placeholder="demo/camera-001"/></label>
            <label>Тип источника<select name="source_type">
                <option value="rtsp">RTSP камера</option>
                <option value="simulator">Симулятор</option>
            </select></label>
            {formError && <p role="alert">{formError}</p>}
            {buildings.isError && <p>Не удалось загрузить доступные дома.</p>}
            <button disabled={create.isPending || buildings.isLoading || !buildings.data?.length}>Зарегистрировать
            </button>
        </form>
        {list.isLoading ? <p>Загрузка камер…</p> : list.isError ?
            <p role="alert">Не удалось загрузить камеры. Проверьте доступ.</p> : <div>
                <table>
                    <thead>
                    <tr>{["Камера", "Объект", "Расположение", "Статус", "Действия"].map((label) => <th
                        key={label}>{label}</th>)}</tr>
                    </thead>
                    <tbody>{(list.data ?? []).map((camera) => {
                        const current = status.variables === camera.id ? status.data?.status ?? "Проверяем…" : "Не проверен";
                        return <tr key={camera.id}>
                            <td><strong>{camera.name}</strong>
                                <div>{camera.stream_path}</div>
                            </td>
                            <td>Дом {camera.building_id}{camera.entrance_id ? ` · подъезд ${camera.entrance_id}` : ""}</td>
                            <td>{camera.location_description}</td>
                            <td>{camera.enabled ? current : "Отключена"}</td>
                            <td>
                                <button onClick={() => status.mutate(camera.id)}>Проверить</button>
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
        <p>Просмотр в браузере недоступен: для безопасной передачи краткоживущего media-токена браузерный HLS-плеер пока
            не подключён. RTSP credentials интерфейс не получает.</p>
    </section>;
}
