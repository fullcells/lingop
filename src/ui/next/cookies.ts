export function setCookie(
  cookieKey: string,
  cookieValue: string,
  durationSeconds: number,
): void {
  document.cookie = `${cookieKey}=${cookieValue};path=/;max-age=${durationSeconds};samesite=lax`;
}

export function clearCookie(cookieKey: string): void {
  document.cookie = `${cookieKey}=;path=/;max-age=0`;
}
