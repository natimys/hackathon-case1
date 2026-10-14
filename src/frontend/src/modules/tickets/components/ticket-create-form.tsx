"use client";

import {Link, useNavigate} from "react-router-dom";
import {useEffect, useState} from "react";
import {apiClient} from "@/lib/api";
import {useApartments, useBuildings, useCreateTicket} from "@/modules/tickets/hooks/use-tickets";
import type {Apartment, Building, TicketPriority} from "@/modules/tickets/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"]);
const messageFor = (error: unknown) => {
    if (typeof error === "object" && error && "response" in error) {
        const response = (error as { response?: { status?: number; data?: { detail?: unknown } } }).response;
        if (response?.status === 413) return "Файл превышает допустимый размер 10 МБ.";
        if (response?.status === 415) return "Формат файла не поддерживается или файл повреждён.";
        if (response?.status === 403 || response?.status === 404) return "Нет доступа к выбранной квартире. Обновите список объектов.";
        if (response?.status === 409) return "Состояние заявки изменилось. Обновите страницу и попробуйте снова.";
        if (response?.status === 422 || response?.status === 400) return "Проверьте корректность данных и доступность выбранного объекта.";
        if (response?.status === 401) return "Сессия завершена. Войдите снова.";
    }
    return "Не удалось выполнить запрос. Попробуйте ещё раз.";
};
const buildingTitle = (b: Building) => `${b.city}, ${b.street}, ${b.house_number}${b.building_suffix}`;

export function TicketCreateForm() {
    const navigate = useNavigate();
    const buildingsQuery = useBuildings();
    const [buildingId, setBuildingId] = useState("");
    const apartmentsQuery = useApartments(buildingId ? Number(buildingId) : undefined);
    const createMutation = useCreateTicket();
    const [apartmentId, setApartmentId] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<TicketPriority>("normal");
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        const urls = files.map((file) => file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
        setPreviews(urls);
        return () => urls.forEach((url) => URL.revokeObjectURL(url));
    }, [files]);

    const selectFiles = (selection: FileList | null) => {
        if (!selection) return;
        const incoming = Array.from(selection);
        const invalid = incoming.find((file) => !ACCEPTED.has(file.type) || file.size > MAX_FILE_BYTES || file.size === 0);
        if (invalid) {
            setError(invalid.size > MAX_FILE_BYTES ? `«${invalid.name}» больше 10 МБ.` : `Формат файла «${invalid.name}» не поддерживается.`);
            return;
        }
        if (files.length + incoming.length > 5) {
            setError("Можно прикрепить не более 5 файлов.");
            return;
        }
        setError("");
        setFiles((current) => [...current, ...incoming]);
    };

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        if (!buildingId || !apartmentId) {
            setError("Выберите дом и квартиру.");
            return;
        }
        if (title.trim().length < 3 || description.trim().length < 3) {
            setError("Тема и описание должны содержать не менее 3 символов.");
            return;
        }
        try {
            const ticket = await createMutation.mutateAsync({
                apartment_id: Number(apartmentId),
                title: title.trim(),
                description: description.trim(),
                priority
            });
            for (const file of files) {
                const body = new FormData();
                body.append("file", file);
                await apiClient.post(`/tickets/${ticket.id}/attachments`, body, {headers: {"Content-Type": undefined}});
            }
            navigate(`/dashboard/tickets/${ticket.id}`);
        } catch (cause) {
            setError(messageFor(cause));
            if (createMutation.data) {
                navigate(`/dashboard/tickets/${createMutation.data.id}?attachmentError=1`);
            }
        }
    };

    const pending = createMutation.isPending;
    return <section>
        <Link to="/dashboard/tickets">К списку заявок</Link>
        <header><p>Новое обращение</p><h1>Создать заявку</h1><p>Опишите проблему, чтобы управляющая компания могла
            быстрее помочь.</p></header>
        <form onSubmit={submit}>
            {error && <div role="alert">{error}</div>}
            <div>
                <label>Дом<select required value={buildingId} onChange={(e) => {
                    setBuildingId(e.target.value);
                    setApartmentId("");
                }}>
                    <option value="">Выберите дом</option>
                    {(buildingsQuery.data ?? []).map((building) => <option key={building.id}
                                                                           value={building.id}>{buildingTitle(building)}</option>)}
                </select></label>
                <label>Квартира<select required disabled={!buildingId} value={apartmentId}
                                       onChange={(e) => setApartmentId(e.target.value)}>
                    <option value="">{buildingId ? "Выберите квартиру" : "Сначала выберите дом"}</option>
                    {(apartmentsQuery.data ?? []).map((apartment: Apartment) => <option key={apartment.id}
                                                                                        value={apartment.id}>Квартира {apartment.number}</option>)}
                </select></label>
            </div>
            {buildingsQuery.isError && <p>Не удалось загрузить доступные дома. Обновите страницу.</p>}
            {apartmentsQuery.isError && buildingId &&
                <p>Не удалось загрузить квартиры выбранного дома. Попробуйте выбрать дом ещё раз.</p>}
            {buildingsQuery.data?.length === 0 && <p>К вашему аккаунту пока не привязаны доступные квартиры.</p>}
            <label>Тема обращения<input required minLength={3} maxLength={200} value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Например, протекает кран в ванной"/><span>От 3 до 200 символов</span></label>
            <label>Описание проблемы<textarea required minLength={3} maxLength={10000} rows={5} value={description}
                                              onChange={(e) => setDescription(e.target.value)}
                                              placeholder="Укажите, что произошло и когда вы заметили проблему…"/><span>{description.length}/10000</span></label>
            <label>Приоритет<select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
                <option value="low">Низкий</option>
                <option value="normal">Обычный</option>
                <option value="high">Высокий</option>
                <option value="urgent">Срочный</option>
            </select></label>
            <div>
                <div>Фото и видео <span>до 10 МБ каждое, максимум 5 файлов</span></div>
                <label>Добавить файлы<input type="file" multiple
                                            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                                            onChange={(e) => selectFiles(e.target.files)}/></label>{files.length > 0 &&
                <div>{files.map((file, index) => <div
                    key={`${file.name}-${index}`}>{file.type.startsWith("image/") && previews[index] ?
                    <img src={previews[index]} width={320} height={112} alt={`Предпросмотр ${file.name}`}/> :
                    <div>Видеофайл</div>}
                    <div><span>{file.name}</span>
                        <button type="button" aria-label={`Убрать ${file.name}`}
                                onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}></button>
                    </div>
                </div>)}</div>}</div>
            <div><Link to="/dashboard/tickets">Отмена</Link>
                <button type="submit"
                        disabled={pending || buildingsQuery.isLoading || (buildingsQuery.data?.length ?? 0) === 0}>{pending ? <>Отправляем…</> : <>Отправить
                    заявку</>}</button>
            </div>
        </form>
    </section>;
}
