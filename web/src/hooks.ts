import { useState, useCallback, useRef } from "react";

export function useRates(count: number): [number, (rate: number) => void, () => void] {
  const [rates, setRates] = useState<number[]>([])
  const ratesRef = useRef(rates)
  ratesRef.current = rates

  const update = useCallback((nextRate: number) => {
    const newRates = [...ratesRef.current, nextRate]
    if (newRates.length >= count) {
      newRates.shift()
    }
    setRates(newRates)
  }, [count])

  const clear = useCallback(() => {
    setRates([])
  }, [])

  const rate = rates.reduce((a, r) => a + r, 0) / (rates.length + Number.MIN_VALUE)

  return [rate, update, clear]
}
