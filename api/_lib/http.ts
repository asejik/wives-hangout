import type { IncomingMessage, ServerResponse } from 'node:http'

// The request/response shapes Vercel's Node runtime passes to api/ handlers (parsed body,
// query, status()/json() helpers). Declared here instead of depending on @vercel/node,
// which only supplied these two types and pulled in 11 vulnerable dev packages (P04 S-06).
export type ApiRequest = IncomingMessage & {
  body?: unknown
  query?: Record<string, string | string[]>
}

export type ApiResponse = ServerResponse & {
  status(code: number): ApiResponse
  json(body: unknown): ApiResponse
}
