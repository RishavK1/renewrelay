export interface Page {
  after?: string;
  limit?: number;
}

export function pageResult<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
}
