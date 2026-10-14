"use client";

import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {type ReactNode, useState} from "react";
import {AuthProvider} from "@/providers/auth-provider";

export function Providers({children}: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000,
                        retry: false,
                        refetchOnWindowFocus: false,
                    },
                },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
    );
}
