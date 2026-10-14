export interface ModuleNav {
    name: string;
    label: string;
    href: string;
    active: boolean;
}

export const moduleNavs: ModuleNav[] = [
    {name: "properties", label: "Дома и доступ", href: "/dashboard/properties", active: true},
    {name: "cameras", label: "Камеры и оборудование", href: "/dashboard/cameras", active: true},
    {name: "tickets", label: "Заявки", href: "/dashboard/tickets", active: true},
    {name: "billing", label: "Счета и начисления", href: "/dashboard/billing", active: true},
    {name: "users", label: "Пользователи", href: "/dashboard/users", active: true},
];
