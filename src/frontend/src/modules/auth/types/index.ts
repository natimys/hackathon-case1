export interface UserRegister {
    name: string;
    email: string;
    password: string;
}

export interface UserLogin {
    email: string;
    password: string;
}

export interface UserPublic {
    name: string;
    email: string;
}

export interface AuthState {
    user: UserPublic | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}
