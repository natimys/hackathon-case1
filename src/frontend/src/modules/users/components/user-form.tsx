"use client";

import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useCreateUser, useUpdateUser} from "@/modules/users/hooks/use-users";
import type {UserCreate, UserRead, UserUpdate} from "@/modules/users/types";

interface UserFormProps {
    mode: "create" | "edit";
    user?: UserRead | null;
}

export function UserForm({mode, user}: UserFormProps) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("user");
    const [isActive, setIsActive] = useState(true);

    const createMutation = useCreateUser();
    const updateMutation = useUpdateUser(user?.id ?? 0);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            setName(user.name);
            setEmail(user.email);
            setRole(user.role);
            setIsActive(user.is_active);
        }
    }, [user]);

    const isPending = createMutation.isPending || updateMutation.isPending;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === "create") {
            const payload: UserCreate = {name, email, password, role};
            createMutation.mutate(payload, {
                onSuccess: () => navigate("/dashboard/users"),
            });
        } else {
            const payload: UserUpdate = {};
            if (name !== user?.name) payload.name = name;
            if (email !== user?.email) payload.email = email;
            if (password) payload.password = password;
            if (role !== user?.role) payload.role = role;
            if (isActive !== user?.is_active) payload.is_active = isActive;

            if (Object.keys(payload).length === 0) {
                navigate("/dashboard/users");
                return;
            }

            updateMutation.mutate(payload, {
                onSuccess: () => navigate("/dashboard/users"),
            });
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <label htmlFor="name">
                    Name
                </label>
                <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>

            <div>
                <label htmlFor="email">
                    Email
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>

            <div>
                <label htmlFor="password">
                    Password {mode === "edit" && <span>(leave blank to keep current)</span>}
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={mode === "create"}
                />
            </div>

            <div>
                <label htmlFor="role">
                    Role
                </label>
                <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            {mode === "edit" && (
                <div>
                    <input
                        id="is_active"
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <label htmlFor="is_active">
                        Active
                    </label>
                </div>
            )}

            {(createMutation.isError || updateMutation.isError) && (
                <p>
                    Failed to save user. Please try again.
                </p>
            )}

            <div>
                <button
                    type="submit"
                    disabled={isPending}
                >
                    {isPending
                        ? "Saving..."
                        : mode === "create"
                            ? "Create user"
                            : "Save changes"}
                </button>
                <button
                    type="button"
                    onClick={() => navigate("/dashboard/users")}
                    disabled={isPending}
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
