import createServer from './index'
import { CacheConfig } from './cache'

const {
  INTERVAL: intervalStr,
  ACCOUNT: account,
  REPOSITORY: repository,
  PRE: pre,
  TOKEN: token,
  URL: PRIVATE_BASE_URL,
  VERCEL_URL
} = process.env

const url = VERCEL_URL || PRIVATE_BASE_URL
const interval = intervalStr ? parseInt(intervalStr, 10) : undefined

const config: CacheConfig = {
  interval,
  account: account || '',
  repository: repository || '',
  pre,
  token,
  url
}

export default createServer(config)
