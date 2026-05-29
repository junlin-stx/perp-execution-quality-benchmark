import type { BookLevel } from "../types/orderbook.js";

export function parseNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid number for ${label}`);
  }
  return parsed;
}

export function parseTupleLevels(levels: unknown, label: string): BookLevel[] {
  if (!Array.isArray(levels)) throw new Error(`invalid ${label} levels`);
  return levels.map((level, index) => {
    if (!Array.isArray(level) || level.length < 2) throw new Error(`invalid ${label} level ${index}`);
    return {
      price: parseNumber(level[0], `${label}.${index}.price`),
      size: parseNumber(level[1], `${label}.${index}.size`)
    };
  });
}

export function sortBidsDescending(levels: BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => b.price - a.price);
}

export function sortAsksAscending(levels: BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => a.price - b.price);
}
