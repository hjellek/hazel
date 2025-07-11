/* eslint-disable no-new */
/* global describe, it, expect */
import Cache from '../lib/cache'

describe('Cache', () => {
  it('should throw when account is not defined', () => {
    expect(() => {
      const config = { repository: 'hyper', account: '' }
      new Cache(config)
    }).toThrow(/ACCOUNT/)
  })

  it('should throw when repository is not defined', () => {
    expect(() => {
      const config = { account: 'zeit', repository: '' }
      new Cache(config)
    }).toThrow(/REPOSITORY/)
  })

  it('should throw when token is defined and url is not', () => {
    expect(() => {
      const config = { account: 'zeit', repository: 'hyper', token: 'abc' }
      new Cache(config)
    }).toThrow(/URL/)
  })

  it('should run without errors', () => {
    const config = {
      account: 'zeit',
      repository: 'hyper',
      token: process.env.TOKEN,
      url: process.env.URL,
      release_channels: ['stable']
    }

    new Cache(config)
  })

  it('should refresh the cache', async () => {
    const config = {
      account: 'zeit',
      repository: 'hyper',
      token: process.env.TOKEN,
      url: process.env.URL,
      release_channels: ['stable']
    }

    const cache = new Cache(config)
    const releaseChannels = await cache.loadCache()
    const stable = releaseChannels['stable']
    expect(typeof stable.version).toBe('string')
    expect(typeof stable.platforms).toBe('object')
  })

  it('should set platforms correctly', async () => {
    const config = {
      account: 'zeit',
      repository: 'hyper',
      token: process.env.TOKEN,
      url: process.env.URL
    }

    const cache = new Cache(config)
    const releaseChannels = await cache.loadCache()

    console.log(releaseChannels.stable.platforms.darwin)
  })
})
