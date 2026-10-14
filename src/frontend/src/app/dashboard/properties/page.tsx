"use client";

import {type FormEvent, useState} from "react";
import {useAccessScopes, useBuildings} from "@/modules/tickets/hooks/use-tickets";
import {
    useCreateApartment,
    useCreateBuilding,
    useCreateCompany,
    useCreateEntrance,
    useCreateMembership,
    useCreateResidentBinding
} from "@/modules/properties/hooks/use-admin-properties";

function errorMessage(error: unknown) {
    const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
    if (response?.status === 401) return "Сессия истекла. Войдите снова.";
    if (response?.status === 403) return "У вас нет прав на это действие.";
    if (response?.status === 404) return "Проверьте идентификаторы УК, дома, квартиры и пользователя.";
    if (response?.status === 409) return "Такая сущность уже существует.";
    return "Не удалось сохранить изменения. Проверьте данные и повторите попытку.";
}

export default function PropertiesAdminPage() {
    const scopes = useAccessScopes();
    const buildingsQuery = useBuildings();
    const createCompany = useCreateCompany();
    const createBuilding = useCreateBuilding();
    const createEntrance = useCreateEntrance();
    const createApartment = useCreateApartment();
    const createMembership = useCreateMembership();
    const createBinding = useCreateResidentBinding();
    const [message, setMessage] = useState("");
    const [companyId, setCompanyId] = useState("");
    const [buildingId, setBuildingId] = useState("");

    if (scopes.isLoading) return <p>Проверка доступа…</p>;
    if (scopes.isError || (!scopes.data?.is_platform_admin && !scopes.data?.scoped_roles.includes("company_admin"))) return <div
        role="alert">Раздел доступен администраторам платформы и управляющей компании.</div>;

    const run = async (event: FormEvent<HTMLFormElement>, action: () => Promise<unknown>, success: (result: unknown) => string) => {
        event.preventDefault();
        setMessage("");
        const form = event.currentTarget;
        try {
            const result = await action();
            setMessage(success(result));
            form.reset();
        } catch (error) {
            setMessage(errorMessage(error));
        }
    };
    const submitCompany = (event: FormEvent<HTMLFormElement>) => run(event, async () => {
        const data = new FormData(event.currentTarget);
        return createCompany.mutateAsync(String(data.get("name") ?? "").trim());
    }, (result) => {
        const id = (result as { id: number }).id;
        setCompanyId(String(id));
        return "Управляющая компания создана.";
    });
    const submitBuilding = (event: FormEvent<HTMLFormElement>) => run(event, async () => {
        const data = new FormData(event.currentTarget);
        return createBuilding.mutateAsync({
            management_company_id: Number(data.get("company_id")),
            city: String(data.get("city")),
            street: String(data.get("street")),
            house_number: String(data.get("house_number")),
            building_suffix: String(data.get("building_suffix") ?? "")
        });
    }, (result) => {
        const id = (result as { id: number }).id;
        setBuildingId(String(id));
        return "Дом добавлен.";
    });
    const submitEntrance = (event: FormEvent<HTMLFormElement>) => run(event, async () => {
        const data = new FormData(event.currentTarget);
        return createEntrance.mutateAsync({
            building_id: Number(data.get("building_id")),
            number: String(data.get("number"))
        });
    }, () => "Подъезд добавлен.");
    const submitApartment = (event: FormEvent<HTMLFormElement>) => run(event, async () => {
        const data = new FormData(event.currentTarget);
        const entrance = String(data.get("entrance_id") ?? "");
        return createApartment.mutateAsync({
            building_id: Number(data.get("building_id")),
            entrance_id: entrance ? Number(entrance) : null,
            number: String(data.get("number"))
        });
    }, () => "Квартира добавлена.");
    const submitMembership = (event: FormEvent<HTMLFormElement>) => run(event, async () => {
        const data = new FormData(event.currentTarget);
        return createMembership.mutateAsync({
            company_id: Number(data.get("company_id")),
            user_id: Number(data.get("user_id")),
            scoped_role: String(data.get("scoped_role")) as "company_admin" | "technician"
        });
    }, () => "Роль пользователя в управляющей компании назначена.");
    const submitBinding = (event: FormEvent<HTMLFormElement>) => run(event, async () => {
        const data = new FormData(event.currentTarget);
        return createBinding.mutateAsync({
            apartment_id: Number(data.get("apartment_id")),
            user_id: Number(data.get("user_id")),
            status: "confirmed"
        });
    }, () => "Привязка жителя подтверждена.");
    const buildings = buildingsQuery.data ?? [];
    const ownCompanyIds = Array.from(new Set(buildings.map((building) => building.management_company_id)));
    const formClass = "grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2";
    const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
    const labelClass = "text-sm font-medium text-slate-700";
    const buttonClass = "rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2";
    const available = (mutation: { isPending: boolean }) => !mutation.isPending;

    return <section>
        <header><p>Администрирование</p><h1>Дома и доступ</h1><p>Управление домами, квартирами и ролями пользователей в пределах ваших полномочий.</p></header>
        {message && <div role="status">{message}</div>}
        {scopes.data?.is_platform_admin &&
            <form onSubmit={submitCompany}><h2>Создать управляющую компанию</h2><label>Название<input required
                                                                                                      name="name"
                                                                                                      maxLength={200}/></label>
                <button
                    disabled={!available(createCompany)}>{createCompany.isPending ? "Создание…" : "Создать УК"}</button>
            </form>}
        <form onSubmit={submitBuilding}><h2>Добавить дом</h2><label>Номер управляющей компании<input required
                                                                                                  name="company_id"
                                                                                                  type="number" min="1"
                                                                                                  value={companyId}
                                                                                                  onChange={(e) => setCompanyId(e.target.value)}/>{scopes.data?.is_platform_admin &&
            <span>Создайте управляющую компанию выше или укажите номер существующей.</span>}</label><label>Город<input required name="city"
                                                                                                  maxLength={120}/></label><label>Улица<input
            required name="street" maxLength={200}/></label><label>Номер дома<input required name="house_number"
                                                                                    maxLength={30}/></label><label>Корпус
            / строение<input name="building_suffix" maxLength={30}/></label>
            <button
                disabled={!available(createBuilding)}>{createBuilding.isPending ? "Создание…" : "Добавить дом"}</button>
        </form>
        <div>
            <form onSubmit={submitEntrance}><h2>Добавить подъезд</h2><label>Номер дома в системе<input required name="building_id"
                                                                                          type="number" min="1"
                                                                                          defaultValue={buildingId}/></label><label>Номер
                подъезда<input required name="number" maxLength={30}/></label>
                <button
                    disabled={!available(createEntrance)}>{createEntrance.isPending ? "Создание…" : "Добавить подъезд"}</button>
            </form>
            <form onSubmit={submitApartment}><h2>Добавить квартиру</h2><label>Номер дома в системе<input required name="building_id"
                                                                                            type="number" min="1"
                                                                                            defaultValue={buildingId}/></label><label>Номер подъезда, если есть
                <input name="entrance_id" type="number" min="1"/></label><label>Номер квартиры<input
                required name="number" maxLength={30}/></label>
                <button
                    disabled={!available(createApartment)}>{createApartment.isPending ? "Создание…" : "Добавить квартиру"}</button>
            </form>
        </div>
        <form onSubmit={submitMembership}><h2>Назначить роль пользователя в УК</h2><label>Номер управляющей компании<input required
                                                                                                      name="company_id"
                                                                                                      type="number"
                                                                                                      min="1"
                                                                                                      list="company-ids"/>
            <datalist id="company-ids">{ownCompanyIds.map((id) => <option key={id} value={id}/>)}</datalist>
        </label><label>Номер пользователя в системе<input required name="user_id" type="number" min="1"/></label><label>Роль<select
            name="scoped_role">
            <option value="technician">Техник</option>
            {scopes.data?.is_platform_admin && <option value="company_admin">Администратор УК</option>}</select></label>
            <button
                disabled={!available(createMembership)}>{createMembership.isPending ? "Сохранение…" : "Назначить роль"}</button>
        </form>
        <form onSubmit={submitBinding}><h2>Подтвердить привязку жителя</h2><label>Номер пользователя в системе<input required
                                                                                                               name="user_id"
                                                                                                               type="number"
                                                                                                               min="1"/></label><label>Номер квартиры в системе
            <input required name="apartment_id" type="number" min="1"/></label><p>После подтверждения житель получит доступ к функциям по этому адресу.</p>
            <button
                disabled={!available(createBinding)}>{createBinding.isPending ? "Сохранение…" : "Подтвердить привязку"}</button>
        </form>
        <section><h2>Доступные дома</h2>{buildingsQuery.isError ?
            <p>Не удалось загрузить доступные дома.</p> : buildingsQuery.isLoading ?
                <p>Загрузка…</p> : !buildings.length ? <p>Домов пока нет.</p> :
                    <ul>{buildings.map((building) => <li key={building.id}>
                        <span>{building.city}, {building.street}, {building.house_number}{building.building_suffix}</span>
                    </li>)}</ul>}</section>
    </section>;
}
