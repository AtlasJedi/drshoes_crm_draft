import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOrderRowSelection } from "../useOrderRowSelection";

const IDS = ["a", "b", "c", "d"];

describe("useOrderRowSelection", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    expect(result.current.selectedIds).toEqual([]);
  });

  it("toggleRow adds an id when not selected", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleRow("b"));
    expect(result.current.selectedIds).toContain("b");
    expect(result.current.selectedIds).toHaveLength(1);
  });

  it("toggleRow removes an id when already selected", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleRow("b"));
    act(() => result.current.toggleRow("b"));
    expect(result.current.selectedIds).toHaveLength(0);
  });

  it("toggleAll selects all visible ids", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleAll());
    expect(result.current.selectedIds).toEqual(IDS);
  });

  it("toggleAll deselects all when all are already selected", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleAll());
    act(() => result.current.toggleAll());
    expect(result.current.selectedIds).toHaveLength(0);
  });

  it("clear empties selection", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleAll());
    act(() => result.current.clear());
    expect(result.current.selectedIds).toHaveLength(0);
  });

  it("selectedIds order is stable (insertion order)", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleRow("c"));
    act(() => result.current.toggleRow("a"));
    expect(result.current.selectedIds).toEqual(["c", "a"]);
  });

  it("isAllSelected is true only when all visible ids are selected", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleAll());
    expect(result.current.isAllSelected).toBe(true);
  });

  it("isAllSelected is false when partial selection", () => {
    const { result } = renderHook(() => useOrderRowSelection(IDS));
    act(() => result.current.toggleRow("a"));
    expect(result.current.isAllSelected).toBe(false);
  });
});
