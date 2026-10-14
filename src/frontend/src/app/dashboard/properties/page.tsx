import {type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState} from "react";
import {useAccessScopes, useApartments, useBuildings} from "@/modules/tickets/hooks/use-tickets";
import {useUsers} from "@/modules/users/hooks/use-users";
import {
    useCreateApartment,
    useCreateBuilding,
    useCreateCompany,
    useCreateEntrance,
    useCreateMembership,
    useCreateResidentBinding
} from "@/modules/properties/hooks/use-admin-properties";
import type {Building} from "@/modules/tickets/types";

type Section = "buildings" | "companies" | "access";
type Dialog = "building" | "company" | "entrance" | "apartment" | "membership" | "resident" | null;

function errorMessage(error: unknown) {
    const status = (error as {response?: {status?: number}})?.response?.status;
    if (status === 401) return "Сессия истекла. Войдите снова.";
    if (status === 403) return "У вас нет прав на это действие.";
    if (status === 404) return "Не удалось найти выбранный объект. Обновите страницу и попробуйте снова.";
    if (status === 409) return "Такая запись уже существует.";
    if (status === 422) return "Проверьте заполненные данные.";
    return "Не удалось сохранить изменения. Проверьте данные и повторите попытку.";
}

function address(building: Building) {
    return `${building.city}, ${building.street}, ${building.house_number}${building.building_suffix ? `, ${building.building_suffix}` : ""}`;
}

function DialogFrame({title, onClose, children}: {title: string; onClose: () => void; children: ReactNode}) {
    const panel = useRef<HTMLDivElement>(null);
    const returnFocus = useRef<HTMLElement | null>(document.activeElement as HTMLElement);
    useEffect(() => {
        const firstInput = Array.from(panel.current?.querySelectorAll<HTMLElement>("form input:not([type='hidden']), form select, form button[type='submit']") ?? []).find((element) => element.getClientRects().length > 0);
        (firstInput ?? panel.current?.querySelector<HTMLElement>(".icon-button"))?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
            if (event.key === "Tab") {
                const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex='-1'])") ?? []).filter((element) => element.getClientRects().length > 0);
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (!panel.current?.contains(document.activeElement)) {
                    event.preventDefault();
                    first.focus();
                } else if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            returnFocus.current?.focus();
        };
    }, [onClose]);
    return <div className="entity-dialog-backdrop">
        <div className="entity-dialog" role="dialog" aria-modal="true" aria-labelledby="entity-dialog-title" ref={panel}>
            <header className="entity-dialog-header"><h2 id="entity-dialog-title">{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">×</button></header>
            {children}
        </div>
    </div>;
}

export default function PropertiesAdminPage() {
    const scopes = useAccessScopes();
    const buildingsQuery = useBuildings();
    const [section, setSection] = useState<Section>("buildings");
    const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [search, setSearch] = useState("");
    const [companyId, setCompanyId] = useState("");
    const [accessError, setAccessError] = useState("");
    const [notice, setNotice] = useState("");
    const usersQuery = useUsers(1, 100, section === "access");
    const apartmentsQuery = useApartments(undefined, section === "access");
    const detailApartments = useApartments(selectedBuilding?.id, Boolean(selectedBuilding));
    const closeDialog = useCallback(() => {setDialog(null); setAccessError("");}, []);
    const createCompany = useCreateCompany();
    const createBuilding = useCreateBuilding();
    const createEntrance = useCreateEntrance();
    const createApartment = useCreateApartment();
    const createMembership = useCreateMembership();
    const createBinding = useCreateResidentBinding();
    const isPlatformAdmin = Boolean(scopes.data?.is_platform_admin);
    const buildings = buildingsQuery.data ?? [];
    const activeCompanies = Array.from(new Map(buildings.map((building) => [building.management_company_id, building])).values());

    if (scopes.isLoading) return <p>Проверка доступа…</p>;
    if (scopes.isError || (!isPlatformAdmin && !scopes.data?.scoped_roles.includes("company_admin"))) {
        return <div role="alert">Раздел доступен администраторам платформы и управляющей компании.</div>;
    }

    const submit = async (event: FormEvent<HTMLFormElement>, action: (form: FormData) => Promise<unknown>, success: string) => {
        event.preventDefault();
        setAccessError("");
        try {
            await action(new FormData(event.currentTarget));
            setNotice(success);
            closeDialog();
        } catch (error) {
            setAccessError(errorMessage(error));
        }
    };
    const submitCompany = (event: FormEvent<HTMLFormElement>) => submit(event, async (form) => {
        const result = await createCompany.mutateAsync(String(form.get("name") ?? "").trim());
        setCompanyId(String(result.id));
    }, "Управляющая компания добавлена. Её можно выбрать при добавлении дома.");
    const submitBuilding = (event: FormEvent<HTMLFormElement>) => submit(event, async (form) => {
        await createBuilding.mutateAsync({
            management_company_id: Number(form.get("company_id")), city: String(form.get("city")).trim(),
            street: String(form.get("street")).trim(), house_number: String(form.get("house_number")).trim(),
            building_suffix: String(form.get("building_suffix") ?? "").trim()
        });
    }, "Дом добавлен.");
    const submitEntrance = (event: FormEvent<HTMLFormElement>) => submit(event, async (form) => {
        if (!selectedBuilding) return;
        await createEntrance.mutateAsync({building_id: selectedBuilding.id, number: String(form.get("number")).trim()});
    }, "Подъезд добавлен.");
    const submitApartment = (event: FormEvent<HTMLFormElement>) => submit(event, async (form) => {
        if (!selectedBuilding) return;
        await createApartment.mutateAsync({building_id: selectedBuilding.id, entrance_id: null, number: String(form.get("number")).trim()});
    }, "Квартира добавлена.");
    const submitMembership = (event: FormEvent<HTMLFormElement>) => submit(event, async (form) => {
        await createMembership.mutateAsync({company_id: Number(form.get("company_id")), user_id: Number(form.get("user_id")), scoped_role: String(form.get("scoped_role")) as "company_admin" | "technician"});
    }, "Роль сотрудника назначена.");
    const submitResident = (event: FormEvent<HTMLFormElement>) => submit(event, async (form) => {
        await createBinding.mutateAsync({apartment_id: Number(form.get("apartment_id")), user_id: Number(form.get("user_id")), status: "confirmed"});
    }, "Житель привязан к квартире.");

    const filteredBuildings = buildings.filter((building) => address(building).toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")));
    const people = (usersQuery.data?.data ?? []).filter((user) => user.is_active);
    const requestDialog = (value: Dialog) => {setAccessError(""); setDialog(value);};
    const idField = (label: string, name: string, defaultValue = "") => <details className="technical-fallback"><summary>{label}</summary><label>{label}<input type="number" min="1" name={name} required defaultValue={defaultValue}/></label><small>Список для выбора недоступен в текущем интерфейсе.</small></details>;

    return <section className="properties-page">
        <header className="page-heading"><div><p>Администрирование</p><h1>Дома и доступ</h1><p>Адреса, управляющие компании и доступ пользователей.</p></div></header>
        {notice && <div role="status" className="properties-notice">{notice}<button type="button" className="notice-dismiss" onClick={() => setNotice("")} aria-label="Скрыть сообщение">×</button></div>}
        <nav className="section-tabs" aria-label="Подразделы домов и доступа">
            {([["buildings", "Дома"], ["companies", "Управляющие компании"], ["access", "Доступ"]] as const).map(([key, label]) =>
                <button key={key} type="button" aria-current={section === key ? "page" : undefined} onClick={() => {setSection(key); setSelectedBuilding(null); setNotice("");}}>{label}</button>)}
        </nav>

        {section === "buildings" && (selectedBuilding ? <section className="building-detail">
            <button type="button" className="back-link" onClick={() => setSelectedBuilding(null)}>← К списку домов</button>
            <header className="section-heading"><div><h2>{address(selectedBuilding)}</h2><p>Управляйте подъездами и квартирами этого дома.</p></div></header>
            <section className="detail-section"><header className="section-heading"><div><h3>Подъезды</h3><p>Добавляйте подъезды в карточке дома.</p></div><button type="button" className="button-primary" onClick={() => requestDialog("entrance")}>Добавить подъезд</button></header>
                <p className="muted">Список подъездов пока недоступен. Для нового подъезда укажите его номер.</p>
            </section>
            <section className="detail-section"><header className="section-heading"><div><h3>Квартиры</h3><p>Квартиры, добавленные в этот дом.</p></div><button type="button" className="button-primary" onClick={() => requestDialog("apartment")}>Добавить квартиру</button></header>
                {detailApartments.isLoading ? <p>Загрузка квартир…</p> : detailApartments.isError ? <p role="alert">Не удалось загрузить квартиры.</p> : !(detailApartments.data ?? []).length ? <p className="empty-inline">В этом доме пока нет квартир.</p> : <ul className="entity-list">{detailApartments.data!.map((apartment) => <li key={apartment.id}><span>Квартира {apartment.number}</span></li>)}</ul>}
            </section>
        </section> : <>
            <header className="section-heading"><div><h2>Дома</h2><p>Выберите адрес, чтобы управлять его подъездами и квартирами.</p></div><button type="button" className="button-primary" onClick={() => requestDialog("building")}>Добавить дом</button></header>
            <label className="building-search">Поиск по адресу<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Город, улица или номер дома"/></label>
            {buildingsQuery.isLoading ? <p>Загрузка домов…</p> : buildingsQuery.isError ? <p role="alert">Не удалось загрузить дома. Попробуйте обновить страницу.</p> : !filteredBuildings.length ? <div className="properties-empty"><h3>{buildings.length ? "Дома не найдены" : "Пока нет домов"}</h3><p>{buildings.length ? "Измените запрос и попробуйте ещё раз." : "Добавьте первый дом, чтобы настроить его подъезды и квартиры."}</p>{!buildings.length && <button type="button" className="button-primary" onClick={() => requestDialog("building")}>Добавить дом</button>}</div> : <ul className="building-list">{filteredBuildings.map((building) => <li key={building.id}><div><h3>{address(building)}</h3><p>{building.city} · Управляющая компания</p></div><button type="button" onClick={() => {setSelectedBuilding(building); setNotice("");}}>Открыть</button></li>)}</ul>}
        </>)}

        {section === "companies" && <>
            <header className="section-heading"><div><h2>Управляющие компании</h2><p>Создание компании и переход к адресам, которые она обслуживает.</p></div>{isPlatformAdmin && <button type="button" className="button-primary" onClick={() => requestDialog("company")}>Добавить управляющую компанию</button>}</header>
            {isPlatformAdmin && <p className="muted">Список компаний пока не поддерживается. После добавления компании выберите её при создании дома.</p>}
            {!isPlatformAdmin && (activeCompanies.length ? <ul className="building-list">{activeCompanies.map((building) => <li key={building.management_company_id}><div><h3>Компания по адресу {address(building)}</h3><p>Управляет этим домом</p></div><button type="button" onClick={() => {setSection("buildings"); setSelectedBuilding(building);}}>Открыть дом</button></li>)}</ul> : <div className="properties-empty"><h3>Нет доступных адресов</h3><p>Список управляющих компаний появится вместе с адресами, доступными вашей роли.</p></div>)}
        </>}

        {section === "access" && <>
            <header className="section-heading"><div><h2>Управление доступом</h2><p>Назначайте роли сотрудникам и связывайте жителей с квартирами.</p></div></header>
            <div className="access-groups">
                <section className="access-group"><div><h3>Сотрудники управляющей компании</h3><p>Назначьте сотруднику роль техника или администратора компании.</p></div><button type="button" className="button-primary" onClick={() => requestDialog("membership")}>Назначить роль</button></section>
                <section className="access-group"><div><h3>Жители</h3><p>Подтвердите связь пользователя с квартирой, чтобы открыть доступ по адресу.</p></div><button type="button" className="button-primary" onClick={() => requestDialog("resident")}>Привязать жителя</button></section>
            </div>
        </>}

        {dialog && <DialogFrame title={({building:"Добавить дом", company:"Добавить управляющую компанию", entrance:"Добавить подъезд", apartment:"Добавить квартиру", membership:"Назначить роль сотруднику", resident:"Привязать жителя"})[dialog]} onClose={closeDialog}>
            <form className="entity-form" onSubmit={dialog === "company" ? submitCompany : dialog === "building" ? submitBuilding : dialog === "entrance" ? submitEntrance : dialog === "apartment" ? submitApartment : dialog === "membership" ? submitMembership : submitResident}>
                {dialog === "company" && <label>Название управляющей компании<input autoComplete="organization" required name="name" maxLength={200}/></label>}
                {dialog === "building" && <>
                    {activeCompanies.length > 0 ? <>
                        <label>Управляющая компания<select name="company_id" required value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">Выберите компанию</option>{activeCompanies.map((building) => <option key={building.management_company_id} value={building.management_company_id}>Компания по адресу {address(building)}</option>)}{companyId && !activeCompanies.some((company) => String(company.management_company_id) === companyId) && <option value={companyId}>Выбранная управляющая компания</option>}</select></label>
                        {isPlatformAdmin && <details className="technical-fallback"><summary>Нет компании в списке?</summary><label>Номер существующей компании<input type="number" min="1" name="company_id_manual" onChange={(event) => setCompanyId(event.target.value)}/></label><small>Общий список компаний пока недоступен.</small></details>}
                    </> : <>{idField("Номер существующей управляющей компании", "company_id")}<p className="muted">Общий список компаний пока недоступен; введите номер компании, к которой у вас есть доступ.</p></>}
                    <label>Город<input required name="city" maxLength={120} autoComplete="address-level2"/></label><label>Улица<input required name="street" maxLength={200} autoComplete="address-line1"/></label><label>Номер дома<input required name="house_number" maxLength={30}/></label><label>Корпус или строение<input name="building_suffix" maxLength={30}/></label>
                </>}
                {dialog === "entrance" && <><p className="dialog-context">{selectedBuilding && address(selectedBuilding)}</p><label>Номер подъезда<input required name="number" maxLength={30}/></label></>}
                {dialog === "apartment" && <><p className="dialog-context">{selectedBuilding && address(selectedBuilding)}</p><label>Номер квартиры<input required name="number" maxLength={30}/></label><p className="muted">Список подъездов пока недоступен, поэтому квартира будет добавлена без привязки к подъезду.</p></>}
                {(dialog === "membership" || dialog === "resident") && <>
                    {usersQuery.isLoading && <p>Загрузка пользователей…</p>}
                    {!usersQuery.isError && people.length > 0 ? <label>Пользователь<select name="user_id" required defaultValue=""><option value="">Выберите пользователя</option>{people.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></label> : <>{usersQuery.isError && <p className="muted">Список пользователей недоступен для вашей роли.</p>}{idField("Номер пользователя", "user_id")}</>}
                    {dialog === "membership" && <>
                        {activeCompanies.length > 0 ? <label>Управляющая компания<select name="company_id" required defaultValue=""><option value="">Выберите по адресу дома</option>{activeCompanies.map((building) => <option key={building.management_company_id} value={building.management_company_id}>Компания по адресу {address(building)}</option>)}</select></label> : idField("Номер существующей компании", "company_id")}
                        <label>Роль<select name="scoped_role"><option value="technician">Техник</option>{isPlatformAdmin && <option value="company_admin">Администратор управляющей компании</option>}</select></label>
                    </>}
                    {dialog === "resident" && <>
                        {apartmentsQuery.isLoading && <p>Загрузка квартир…</p>}
                        {!apartmentsQuery.isError && (apartmentsQuery.data ?? []).length > 0 ? <label>Квартира<select name="apartment_id" required defaultValue=""><option value="">Выберите квартиру</option>{(apartmentsQuery.data ?? []).map((apartment) => {const building = buildings.find((item) => item.id === apartment.building_id); return <option key={apartment.id} value={apartment.id}>{building ? address(building) : "Адрес недоступен"} · кв. {apartment.number}</option>;})}</select></label> : <>{apartmentsQuery.isError && <p className="muted">Список квартир недоступен для выбора.</p>}{idField("Номер квартиры", "apartment_id")}</>}
                    </>}
                </>}
                {accessError && <div role="alert">{accessError}</div>}
                <footer className="dialog-actions"><button type="button" onClick={closeDialog}>Отмена</button><button type="submit" className="button-primary" disabled={(dialog === "company" ? createCompany.isPending : dialog === "building" ? createBuilding.isPending : dialog === "entrance" ? createEntrance.isPending : dialog === "apartment" ? createApartment.isPending : dialog === "membership" ? createMembership.isPending : createBinding.isPending) || ((dialog === "membership" || dialog === "resident") && usersQuery.isLoading) || (dialog === "resident" && apartmentsQuery.isLoading)}>{dialog === "company" ? "Добавить компанию" : dialog === "building" ? "Добавить дом" : dialog === "entrance" ? "Добавить подъезд" : dialog === "apartment" ? "Добавить квартиру" : dialog === "membership" ? "Назначить роль" : "Привязать жителя"}</button></footer>
            </form>
        </DialogFrame>}
    </section>;
}
