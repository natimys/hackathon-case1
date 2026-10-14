import {Link, useLocation} from "react-router-dom";
import {moduleNavs} from "@/config/modules";
import {useAuth} from "@/providers/auth-provider";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";

export function AppNavigation() {
    const {pathname} = useLocation();
    const {user, logout} = useAuth();
    const {data: scopes} = useAccessScopes();
    const visibleModules = moduleNavs.filter((module) =>
        module.active &&
        (module.name !== "billing" || scopes?.is_platform_admin || scopes?.scoped_roles.includes("company_admin")) &&
        (module.name !== "properties" || scopes?.is_platform_admin || scopes?.scoped_roles.includes("company_admin")) &&
        (module.name !== "cameras" || scopes?.is_platform_admin || scopes?.scoped_roles.includes("company_admin")) &&
        (module.name !== "users" || scopes?.is_platform_admin),
    );

    return (
        <header className="app-header">
            <Link to="/dashboard" className="app-brand">ДозорДом</Link>
            <nav className="page-nav" aria-label="Разделы приложения">
                <Link to="/dashboard" className="nav-button"
                      aria-current={pathname === "/dashboard" ? "page" : undefined}>Обзор</Link>
                {visibleModules.map((module) => (
                    <Link
                        key={module.name}
                        to={module.href}
                        className="nav-button"
                        aria-current={pathname.startsWith(module.href) ? "page" : undefined}
                    >
                        {module.label}
                    </Link>
                ))}
                {scopes?.scoped_roles.includes("technician") && (
                    <Link to="/dashboard/technician" className="nav-button"
                          aria-current={pathname.startsWith("/dashboard/technician") ? "page" : undefined}>
                        Мои задачи
                    </Link>
                )}
            </nav>
            <div className="account-actions">
                {user && <span className="account-name">{user.name}</span>}
                <button type="button" className="nav-button" onClick={logout}>Выйти</button>
            </div>
        </header>
    );
}
