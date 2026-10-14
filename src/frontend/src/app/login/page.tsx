import {LoginForm} from "@/modules/auth/components/login-form";

export default function LoginPage() {
    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-brand"><span className="brand-mark" aria-hidden="true">⌂</span>ДозорДом</div>
                <p className="muted">Войдите, чтобы продолжить</p>
                <h1>Вход в систему</h1>
                <LoginForm/>
            </div>
        </div>
    );
}
