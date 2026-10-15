"use client";

import {createContext, type ReactNode, useContext, useEffect} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {useLogout, useMe} from "@/modules/auth/hooks/use-auth";
import type {UserPublic} from "@/modules/auth/types";

interface AuthContextValue {
    user: UserPublic | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({children}: { children: ReactNode }) {
    const {data: user, isLoading, isError} = useMe();
    const logoutMutation = useLogout();
    const navigate = useNavigate();
    const {pathname} = useLocation();

    useEffect(() => {
        if (!isLoading && isError && pathname !== "/login" && pathname !== "/welcome" && pathname !== "/") {
            navigate("/login");
        }
    }, [isLoading, isError, pathname, navigate]);

    const isAuthenticated = !isLoading && !isError && !!user;

    const logout = () => {
        logoutMutation.mutate(undefined, {
            onSuccess: () => {
                navigate("/login");
            },
        });
    };

    return (
        <AuthContext.Provider
            value={{
                user: user ?? null,
                isAuthenticated,
                isLoading,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
