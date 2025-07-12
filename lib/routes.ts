import * as urlHelpers from 'url'
import { IncomingMessage, ServerResponse } from 'http'
import { send } from 'micro'
import { valid, compare } from 'semver'
import { parse } from 'express-useragent'
import distanceInWordsToNow from 'date-fns/distance_in_words_to_now'
import checkAlias from './aliases'
import { renderOverview } from './reactView'
import Cache, { CacheConfig, PlatformInfo } from './cache'

interface RouteRequest extends IncomingMessage {
  params?: { [key: string]: string }
}

interface RouteHandlers {
  download: (req: RouteRequest, res: ServerResponse) => Promise<void>
  downloadPlatform: (req: RouteRequest, res: ServerResponse) => Promise<void>
  update: (req: RouteRequest, res: ServerResponse) => Promise<void>
  releases: (req: RouteRequest, res: ServerResponse) => Promise<void>
  overview: (req: RouteRequest, res: ServerResponse) => Promise<void>
}

export default function createRoutes({
  cache,
  config
}: {
  cache: Cache
  config: CacheConfig
}): RouteHandlers {
  const { loadCache } = cache
  const exports: RouteHandlers = {} as RouteHandlers
  const { token, url } = config
  const shouldProxyPrivateDownload =
    token && typeof token === 'string' && token.length > 0

  // Helpers
  const proxyPrivateDownload = (
    asset: PlatformInfo,
    req: RouteRequest,
    res: ServerResponse
  ): void => {
    const redirect: 'manual' | 'follow' | 'error' = 'manual'
    const headers = { Accept: 'application/octet-stream' }
    const options = { headers, redirect }
    const { api_url: rawUrl } = asset
    const finalUrl = rawUrl.replace(
      'https://api.github.com/',
      `https://${token}@api.github.com/`
    )

    fetch(finalUrl, options).then(assetRes => {
      res.setHeader('Location', assetRes.headers.get('Location') || '')
      send(res, 302)
    })
  }

  exports.download = async (
    req: RouteRequest,
    res: ServerResponse
  ): Promise<void> => {
    const userAgent = parse(req.headers['user-agent'] || '')
    const params = urlHelpers.parse(req.url || '', true).query
    const isUpdate = params && params.update

    let platform: string | undefined

    if (userAgent.isMac && isUpdate) {
      platform = 'darwin'
    } else if (userAgent.isMac && !isUpdate) {
      platform = 'dmg'
    } else if (userAgent.isWindows) {
      platform = 'exe'
    }

    // Get the latest version from the cache
    const { platforms } = (await loadCache())['stable']

    if (!platform || !platforms || !platforms[platform]) {
      send(res, 404, 'No download available for your platform!')
      return
    }

    if (shouldProxyPrivateDownload) {
      proxyPrivateDownload(platforms[platform], req, res)
      return
    }

    res.writeHead(302, {
      Location: platforms[platform].url
    })

    res.end()
  }

  exports.downloadPlatform = async (
    req: RouteRequest,
    res: ServerResponse
  ): Promise<void> => {
    const params = urlHelpers.parse(req.url || '', true).query
    const isUpdate = params && params.update

    let platform = req.params && req.params.platform
    const release_channel =
      (req.params && req.params.release_channel) || 'stable'

    if (!platform) {
      send(res, 500, 'Platform parameter is missing')
      return
    }

    if (platform === 'mac' && !isUpdate) {
      platform = 'dmg'
    }

    if (platform === 'mac_arm64' && !isUpdate) {
      platform = 'dmg_arm64'
    }

    // Get the latest version from the cache
    const latest = await loadCache()

    // Check platform for appropiate aliases
    const resolvedPlatform = checkAlias(platform)

    if (!resolvedPlatform) {
      send(res, 500, 'The specified platform is not valid')
      return
    }

    const release = latest[release_channel]

    if (!release.platforms || !release.platforms[resolvedPlatform]) {
      send(res, 404, 'No download available for your platform')
      return
    }

    if (token && typeof token === 'string' && token.length > 0) {
      proxyPrivateDownload(release.platforms[resolvedPlatform], req, res)
      return
    }

    res.writeHead(302, {
      Location: release.platforms[resolvedPlatform].url
    })

    res.end()
  }

  exports.update = async (
    req: RouteRequest,
    res: ServerResponse
  ): Promise<void> => {
    const platformName = req.params && req.params.platform
    const version = req.params && req.params.version
    const release_channel =
      (req.params && req.params.release_channel) || 'stable'

    if (!platformName || !version) {
      send(res, 500, 'Platform and version parameters are required')
      return
    }

    if (!valid(version)) {
      send(res, 500, {
        error: 'version_invalid',
        message: 'The specified version is not SemVer-compatible'
      })

      return
    }

    const platform = checkAlias(platformName)

    if (!platform) {
      send(res, 500, {
        error: 'invalid_platform',
        message: 'The specified platform is not valid'
      })

      return
    }

    // Get the latest version from the cache
    const latest = (await loadCache())[release_channel]

    if (!latest.platforms || !latest.platforms[platform]) {
      res.statusCode = 204
      res.end()

      return
    }

    // Previously, we were checking if the latest version is
    // greater than the one on the client. However, we
    // only need to compare if they're different (even if
    // lower) in order to trigger an update.

    // This allows developers to downgrade their users
    // to a lower version in the case that a major bug happens
    // that will take a long time to fix and release
    // a patch update.

    if (compare(latest.version, version) !== 0) {
      const { notes, pub_date } = latest

      send(res, 200, {
        name: latest.version,
        notes,
        pub_date,
        url: shouldProxyPrivateDownload
          ? `${url}/download/${platformName}?update=true`
          : latest.platforms[platform].url
      })

      return
    }

    res.statusCode = 204
    res.end()
  }

  exports.releases = async (
    req: RouteRequest,
    res: ServerResponse
  ): Promise<void> => {
    // Get the latest version from the cache
    const latest = (await loadCache())['stable']

    if (!latest.files || !latest.files.RELEASES) {
      res.statusCode = 204
      res.end()

      return
    }

    const content = latest.files.RELEASES

    res.writeHead(200, {
      'content-length': Buffer.byteLength(content, 'utf8'),
      'content-type': 'application/octet-stream'
    })

    res.end(content)
  }

  exports.overview = async (
    req: RouteRequest,
    res: ServerResponse
  ): Promise<void> => {
    const cache = await loadCache()

    try {
      const releaseChannels: { [channel: string]: any } = {}
      
      for (const [channel, data] of Object.entries(cache)) {
        if (data && data.platforms) {
          releaseChannels[channel] = {
            date: distanceInWordsToNow(data.pub_date, { addSuffix: true }),
            files: data.platforms,
            version: data.version,
            releaseNotes: `https://github.com/${config.account}/${
              config.repository
            }/releases/tag/${data.version}`
          }
        }
      }

      const details = {
        account: config.account,
        repository: config.repository,
        releaseChannels,
        allReleases: `https://github.com/${config.account}/${
          config.repository
        }/releases`,
        github: `https://github.com/${config.account}/${config.repository}`
      }

      const html = await renderOverview(details)
      res.setHeader('Content-Type', 'text/html')
      send(res, 200, html)
    } catch (err) {
      console.error(err)
      send(res, 500, 'Error rendering overview page')
    }
  }

  return exports
}
