import fetch from 'node-fetch'
import retry from 'async-retry'
import convertStream from 'stream-to-string'
import ms from 'ms'
import { prerelease } from 'semver'
import checkPlatform from './platform'

export type ReleaseChannels = { [key: string]: CacheData}

export interface CacheConfig {
  account: string
  repository: string
  token?: string
  url?: string
  interval?: number
  release_channels?: string[]
}

export interface PlatformInfo {
  name: string
  api_url: string
  url: string
  content_type: string
  size: number
}

export interface CacheData {
  version: string
  notes: string
  pub_date: string
  platforms: { [platform: string]: PlatformInfo }
  files?: { [fileName: string]: string }
}

export default class Cache {
  private config: CacheConfig
  private latest: { [key: string]: Partial<CacheData> | undefined }
  private lastUpdate: number | null

  constructor(config: CacheConfig) {
    const { account, repository, token, url } = config
    this.config = config

    if (!account || !repository) {
      const error = new Error('Neither ACCOUNT, nor REPOSITORY are defined')
      ;(error as any).code = 'missing_configuration_properties'
      throw error
    }

    if (token && !url) {
      const error = new Error(
        'Neither VERCEL_URL, nor URL are defined, which are mandatory for private repo mode'
      )
      ;(error as any).code = 'missing_configuration_properties'
      throw error
    }

    this.latest = {}
    this.lastUpdate = null

    this.cacheReleaseList = this.cacheReleaseList.bind(this)
    this.refreshCache = this.refreshCache.bind(this)
    this.loadCache = this.loadCache.bind(this)
    this.isOutdated = this.isOutdated.bind(this)
  }

  async cacheReleaseList(url: string): Promise<string> {
    const { token } = this.config
    const headers: { [key: string]: string } = {
      Accept: 'application/vnd.github.preview'
    }

    if (token && typeof token === 'string' && token.length > 0) {
      headers.Authorization = `token ${token}`
    }

    const { status, body } = await retry(
      async () => {
        const response = await fetch(url, { headers })

        if (response.status !== 200) {
          throw new Error(
            `Tried to cache RELEASES, but failed fetching ${url}, status ${
              response.status
            }`
          )
        }

        return response
      },
      { retries: 3 }
    )

    let content = await convertStream(body)
    const matches = content.match(/[^ ]*\.nupkg/gim)

    if (!matches || matches.length === 0) {
      throw new Error(
        `Tried to cache RELEASES, but failed. RELEASES content doesn't contain nupkg`
      )
    }

    for (let i = 0; i < matches.length; i += 1) {
      const nuPKG = url.replace('RELEASES', matches[i])
      content = content.replace(matches[i], nuPKG)
    }
    return content
  }

  async refreshCache(): Promise<void> {
    const { account, repository, release_channels = ['stable'], token } = this.config
    const repo = account + '/' + repository
    const url = `https://api.github.com/repos/${repo}/releases?per_page=100`
    const headers: { [key: string]: string } = {
      Accept: 'application/vnd.github.preview'
    }

    if (token && typeof token === 'string' && token.length > 0) {
      headers.Authorization = `token ${token}`
    }

    const response = await retry(
      async () => {
        const response = await fetch(url, { headers })

        if (response.status !== 200) {
          throw new Error(
            `GitHub API responded with ${response.status} for url ${url}`
          )
        }

        return response
      },
      { retries: 3 }
    )

    const data = await response.json()

    if (!Array.isArray(data) || data.length === 0) {
      return
    }

    const releases: {[key: string]: any } = {}
    release_channels.forEach((channel) => {
      releases[channel] = data.find((item: any) => {
        if (item.draft) {
          return;
        }
        if (channel === 'stable' && item.prerelease) {
          return;
        }
        const release_channel = this.getReleaseChannelFromTagName(item.tag_name)
        return release_channel === channel
      })
    })

    for (const [channel, release] of Object.entries(releases)) {
      if (!release || !release.assets || !Array.isArray(release.assets)) {
        return
      }
      const channelRelease: Partial<CacheData> = {};

      const {tag_name} = release

      if (this.latest[channel]?.version === tag_name) {
        console.log(`Cached version for ${channel} is the same as latest`)
        this.lastUpdate = Date.now()
        return
      }

      console.log(`Caching version ${tag_name}...`)

      channelRelease.version = tag_name
      channelRelease.notes = release.body
      channelRelease.pub_date = release.published_at

      // Clear list of download links
      channelRelease.platforms = {}

      for (const asset of release.assets) {
        const {name, browser_download_url, url, content_type, size} = asset

        if (name === 'RELEASES') {
          try {
            if (!channelRelease.files) {
              channelRelease.files = {}
            }
            channelRelease.files.RELEASES = await this.cacheReleaseList(
              browser_download_url
            )
          } catch (err) {
            console.error(err)
          }
          continue
        }

        const platform = checkPlatform(name)

        if (!platform) {
          continue
        }

        channelRelease.platforms[platform] = {
          name,
          api_url: url,
          url: browser_download_url,
          content_type,
          size: Math.round(size / 1000000 * 10) / 10
        }
        this.latest[channel] = channelRelease
      }

      console.log(`Finished caching version ${tag_name} for release_channel ${channel}`)
    }

    this.lastUpdate = Date.now()
  }

  isOutdated(): boolean {
    const { lastUpdate, config } = this
    const { interval = 15 } = config

    if (lastUpdate && Date.now() - lastUpdate > ms(`${interval}m`)) {
      return true
    }

    return false
  }

  // This is a method returning the cache
  // because the cache would otherwise be loaded
  // only once when the index file is parsed
  async loadCache(): Promise<ReleaseChannels> {
    const { latest, refreshCache, isOutdated, lastUpdate } = this

    if (!lastUpdate || isOutdated()) {
      await refreshCache()
    }

    return Object.assign({}, latest) as ReleaseChannels
  }

  private getReleaseChannelFromTagName(tag: string) {
    const prereleaseComponents = prerelease(tag)
    if (!prereleaseComponents || prereleaseComponents.length === 0) {
      return 'stable'
    }

    return prereleaseComponents[0];
  }
}
