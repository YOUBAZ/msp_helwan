import type { HierarchyPosition } from "./types";

/** Group positions by parent (null = top level), each list in display order. */
export function childrenByParent(positions: HierarchyPosition[]) {
  const map = new Map<string | null, HierarchyPosition[]>();
  for (const p of positions) {
    const list = map.get(p.parentId) ?? [];
    list.push(p);
    map.set(p.parentId, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
  return (id: string | null) => map.get(id) ?? [];
}
