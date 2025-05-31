/**
 * Performs an HTTP request with an optional timeout and parses the response as JSON.
 *
 * @template T - The expected type of the parsed JSON response.
 * @param url - The URL or URL object to which the request is sent.
 * @param init - Fetch initialization options extended with an optional timeout in milliseconds.
 *               If `timeout` is provided, the request will be aborted after the specified time.
 * @returns A promise that resolves to the parsed JSON value of type T.
 * @throws {Error} If the HTTP response status is not OK, or if the request is aborted due to timeout.
 */
export async function request<T = unknown>(
  url: string | URL,
  init: RequestInit & { timeout?: number } = {},
): Promise<T> {
  const controller = new AbortController()
  const id = init.timeout ? setTimeout(() => controller.abort(), init.timeout) : 0

  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok)
      throw new Error(`${res.status} - ${await res.text()}`)

    const t = (await res.json()) as T
    return t
  }
  finally {
    if (id)
      clearTimeout(id)
  }
}

/**
 * Performs an HTTP request with an optional timeout and returns the response as an ArrayBuffer.
 *
 * @param url - The URL or URL object to which the request is sent.
 * @param init - Fetch initialization options extended with an optional timeout in milliseconds.
 *               If `timeout` is provided, the request will be aborted after the specified time.
 * @returns A promise that resolves to the raw response data as an ArrayBuffer.
 * @throws {Error} If the HTTP response status is not OK, or if the request is aborted due to timeout.
 */
export async function requestArrayBuffer(
  url: string | URL,
  init: RequestInit & { timeout?: number } = {},
): Promise<ArrayBuffer> {
  const controller = new AbortController()
  const id = init.timeout ? setTimeout(() => controller.abort(), init.timeout) : 0

  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok)
      throw new Error(`${res.status} - ${await res.text()}`)

    return await res.arrayBuffer()
  }
  finally {
    if (id)
      clearTimeout(id)
  }
}
