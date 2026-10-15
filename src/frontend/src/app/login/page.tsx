import {LoginForm} from "@/modules/auth/components/login-form";
import {BrandMark} from "@/components/ui";

export default function LoginPage() {
    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-brand"><BrandMark/>ДозорДом</div>
                <p className="muted">Войдите, чтобы продолжить</p>
                <h1>Вход в систему</h1>
                <LoginForm/>
            </div>
        </div>
    );
}
