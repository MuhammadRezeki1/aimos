"use client";

import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return;

    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(JSON.parse(raw) as T);
    } catch {
      setValue(initialValue);
    }
  }, [key, initialValue]);

  const updateValue = (nextValue: T) => {
    setValue(nextValue);
    window.localStorage.setItem(key, JSON.stringify(nextValue));
  };

  return [value, updateValue] as const;
}
