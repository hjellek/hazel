import React from 'react'

interface FileInfo {
  url: string
  size: string
}

interface ReleaseChannelData {
  date: string
  files: { [key: string]: FileInfo }
  version: string
  releaseNotes: string
}

interface OverviewPageProps {
  account: string
  repository: string
  releaseChannels: { [channel: string]: ReleaseChannelData }
  allReleases: string
  github: string
  cssContent: string
}

const OverviewPage: React.FC<OverviewPageProps> = ({
  account,
  repository,
  releaseChannels,
  allReleases,
  github,
  cssContent
}) => {
  console.log(account, repository);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${account}/${repository}`}</title>
        <style dangerouslySetInnerHTML={{ __html: cssContent }} />
      </head>
      <body>
        <div id="wrap">
          <main>
            <header>
              <div id="release">
                {account}/<span id="repo">{repository}</span>
              </div>
            </header>

            {Object.entries(releaseChannels).map(([channel, data]) => (
              <div key={channel} className="release-channel">
                <div className="channel-header">
                  <div className="channel-name">{channel}</div>
                  <div className="channel-date">{data.date}</div>
                </div>

                <div className="channel-list">
                  {Object.entries(data.files).map(([key, file]) => (
                    <div key={key} className="item">
                      <div className="fileType">
                        {key}: <span className="url">
                          <a href={file.url}>/{channel}/{key}</a>
                        </span>
                      </div>
                      <div className="size">{file.size} MB</div>
                    </div>
                  ))}
                </div>

                <div className="channel-footer">
                  <div id="version">{data.version}</div>
                  <a className="release-notes" href={data.releaseNotes}>Release Notes</a>
                </div>
              </div>
            ))}

            <footer>
              <a id="all-releases" href={allReleases}>All Releases</a>
              <a href={github}>GitHub</a>
            </footer>
          </main>
        </div>
      </body>
    </html>
  )
}

export default OverviewPage
