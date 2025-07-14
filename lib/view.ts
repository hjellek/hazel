// Native
import * as path from 'path'
import * as fs from 'fs'
import { promisify } from 'util'

// Packages
import { compile, TemplateDelegate } from 'handlebars'

export default async function prepareView(): Promise<TemplateDelegate> {
  const viewPath = path.normalize(path.join(__dirname, '/../views/index.hbs'))
  const viewContent = await promisify(fs.readFile)(viewPath, 'utf8')

  return compile(viewContent)
}
