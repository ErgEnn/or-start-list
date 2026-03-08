const MAX_FRACTION_DIGITS = 2;
const CENTS_MULTIPLIER = 10 ** MAX_FRACTION_DIGITS;
const FLOAT_TOLERANCE = 1e-9;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function normalizeMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * CENTS_MULTIPLIER) / CENTS_MULTIPLIER;
}

export function parseMoney(value: unknown): number | "invalid" {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 0) {
    return "invalid";
  }

  const normalized = normalizeMoney(parsed);
  if (Math.abs(parsed - normalized) > FLOAT_TOLERANCE) {
    return "invalid";
  }

  return normalized;
}

export function parseOptionalMoney(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return parseMoney(value);
}

export function toMoneyDb(value: number): string {
  return normalizeMoney(value).toFixed(MAX_FRACTION_DIGITS);
}

export function moneyFromDb(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    return null;
  }
  return normalizeMoney(parsed);
}

export function formatEuro(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return `\u20ac${normalizeMoney(value).toFixed(MAX_FRACTION_DIGITS)}`;
}
