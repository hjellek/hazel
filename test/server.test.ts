import micro from 'micro'
import listen from 'test-listen'

const initialEnv = Object.assign({}, process.env)

afterEach(() => {
  process.env = initialEnv
})

describe('Server', () => {
  it('Should start without errors', async () => {
    process.env = {
      ACCOUNT: 'zeit',
      REPOSITORY: 'hyper'
    }

    const run = await import('../lib/server')
    const server = micro(run.default)

    await listen(server)
    server.close()
  })
})
