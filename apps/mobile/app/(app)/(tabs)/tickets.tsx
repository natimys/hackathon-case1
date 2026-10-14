import { Link } from "expo-router";
import { useMe } from "@/features/auth/hooks";
import { useAccessScopes } from "@/features/profile/hooks";
import { useTickets } from "@/features/tickets/hooks";
import { AppIcon, AppText, Button, Card, EmptyState, ErrorState, LoadingState, Row, Screen, StatusBadge } from "@/shared/ui/components";
import { formatDate } from "@/shared/ui/format";
import type { TicketStatus } from "@/shared/api/contracts";
import { theme } from "@/shared/config/theme";

const statusText: Record<TicketStatus, string> = {
  new: "Новая", assigned: "Назначена", in_progress: "В работе", resolved: "Решена", closed: "Закрыта",
};
const statusTone: Record<TicketStatus, "success" | "warning" | "info" | "neutral"> = {
  new: "info", assigned: "info", in_progress: "warning", resolved: "success", closed: "neutral",
};

export default function TicketsScreen() {
  const tickets = useTickets();
  const scopes = useAccessScopes();
  const me = useMe();
  const canCreate = scopes.data?.is_resident || scopes.data?.is_platform_admin;
  const pages = tickets.data?.pages ?? [];
  const ownTickets = pages.flatMap((page) => page.items).filter((ticket) => ticket.created_by_id === scopes.data?.user_id);

  return (
    <Screen>
      <AppText variant="title">Заявки</AppText>
      <AppText variant="muted">Обращения по обслуживанию камер и дома</AppText>
      {canCreate ? <Link href="/(app)/tickets/new" asChild><Button label="Создать заявку" onPress={() => {}} icon={<AppIcon name="plus" size={20} color={theme.colors.onBrand} />} /></Link> : null}
      {tickets.isLoading || scopes.isLoading || me.isLoading ? <LoadingState /> : null}
      {tickets.isError ? <ErrorState error={tickets.error} onRetry={() => void tickets.refetch()} /> : null}
      {scopes.isError ? <ErrorState error={scopes.error} onRetry={() => void scopes.refetch()} /> : null}
      {!tickets.isLoading && !tickets.isError && scopes.data && ownTickets.length === 0 ? (
        <EmptyState title="Заявок пока нет" description={canCreate ? "Сообщите о проблеме, если камера работает некорректно." : "Заявки появятся здесь после обращения в управляющую компанию."} action={canCreate ? <Link href="/(app)/tickets/new" asChild><Button label="Создать заявку" onPress={() => {}} /></Link> : null} />
      ) : null}
      {ownTickets.map((ticket) => (
        <Link key={ticket.id} href={`/(app)/tickets/${ticket.id}`} asChild>
          <Card>
            <Row><AppText variant="heading" style={{ flex: 1 }}>{ticket.title}</AppText><StatusBadge label={statusText[ticket.status]} tone={statusTone[ticket.status]} /></Row>
            <AppText variant="caption">Квартира №{ticket.apartment_id} · {formatDate(ticket.created_at)}</AppText>
          </Card>
        </Link>
      ))}
      {tickets.hasNextPage ? (
        <Button label={tickets.isFetchingNextPage ? "Загружаем…" : "Показать ещё"} onPress={() => void tickets.fetchNextPage()} disabled={tickets.isFetchingNextPage} secondary />
      ) : null}
    </Screen>
  );
}
