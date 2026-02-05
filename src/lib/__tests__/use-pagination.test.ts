import { describe, it, expect } from "vitest";
import { calculatePagination } from "../use-pagination";

describe("calculatePagination", () => {
  it("returns single page for small datasets", () => {
    const result = calculatePagination(10, 25, 1);
    expect(result.totalPages).toBe(1);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(10);
    expect(result.pages).toEqual([1]);
    expect(result.hasPrev).toBe(false);
    expect(result.hasNext).toBe(false);
  });

  it("calculates correct indices for page 2", () => {
    const result = calculatePagination(100, 25, 2);
    expect(result.totalPages).toBe(4);
    expect(result.startIndex).toBe(25);
    expect(result.endIndex).toBe(50);
    expect(result.hasPrev).toBe(true);
    expect(result.hasNext).toBe(true);
  });

  it("handles last page with partial data", () => {
    const result = calculatePagination(30, 25, 2);
    expect(result.totalPages).toBe(2);
    expect(result.startIndex).toBe(25);
    expect(result.endIndex).toBe(30);
    expect(result.hasNext).toBe(false);
  });

  it("clamps page above total pages", () => {
    const result = calculatePagination(50, 25, 99);
    expect(result.startIndex).toBe(25);
    expect(result.endIndex).toBe(50);
  });

  it("clamps page below 1", () => {
    const result = calculatePagination(50, 25, -5);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(25);
  });

  it("handles zero items", () => {
    const result = calculatePagination(0, 25, 1);
    expect(result.totalPages).toBe(1);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(0);
    expect(result.pages).toEqual([1]);
  });

  it("shows all pages when totalPages <= 7", () => {
    const result = calculatePagination(175, 25, 4);
    expect(result.totalPages).toBe(7);
    expect(result.pages).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("adds ellipsis for large page counts", () => {
    const result = calculatePagination(500, 25, 10);
    expect(result.totalPages).toBe(20);
    expect(result.pages).toContain("ellipsis");
    expect(result.pages).toContain(1);
    expect(result.pages).toContain(20);
    expect(result.pages).toContain(10);
  });

  it("includes current page +/- 1 in pages", () => {
    const result = calculatePagination(500, 25, 10);
    expect(result.pages).toContain(9);
    expect(result.pages).toContain(10);
    expect(result.pages).toContain(11);
  });

  it("handles first page of many", () => {
    const result = calculatePagination(500, 25, 1);
    expect(result.pages[0]).toBe(1);
    expect(result.pages[1]).toBe(2);
    expect(result.hasPrev).toBe(false);
    expect(result.hasNext).toBe(true);
  });

  it("handles last page of many", () => {
    const result = calculatePagination(500, 25, 20);
    const lastIdx = result.pages.length - 1;
    expect(result.pages[lastIdx]).toBe(20);
    expect(result.hasPrev).toBe(true);
    expect(result.hasNext).toBe(false);
  });
});
