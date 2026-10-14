export interface ModuleNav {
    name: string;
    label: string;
    href: string;
    active: boolean;
}

export const moduleNavs: ModuleNav[] = [
    {name: "users", label: "Пользователи", href: "/dashboard/users", active: true},
    {name: "tickets", label: "Заявки", href: "/dashboard/tickets", active: true},
    {name: "billing", label: "Биллинг", href: "/dashboard/billing", active: true},
    {name: "properties", label: "Объекты и доступ", href: "/dashboard/properties", active: true},
    {name: "cameras", label: "Камеры", href: "/dashboard/cameras", active: true},
];
