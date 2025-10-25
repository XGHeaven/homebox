import { BASE_URL } from '../const'

export const ping = async () => {
  const now = performance.now()
  const resp = await fetch(`${BASE_URL}/ping`, { method: 'HEAD' })

  // we calculate time before consuming the response
  const time = performance.now() - now

  // some bad browsers that will memory leak if we don't consume the response
  await resp.arrayBuffer()

  return time
}
