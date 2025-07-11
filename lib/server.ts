import createServer from './index'
import { CacheConfig } from './cache'

const {
  INTERVAL: intervalStr,
  ACCOUNT: account,
  REPOSITORY: repository,
  RELEASE_CHANNELS,
  TOKEN: token,
  URL: PRIVATE_BASE_URL,
  VERCEL_URL
} = process.env

const url = VERCEL_URL || PRIVATE_BASE_URL
const interval = intervalStr ? parseInt(intervalStr, 10) : undefined
const release_channels = RELEASE_CHANNELS
  ? RELEASE_CHANNELS.split(',').map(channel => channel.trim())
  : ['stable']

const config: CacheConfig = {
  interval,
  account: account || '',
  repository: repository || '',
  release_channels: release_channels,
  token,
  url
}

export default createServer(config)
