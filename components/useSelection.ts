"use client";

import { useState } from "react";

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: string[]) {
    setSelected((s) => {
      const allSelected = ids.length > 0 && ids.every((id) => s.has(id));
      const next = new Set(s);
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
  }

  return { selected, toggle, toggleAll, clear };
}
