export interface UserRead {
    id: number;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
}

export interface UserCreate {
    name: string;
    email: string;
    password: string;
    role?: string;
}

export interface UserUpdate {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    is_active?: boolean;
}

export interface UsersResponse {
    data: UserRead[];
    total: number;
    page: number;
    size: number;
}
