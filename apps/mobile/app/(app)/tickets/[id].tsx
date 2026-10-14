import { useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { AppIcon, AppText, Button, Card, ErrorState, LoadingState, Row, Screen, SectionHeader, StatusBadge } from "@/shared/ui/components";
import { theme } from "@/shared/config/theme";
import { formatDate } from "@/shared/ui/format";
import { useTicket, useTicketAttachments, useTicketHistory, useUploadAttachment } from "@/features/tickets/hooks";

const statusText: Record<string, string> = {
  new: "Новая", assigned: "Назначена", in_progress: "В работе", resolved: "Решена", closed: "Закрыта",
};
const statusTone: Record<string, "success" | "warning" | "info" | "neutral"> = {
  new: "info", assigned: "info", in_progress: "warning", resolved: "success", closed: "neutral",
};

export default function TicketDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);
  const ticket = useTicket(id);
  const history = useTicketHistory(id);
  const attachments = useTicketAttachments(id);
  const upload = useUploadAttachment(id);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const chooseAttachment = async () => {
    setPickerError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    await upload.mutateAsync({ uri: file.uri, name: file.name, mimeType: file.mimeType ?? "application/octet-stream" });
  };

  const handleChooseAttachment = async () => {
    try {
      await chooseAttachment();
    } catch {
      setPickerError("Не удалось открыть список файлов. Попробуйте ещё раз.");
    }
  };

  if (ticket.isLoading) return <Screen><LoadingState /></Screen>;
  if (ticket.isError || !ticket.data) return <Screen><ErrorState error={ticket.error ?? new Error("Заявка не найдена.")} onRetry={() => void ticket.refetch()} /></Screen>;

  return (
    <Screen>
      <AppText variant="caption">Заявка №{ticket.data.id}</AppText>
      <AppText variant="title">{ticket.data.title}</AppText>
      <Card>
        <Row><AppText variant="muted">Статус</AppText><StatusBadge label={statusText[ticket.data.status] ?? ticket.data.status} tone={statusTone[ticket.data.status] ?? "neutral"} /></Row>
        <AppText variant="body">{ticket.data.description}</AppText>
        <AppText variant="caption">Квартира №{ticket.data.apartment_id} · создана {formatDate(ticket.data.created_at)}</AppText>
      </Card>
      <SectionHeader title="История заявки" />
      {history.isLoading ? <LoadingState /> : null}
      {history.isError ? <ErrorState error={history.error} onRetry={() => void history.refetch()} /> : null}
      {history.data?.map((item) => (
        <Card key={item.id}>
          <AppText variant="body">{statusText[item.new_status] ?? item.new_status}</AppText>
          <AppText variant="caption">{formatDate(item.created_at)}</AppText>
          {item.comment ? <AppText variant="muted">{item.comment}</AppText> : null}
        </Card>
      ))}
      <SectionHeader title="Вложения" />
      {attachments.isLoading ? <LoadingState /> : null}
      {attachments.isError ? <ErrorState error={attachments.error} onRetry={() => void attachments.refetch()} /> : null}
      {!attachments.isLoading && !attachments.isError && attachments.data?.length === 0 ? <AppText variant="muted">Вложений пока нет.</AppText> : null}
      {attachments.data?.map((item) => (
        <Card key={item.id}>
          <AppText variant="body">{item.original_filename}</AppText>
          <AppText variant="caption">{Math.ceil(item.size_bytes / 1024)} КБ · {formatDate(item.created_at)}</AppText>
        </Card>
      ))}
      {upload.isError ? <ErrorState error={upload.error} /> : null}
      {pickerError ? <AppText style={{ color: theme.colors.danger }}>{pickerError}</AppText> : null}
      {upload.isSuccess ? <AppText variant="muted">Файл загружен.</AppText> : null}
      <Button label="Добавить фото или видео" onPress={() => void handleChooseAttachment()} disabled={upload.isPending} loading={upload.isPending} secondary icon={!upload.isPending ? <AppIcon name="plus" color={theme.colors.brand.strong} /> : undefined} />
    </Screen>
  );
}
