import { Link, useRouter } from "expo-router";
import { View } from "react-native";
import { useMe } from "@/features/auth/hooks";
import { useCameras, useCameraStatus } from "@/features/cameras/hooks";
import { useInvoices } from "@/features/billing/hooks";
import { useTickets } from "@/features/tickets/hooks";
import { useAccessScopes, useBuildings } from "@/features/profile/hooks";
import { AppIcon, AppText, Button, Card, EmptyState, ErrorState, LoadingState, Row, Screen, SectionHeader, StatusBadge, Surface } from "@/shared/ui/components";
import { formatDate, formatMoney, formatPeriod } from "@/shared/ui/format";
import type { InvoiceStatus, TicketStatus } from "@/shared/api/contracts";
import { theme } from "@/shared/config/theme";

const invoiceStatus: Record<InvoiceStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  unpaid: { label: "К оплате", tone: "warning" },
  partially_paid: { label: "Оплачен частично", tone: "warning" },
  paid: { label: "Оплачен", tone: "success" },
  overdue: { label: "Просрочен", tone: "danger" },
};
const ticketStatus: Record<TicketStatus, { label: string; tone: "success" | "warning" | "info" | "neutral" }> = {
  new: { label: "Новая", tone: "info" }, assigned: { label: "Назначена", tone: "info" },
  in_progress: { label: "В работе", tone: "warning" }, resolved: { label: "Решена", tone: "success" }, closed: { label: "Закрыта", tone: "neutral" },
};

export default function HomeScreen() {
  const router = useRouter();
  const me = useMe();
  const buildings = useBuildings();
  const cameras = useCameras();
  const invoices = useInvoices();
  const tickets = useTickets();
  const scopes = useAccessScopes();
  const property = buildings.data?.[0];
  const recentTicket = tickets.data?.pages.flatMap((page) => page.items).find((ticket) => ticket.created_by_id === scopes.data?.user_id);
  const dueInvoice = invoices.data?.find((invoice) => Number(invoice.balance) > 0 && invoice.status !== "paid");
  const latestInvoice = dueInvoice ?? invoices.data?.[0];
  const firstName = me.data?.name?.trim().split(/\s+/)[0];

  return (
    <Screen>
      <Row style={{ minHeight: 44 }}>
        <AppText variant="heading" style={{ fontSize: 19 }}>ДозорДом</AppText>
        <Link href="/(app)/(tabs)/profile" asChild>
          <Card accessibilityLabel="Открыть профиль" style={{ padding: 9, borderRadius: theme.radius.pill, gap: 0 }}><AppIcon name="user" color={theme.colors.brand.strong} /></Card>
        </Link>
      </Row>

      {property ? <Surface style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
        <AppIcon name="location" size={18} color={theme.colors.brand.strong} />
        <AppText variant="muted" style={{ flex: 1 }}>{property.city}, {property.street}, {property.house_number}{property.building_suffix}</AppText>
      </Surface> : null}
      {buildings.isError ? <ErrorState error={buildings.error} onRetry={() => void buildings.refetch()} /> : null}
      {buildings.isLoading ? <LoadingState label="Загружаем адрес…" /> : null}
      {!buildings.isLoading && !buildings.isError && !property ? <Surface><AppText variant="muted">Для аккаунта пока не указан жилой объект.</AppText></Surface> : null}

      <ViewGreeting name={firstName} />

      <SectionHeader title="Мои камеры" action="Все ›" onPress={() => router.push("/(app)/(tabs)/cameras")} />
      {cameras.isLoading ? <LoadingState label="Проверяем камеры…" /> : null}
      {cameras.isError ? <ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} /> : null}
      {!cameras.isLoading && !cameras.isError && (cameras.data?.length ?? 0) === 0 ? (
        <EmptyState title="Камеры пока не подключены" description="Когда камеры будут доступны вашему аккаунту, они появятся здесь." />
      ) : null}
      {(Array.isArray(cameras.data) ? cameras.data.slice(0, 2) : []).map((camera) => <HomeCameraRow key={camera.id} camera={camera} onPress={() => router.push(`/cameras/${camera.id}`)} />)}

      <SectionHeader title="Платежи" action="История ›" onPress={() => router.push("/(app)/(tabs)/billing")} />
      {invoices.isLoading ? <LoadingState label="Загружаем счета…" /> : null}
      {invoices.isError ? <ErrorState error={invoices.error} onRetry={() => void invoices.refetch()} /> : null}
      {latestInvoice ? (
        <Card>
          <Row><AppText variant="muted">Счёт за {formatPeriod(latestInvoice.billing_period)}</AppText><StatusBadge label={invoiceStatus[latestInvoice.status].label} tone={invoiceStatus[latestInvoice.status].tone} /></Row>
          <Row style={{ alignItems: "flex-end" }}>
            <ViewGreetingAmount label={dueInvoice ? "К оплате" : latestInvoice.status === "paid" ? "Сумма счёта" : "Остаток"} value={formatMoney(dueInvoice ? latestInvoice.balance : latestInvoice.status === "paid" ? latestInvoice.total_amount : latestInvoice.balance, latestInvoice.currency)} />
            <Link href={`/(app)/billing/${latestInvoice.id}`} asChild>
              <Card style={{ paddingVertical: 10, paddingHorizontal: 14, borderColor: theme.colors.brand.subtleBorder, gap: 0 }}><AppText style={{ color: theme.colors.brand.strong, fontWeight: "600" }}>{Number(latestInvoice.balance) > 0 ? "Оплатить" : "Подробнее"}</AppText></Card>
            </Link>
          </Row>
        </Card>
      ) : null}
      {!invoices.isLoading && !invoices.isError && !latestInvoice ? <Surface><AppText variant="muted">Счетов пока нет.</AppText></Surface> : null}

      <SectionHeader title="Мои заявки" action="Все ›" onPress={() => router.push("/(app)/(tabs)/tickets")} />
      {tickets.isLoading || scopes.isLoading ? <LoadingState label="Загружаем заявки…" /> : null}
      {tickets.isError ? <ErrorState error={tickets.error} onRetry={() => void tickets.refetch()} /> : null}
      {tickets.isError === false && !tickets.isLoading && !scopes.isLoading && !scopes.isError && !recentTicket ? <Surface><AppText variant="muted">Последних заявок пока нет.</AppText></Surface> : null}
      {recentTicket ? <Link href={`/(app)/tickets/${recentTicket.id}`} asChild>
        <Card>
          <Row><AppText variant="heading" style={{ flex: 1 }}>{recentTicket.title}</AppText><StatusBadge label={ticketStatus[recentTicket.status].label} tone={ticketStatus[recentTicket.status].tone} /></Row>
          <AppText variant="caption">Квартира №{recentTicket.apartment_id} · {formatDate(recentTicket.created_at)}</AppText>
        </Card>
      </Link> : null}
      {(scopes.data?.is_resident || scopes.data?.is_platform_admin) ? <Link href="/(app)/tickets/new" asChild><Button label="Создать заявку" onPress={() => {}} icon={<AppIcon name="plus" size={20} color={theme.colors.onBrand} />} /></Link> : null}
    </Screen>
  );
}

function ViewGreeting({ name }: { name?: string }) {
  return <View style={{ gap: 4, paddingTop: 4, paddingBottom: 2 }}>
    <AppText variant="title">{name ? `Здравствуйте, ${name}` : "Здравствуйте"}</AppText>
    <AppText variant="muted">Ваш дом под наблюдением</AppText>
  </View>;
}

function ViewGreetingAmount({ label, value }: { label: string; value: string }) {
  return <View style={{ gap: 2 }}><AppText variant="caption">{label}</AppText><AppText variant="amount" style={{ fontSize: 25, lineHeight: 31 }}>{value}</AppText></View>;
}

function HomeCameraRow({ camera, onPress }: { camera: { id: string; name: string; location_description: string }; onPress: () => void }) {
  const status = useCameraStatus(camera.id);
  const current = status.data?.status;
  return (
    <Card onPress={onPress}>
      <Row>
        <View style={{ flex: 1, gap: 4 }}><AppText variant="heading">{camera.name}</AppText><AppText variant="caption">{camera.location_description}</AppText></View>
        <StatusBadge label={status.isLoading ? "Проверяем" : current === "online" ? "В сети" : current === "offline" ? "Нет связи" : "Статус неизвестен"} tone={current === "online" ? "success" : current === "offline" ? "danger" : "neutral"} />
      </Row>
      {status.isError ? <AppText variant="caption">Не удалось получить статус камеры.</AppText> : null}
    </Card>
  );
}
