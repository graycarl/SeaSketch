import { useEffect, useRef, useState } from "react";

export function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timerRef.current);
  }, [value, delay]);

  return debounced;
}
