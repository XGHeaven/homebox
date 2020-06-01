import { useState, useCallback, useRef, useMemo } from 'react'

export function useRates(count: number): [number, (rate: number) => void, () => void] {
  const [rates, setRates] = useState<number[]>([])
  const ratesRef = useRef(rates)
  ratesRef.current = rates

  const update = useCallback(
    (nextRate: number) => {
      const newRates = [...ratesRef.current, nextRate]
      if (newRates.length >= count) {
        newRates.shift()
      }
      setRates(newRates)
    },
    [count],
  )

  const clear = useCallback(() => {
    setRates([])
  }, [])

  const rate = useMemo(() => {
    const size = Math.floor(rates.length * 0.15)
    const newRates = rates
      .slice()
      .sort()
      .slice(size, rates.length - size)
    return newRates.reduce((a, r) => a + r, 0) / (newRates.length + Number.MIN_VALUE)
  }, [rates])

  return [rate, update, clear]
}
