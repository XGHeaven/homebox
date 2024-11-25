import { BASE_URL } from '../const'

export const ping = async () => {
  const now = performance.now()
  const resp = await fetch(`${BASE_URL}/ping`, { method: 'GET' })
  await resp.text()
  const time = performance.now() - now
  return time
}
