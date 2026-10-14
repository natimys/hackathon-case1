"use client";

import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {useLogin} from "@/modules/auth/hooks/use-auth";

export function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const loginMutation = useLogin();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        loginMutation.mutate(
            {email, password},
            {
                onSuccess: () => {
                    navigate("/dashboard");
                },
            },
        );
    };

    return (
        <form className="login-form" onSubmit={handleSubmit}>
            <div>
                <label htmlFor="email">
                    Электронная почта
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="email@example.com"
                />
            </div>
            <div>
                <label htmlFor="password">
                    Пароль
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                />
            </div>
            {loginMutation.isError && <p role="alert">Не удалось войти. Проверьте адрес электронной почты и пароль и попробуйте ещё раз.</p>}
            <button
                type="submit"
                disabled={loginMutation.isPending}
            >
                {loginMutation.isPending ? "Входим…" : "Войти"}
            </button>
        </form>
    );
}
