import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAccessScopes, useApartments } from "@/features/profile/hooks";
import { useCreateTicket } from "@/features/tickets/hooks";
import { AppText, Button, Card, ErrorState, LoadingState, Screen, TextField } from "@/shared/ui/components";
import { theme } from "@/shared/config/theme";
import type { TicketPriority } from "@/shared/api/contracts";

const priorities: Array<{ value: TicketPriority; label: string }> = [
  { value: "low", label: "Низкий" },
  { value: "normal", label: "Обычный" },
  { value: "high", label: "Высокий" },
  { value: "urgent", label: "Срочный" },
];

export default function NewTicketScreen() {
  const [apartmentId, setApartmentId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const scopes = useAccessScopes();
  const apartments = useApartments();
  const createTicket = useCreateTicket();
  const router = useRouter();
  const canCreate = scopes.data?.is_resident || scopes.data?.is_platform_admin;

  const submit = async () => {
    if (!apartmentId || title.trim().length < 3 || description.trim().length < 3 || createTicket.isPending) return;
    try {
      const ticket = await createTicket.mutateAsync({
        apartment_id: apartmentId,
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      router.replace(`/(app)/tickets/${ticket.id}`);
    } catch {
      // The mutation error is shown below; do not claim the ticket was created.
    }
  };

  if (scopes.isLoading || apartments.isLoading) return <Screen><LoadingState /></Screen>;
  if (scopes.isError) return <Screen><ErrorState error={scopes.error} onRetry={() => void scopes.refetch()} /></Screen>;
  if (!canCreate) return <Screen><AppText variant="title">Создание заявки</AppText><AppText variant="muted">Создавать заявки можно только с подтверждённой привязкой к квартире.</AppText></Screen>;
  if (apartments.isError) return <Screen><ErrorState error={apartments.error} onRetry={() => void apartments.refetch()} /></Screen>;

  return (
    <Screen>
      <AppText variant="title">Новая заявка</AppText>
      <AppText variant="muted">Выберите квартиру и опишите проблему.</AppText>
      <AppText variant="heading">Квартира</AppText>
      {apartments.data?.length ? apartments.data.map((apartment) => (
        <Pressable key={apartment.id} onPress={() => setApartmentId(apartment.id)}>
          <Card>
            <Text style={{ color: apartmentId === apartment.id ? theme.colors.primary : theme.colors.text, fontWeight: "700" }}>
              {apartmentId === apartment.id ? "✓ " : ""}Квартира №{apartment.number}
            </Text>
          </Card>
        </Pressable>
      )) : <AppText variant="muted">Для учётной записи не найдены доступные квартиры.</AppText>}
      <TextField label="Тема" value={title} onChangeText={setTitle} maxLength={200} placeholder="Например, не работает освещение" />
      <TextField label="Описание" value={description} onChangeText={setDescription} maxLength={10000} multiline placeholder="Опишите, что произошло" />
      <AppText variant="heading">Приоритет</AppText>
      {priorities.map((item) => (
        <Pressable key={item.value} onPress={() => setPriority(item.value)}>
          <Card><AppText style={{ color: priority === item.value ? theme.colors.primary : theme.colors.text }}>{priority === item.value ? "● " : "○ "}{item.label}</AppText></Card>
        </Pressable>
      ))}
      {createTicket.isError ? <ErrorState error={createTicket.error} /> : null}
      <Button label={createTicket.isPending ? "Отправляем…" : "Отправить заявку"} onPress={() => void submit()} disabled={createTicket.isPending || !apartmentId || title.trim().length < 3 || description.trim().length < 3} />
    </Screen>
  );
}
