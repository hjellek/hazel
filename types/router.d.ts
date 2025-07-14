declare module 'router' {
  import { IncomingMessage, ServerResponse } from 'http'

  interface Router {
    get(
      path: string,
      handler: (req: IncomingMessage, res: ServerResponse) => void
    ): void
    post(
      path: string,
      handler: (req: IncomingMessage, res: ServerResponse) => void
    ): void
    put(
      path: string,
      handler: (req: IncomingMessage, res: ServerResponse) => void
    ): void
    delete(
      path: string,
      handler: (req: IncomingMessage, res: ServerResponse) => void
    ): void
    (
      req: IncomingMessage,
      res: ServerResponse,
      next: (err?: Error) => void
    ): void
  }

  interface RouterOptions {
    caseSensitive?: boolean
    strict?: boolean
    mergeParams?: boolean
  }

  function Router(options?: RouterOptions): Router
  export = Router
}
