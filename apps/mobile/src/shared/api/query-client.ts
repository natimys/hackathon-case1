import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const status = error && typeof error === "object" && "status" in error
          ? (error as { status: number | null }).status
          : null;
        const transientHttpError = status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
        return (status === null || transientHttpError) && failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 4_000),
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});
