import {useEffect, useState} from "react";
import {Link, useLocation} from "react-router-dom";
import {moduleNavs} from "@/config/modules";
import {useAuth} from "@/providers/auth-provider";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";

const iconPaths: Record<string, string> = {
    overview: "M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6",
    tickets: "M7 3h8l4 4v14H7zM15 3v5h5M10 12h6M10 16h6",
    cameras: "M3 8h3l2-3h8l2 3h3v11H3zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
    billing: "M3 5h18v14H3zM3 9h18M7 14h4",
    properties: "M3 21V6l9-3 9 3v15M3 11h18M8 11v10m8-10v10",
    users: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m6-7a4 4 0 0 1 0 7m2 3a4 4 0 0 1 3 4v2",
    subscriptions: "M12 3 20 7.5v9L12 21l-8-4.5v-9zM8.5 12h7",
    profile: "M20 21a8 8 0 0 0-16 0m8-11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    logout: "M10 17l5-5-5-5m5 5H3m9-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6",
};

function NavIcon({name}: {name: string}) {
    return <svg className="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name] ?? "M12 5v14m-7-7h14"}/></svg>;
}

export function AppNavigation() {
    const {pathname} = useLocation();
    const {user, logout} = useAuth();
    const {data: scopes} = useAccessScopes();
    const [menuOpen, setMenuOpen] = useState(false);
    const isAdmin = Boolean(scopes?.is_platform_admin || scopes?.scoped_roles.includes("company_admin"));
    const visibleModules = moduleNavs.filter((module) =>
        module.active &&
        (module.name !== "billing" || isAdmin) &&
        (module.name !== "properties" || isAdmin) &&
        (module.name !== "cameras" || isAdmin) &&
        (module.name !== "users" || scopes?.is_platform_admin),
    );
    const closeMenu = () => setMenuOpen(false);
    useEffect(() => {
        if (!menuOpen) return;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeMenu();
        };
        document.addEventListener("keydown", closeOnEscape);
        return () => document.removeEventListener("keydown", closeOnEscape);
    }, [menuOpen]);

    return (
        <>
            <aside id="main-navigation" className={`app-header${menuOpen ? " is-open" : ""}`} aria-label="Основная навигация">
                <Link to="/dashboard" className="app-brand" aria-label="ДозорДом — обзор" onClick={closeMenu}>
                    <span className="brand-mark" aria-hidden="true">⌂</span>
                    <span className="brand-label">ДозорДом</span>
                </Link>
                <nav className="page-nav" aria-label="Разделы приложения">
                    <Link to="/dashboard" className="nav-button" title="Обзор" aria-label="Обзор" onClick={closeMenu}
                          aria-current={pathname === "/dashboard" ? "page" : undefined}>
                        <NavIcon name="overview"/><span className="nav-label">Обзор</span>
                    </Link>
                    {visibleModules.map((module) => (
                        <Link key={module.name} to={module.href} className="nav-button" title={module.label} aria-label={module.label} onClick={closeMenu}
                              aria-current={pathname.startsWith(module.href) ? "page" : undefined}>
                            <NavIcon name={module.name}/><span className="nav-label">{module.label}</span>
                        </Link>
                    ))}
                    <Link to="/dashboard/subscriptions" className="nav-button" title="Подписки" aria-label="Подписки" onClick={closeMenu}
                          aria-current={pathname.startsWith("/dashboard/subscriptions") ? "page" : undefined}>
                        <NavIcon name="subscriptions"/><span className="nav-label">Подписки</span>
                    </Link>
                    <Link to="/dashboard/profile" className="nav-button" title="Профиль" aria-label="Профиль" onClick={closeMenu}
                          aria-current={pathname.startsWith("/dashboard/profile") ? "page" : undefined}>
                        <NavIcon name="profile"/><span className="nav-label">Профиль</span>
                    </Link>
                </nav>
                <div className="account-actions">
                    {user && <span className="account-name" title={user.name}>{user.name}</span>}
                    <button type="button" className="nav-button" title="Выйти" aria-label="Выйти" onClick={logout}><NavIcon name="logout"/><span className="nav-label">Выйти</span></button>
                </div>
            </aside>
            <div className="topbar">
                <button type="button" className="menu-toggle" aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
                        aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((open) => !open)}>
                    {menuOpen ? "×" : "☰"}
                </button>
                <div className="topbar-context"><strong>ДозорДом</strong><span> · </span>Панель управления</div>
            </div>
            {menuOpen && <button type="button" aria-label="Закрыть меню" className="menu-backdrop" onClick={closeMenu}/>}
        </>
    );
}
