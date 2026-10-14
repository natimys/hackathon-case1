import { Link } from "expo-router";
import { useMe } from "@/features/auth/hooks";
import { useBuildings } from "@/features/profile/hooks";
import { AppText, Card, ErrorState, LoadingState, Screen } from "@/shared/ui/components";

export default function HomeScreen() {
  const { data: user } = useMe();
  const buildings = useBuildings();
  const property = buildings.data?.[0];

  return (
    <Screen>
      <AppText variant="title">Здравствуйте, {user?.name}</AppText>
      <AppText variant="muted">Управление вашим домом</AppText>

      {buildings.isLoading ? <LoadingState label="Загружаем адрес…" /> : null}
      {buildings.isError ? <ErrorState error={buildings.error} onRetry={() => void buildings.refetch()} /> : null}
      {property ? (
        <Card>
          <AppText variant="caption">Жилой объект</AppText>
          <AppText variant="heading">{property.city}, {property.street}, {property.house_number}{property.building_suffix}</AppText>
        </Card>
      ) : null}
      {!buildings.isLoading && !buildings.isError && !property ? (
        <Card><AppText variant="muted">Для аккаунта пока не указан жилой объект.</AppText></Card>
      ) : null}

      <Link href="/(app)/(tabs)/billing" asChild><Card><AppText variant="heading">Счета и начисления</AppText><AppText variant="muted">Баланс, детализация и история платежей</AppText></Card></Link>
      <Link href="/(app)/(tabs)/tickets" asChild><Card><AppText variant="heading">Заявки</AppText><AppText variant="muted">Обращения по обслуживанию дома</AppText></Card></Link>
      <Link href="/(app)/(tabs)/cameras" asChild><Card><AppText variant="heading">Камеры</AppText><AppText variant="muted">Доступные камеры видеонаблюдения</AppText></Card></Link>
    </Screen>
  );
}
