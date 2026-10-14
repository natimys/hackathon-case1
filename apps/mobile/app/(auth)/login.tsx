import { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { AppText, Button, ErrorState, Screen, TextField } from "@/shared/ui/components";
import { useLogin, useMe } from "@/features/auth/hooks";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const me = useMe();
  const router = useRouter();

  if (me.data) return <Redirect href="/(app)/(tabs)" />;

  const submit = async () => {
    if (!email.trim() || !password || login.isPending) return;
    try {
      await login.mutateAsync({ email, password });
      const result = await me.refetch();
      if (result.isError || !result.data) throw result.error ?? new Error("Не удалось открыть сессию.");
      router.replace("/(app)/(tabs)");
    } catch {
      // The mutation state below displays backend validation and authentication errors.
    }
  };

  return (
    <Screen>
      <AppText variant="title">Войти</AppText>
      <AppText variant="muted">Введите данные своей учётной записи.</AppText>
      <TextField label="Электронная почта" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <TextField label="Пароль" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" />
      {login.isError ? <ErrorState error={login.error} /> : null}
      <Button label={login.isPending ? "Входим…" : "Войти"} onPress={() => void submit()} disabled={login.isPending || !email.trim() || !password} />
    </Screen>
  );
}
