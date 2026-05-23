export function cloneOverlayJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeOverlayDocumentName(rawName: unknown, fallbackName: string): string {
  if (typeof rawName !== "string") {
    return fallbackName;
  }

  const trimmedName = rawName.trim();
  return trimmedName.length > 0 ? trimmedName : fallbackName;
}

export function normalizeOverlayDocumentTimestamp(rawTimestamp: unknown, fallbackTimestamp: string): string {
  if (typeof rawTimestamp !== "string") {
    return fallbackTimestamp;
  }

  const trimmedTimestamp = rawTimestamp.trim();
  return trimmedTimestamp.length > 0 ? trimmedTimestamp : fallbackTimestamp;
}

export function normalizeOverlayDocumentString(rawValue: unknown, fallbackValue: string): string {
  if (typeof rawValue !== "string") {
    return fallbackValue;
  }

  const trimmedValue = rawValue.trim();
  return trimmedValue.length > 0 ? trimmedValue : fallbackValue;
}

export function normalizeOverlayNumber(rawValue: unknown, fallbackValue: number): number {
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallbackValue;
}

export function normalizeOverlayBoolean(rawValue: unknown, fallbackValue: boolean): boolean {
  return typeof rawValue === "boolean" ? rawValue : fallbackValue;
}
