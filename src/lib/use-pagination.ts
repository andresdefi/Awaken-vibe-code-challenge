export interface PaginationResult {
  totalPages: number;
  startIndex: number;
  endIndex: number;
  pages: (number | "ellipsis")[];
  hasPrev: boolean;
  hasNext: boolean;
}

export function calculatePagination(
  totalItems: number,
  pageSize: number,
  currentPage: number
): PaginationResult {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.max(1, Math.min(currentPage, totalPages));

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Build page numbers: always show first/last, current +/- 1, ellipsis for gaps
  const pages: (number | "ellipsis")[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    const near = new Set<number>();
    near.add(1);
    near.add(totalPages);
    for (let i = safePage - 1; i <= safePage + 1; i++) {
      if (i >= 1 && i <= totalPages) near.add(i);
    }

    const sorted = Array.from(near).sort((a, b) => a - b);

    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
        pages.push("ellipsis");
      }
      pages.push(sorted[i]);
    }
  }

  return {
    totalPages,
    startIndex,
    endIndex,
    pages,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}
