"use client";

import { useState } from "react";

export function useDropdown() {
  const [open, setOpen] = useState(false);

  return {
    open,
    openDropdown: () => setOpen(true),
    closeDropdown: () => setOpen(false),
    toggleDropdown: () => setOpen((value) => !value)
  };
}
