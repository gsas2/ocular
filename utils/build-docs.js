const { existsSync, lstatSync, readdirSync, readFileSync } = require('fs')
const { basename, extname, resolve } = require('path')
const { camel, sentence } = require('to-case')

function listDocs(docsSrcPath) {
  const absoluteDocsSrcPath = `${resolve(docsSrcPath)}/`
  const queue = readdirSync(absoluteDocsSrcPath).map(fileName => ({
    fileName,
    path: []
  }))
  const docs = []
  while (queue.length) {
    const { fileName, path } = queue.pop()
    const fullPath = [absoluteDocsSrcPath]
      .concat(path)
      .concat(fileName)
      .join('/')
      .replace('//', '/')

    const componentPath = path
      .slice(1)
      .concat(fileName)
      .join('/')
    if (lstatSync(fullPath).isDirectory() === false) {
      if (extname(fileName) === '.md') {
        const docBaseNameFromFileName = basename(fileName, '.md')
        const docContents = readFileSync(fullPath, 'UTF-8')
        const docFirstLine = docContents && docContents.split('\n')[0]
        const docTitleFromContent =
          docFirstLine.startsWith('#') && docFirstLine.replace(/^#+\s*/, '')

        const docBaseName = docTitleFromContent || docBaseNameFromFileName

        const componentName = `_${camel(path.concat(docBaseName).join('-'))}`

        docs.push({
          docBaseName,
          fileName,
          componentPath,
          componentName,
          fullPath,
          path
        })
      }
      // ignore non .md files
    } else {
      const newPath = path.concat(fileName)
      const newFullPath = [absoluteDocsSrcPath].concat(newPath).join('/')
      readdirSync(newFullPath).forEach(f => {
        queue.push({ fileName: f, path: newPath })
      })
    }
  }
  return docs
}

function buildMdRoutes(docs) {
  const result = {
    name: 'Documentation',
    path: '/documentation',
    data: []
  }
  const output = []
  docs
    .sort((a, b) => (a.fullPath > b.fullPath ? 1 : -1))
    .forEach(({ docBaseName, fileName, componentName, componentPath, path }) => {
      const imp = `import ${componentName} from '${componentPath}'`
      output.push(imp)

      const pathSuffix = path.slice(2)
      let destination = result.data
      let currentPath = '/docs'

      pathSuffix.forEach(p => {
        const size = destination.length
        currentPath = `${currentPath}/${p}`

        const name = existsSync(`src/${currentPath}/TITLE`)
          ? readFileSync(`src/${currentPath}/TITLE`, 'UTF-8')
          : sentence(p)

        let nextLevelIdx = destination.findIndex(d => d.fullPath === currentPath)
        if (nextLevelIdx === -1) {
          destination.push({
            name,
            path: p,
            fullPath: currentPath,
            children: []
          })
          nextLevelIdx = size
        }
        destination = destination[nextLevelIdx].children
      })

      destination.push({
        fileLocation: `/src${currentPath}/${fileName}`,
        name: sentence(docBaseName),
        markdown: componentName
      })
    })

  const stringifiedResult = JSON.stringify(result, null, 2)
    .replace(/ *"fullPath".*\n/g, '')
    .replace(/("(children|data|fileLocation|name|path)")/g, '$2')
    .replace(/"markdown": "([^"]+)"/g, 'markdown: $1')

  output.push('')
  output.push(`export default [${stringifiedResult}];`)
  output.push('')

  return output.join('\n')
}

module.exports = {
  buildMdRoutes,
  listDocs
}
