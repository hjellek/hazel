import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import OverviewPage from './components/OverviewPage'
import { PlatformInfo } from './cache'

const readFile = promisify(fs.readFile)

export interface ReleaseChannelData {
  date: string
  files: { [key: string]: PlatformInfo }
  version: string
  releaseNotes: string
}

export interface ViewData {
  account: string
  repository: string
  releaseChannels: { [channel: string]: ReleaseChannelData }
  allReleases: string
  github: string
}

export async function renderOverview(data: ViewData): Promise<string> {
  // Read the CSS file
  const cssPath = path.join(__dirname, 'components', 'overview.css')
  const cssContent = await readFile(cssPath, 'utf8')

  // Convert PlatformInfo to the format expected by the component for each release channel
  const transformedReleaseChannels = Object.entries(data.releaseChannels).reduce((acc, [channel, channelData]) => {
    const transformedFiles = Object.entries(channelData.files).reduce((fileAcc, [key, info]) => {
      fileAcc[key] = {
        url: info.url,
        size: String(info.size)
      }
      return fileAcc
    }, {} as { [key: string]: { url: string; size: string } })

    acc[channel] = {
      ...channelData,
      files: transformedFiles
    }
    return acc
  }, {} as { [channel: string]: any })

  const componentProps = {
    account: data.account,
    repository: data.repository,
    releaseChannels: transformedReleaseChannels,
    allReleases: data.allReleases,
    github: data.github,
    cssContent
  }

  const html = renderToStaticMarkup(React.createElement(OverviewPage, componentProps))
  return `<!DOCTYPE html>${html}`
}