import { HttpError } from "@/lib/api";

/**
 * Maps a login attempt error to a Polish user-facing message.
 * Only inspects HTTP status — never logs or exposes sensitive details.
 */
export function resolveLoginError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.status === 400 || err.status === 401) {
      return "Niepoprawny email lub hasło.";
    }
    if (err.status === 429) {
      return "Zbyt wiele prób logowania. Spróbuj ponownie za chwilę.";
    }
  }
  return "Wystąpił błąd. Spróbuj ponownie.";
}
