import Router from 'router'
import finalhandler from 'finalhandler'
import { IncomingMessage, ServerResponse } from 'http'
import Cache, { CacheConfig } from './cache'
import createRoutes from './routes'

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void

export default function createServer(config: CacheConfig): RequestHandler {
  const router = Router()
  let cache: Cache | null = null

  try {
    cache = new Cache(config)
  } catch (err) {
    const { code, message } = err

    if (code) {
      return (req: IncomingMessage, res: ServerResponse) => {
        res.statusCode = 400

        res.end(
          JSON.stringify({
            error: {
              code,
              message
            }
          })
        )
      }
    }

    throw err
  }

  const routes = createRoutes({ cache, config })

  // Define a route for every relevant path
  router.get('/', routes.overview)
  router.get('/download', routes.download)
  router.get('/download/:platform', routes.downloadPlatform)
  router.get('/update/:platform/:version', routes.update)
  router.get('/update/win32/:version/RELEASES', routes.releases)

  return (req: IncomingMessage, res: ServerResponse) => {
    router(req, res, finalhandler(req, res))
  }
}
