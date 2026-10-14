export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Не удалось связаться с сервером. Проверьте подключение к интернету.";
}

export function describeApiError(status: number, detail: unknown): string {
  if (status === 401) return "Сессия завершена. Войдите в аккаунт снова.";
  if (status === 403) return "У вашей учётной записи нет доступа к этому разделу.";
  if (status === 404) return "Данные не найдены или больше недоступны.";
  if (status === 413) return "Файл превышает максимально допустимый размер.";
  if (status === 415) return "Этот тип файла не поддерживается. Выберите фото или видео в допустимом формате.";
  if (status === 422) {
    if (Array.isArray(detail)) {
      const messages = detail
        .map((issue) => (issue && typeof issue === "object" && "msg" in issue ? String(issue.msg) : ""))
        .filter(Boolean);
      if (messages.length) return messages.join("\n");
    }
    if (typeof detail === "string") return detail;
    return "Проверьте заполнение полей формы.";
  }
  if (status >= 500) return "Сервер временно недоступен. Попробуйте позже.";
  return typeof detail === "string" ? detail : `Ошибка запроса (${status}).`;
}
