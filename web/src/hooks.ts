import { useState, useCallback, useRef, useMemo, useEffect } from 'react'

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

export function useMediaQuery(query: string) {
  const getMatches = () => (typeof matchMedia === 'undefined' ? false : matchMedia(query).matches)
  const [matches, setMatches] = useState(getMatches)

  useEffect(() => {
    if (typeof matchMedia === 'undefined') {
      return
    }

    const media = matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    if (media.addEventListener) {
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    }
    media.addListener(onChange)
    return () => media.removeListener(onChange)
  }, [query])

  return matches
}
