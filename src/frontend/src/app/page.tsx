import {Navigate} from "react-router-dom";
import {useAuth} from "@/providers/auth-provider";

export default function RootPage() {
    const {isAuthenticated, isLoading} = useAuth();
    if (isLoading) return <main className="loading-state">Загрузка…</main>;
    if (isAuthenticated) return <Navigate to="/dashboard" replace/>;
    let hasSeenWelcome = false;
    try { hasSeenWelcome = window.localStorage.getItem("dozordom.welcome-seen") === "true"; } catch { /* The welcome screen remains available if storage is unavailable. */ }
    return <Navigate to={hasSeenWelcome ? "/login" : "/welcome"} replace/>;
}
