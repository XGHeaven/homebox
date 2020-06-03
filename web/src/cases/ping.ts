import { BASE_URL } from '../const'

export const ping = async () => {
  const resp = await fetch(`${BASE_URL}/ping`, { method: 'GET' })
  const now = performance.now()
  await resp.text()
  const time = performance.now() - now
  // rtt is twice
  return time * 2
}
