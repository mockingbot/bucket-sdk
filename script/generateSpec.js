import { resolve } from 'path'
import { writeFileSync } from 'fs'

import { argvFlag, runMain } from 'dev-dep-tool/library/__utils__'
import { getLogger } from 'dev-dep-tool/library/logger'
import { createExportParser } from 'dev-dep-tool/library/ExportIndex/parseExport'
import { generateExportInfo } from 'dev-dep-tool/library/ExportIndex/generateInfo'
import { renderMarkdownExportPath } from 'dev-dep-tool/library/ExportIndex/renderMarkdown'

import { getDirectoryContent, walkDirectoryContent } from 'dr-js/module/node/file/Directory'

const PATH_ROOT = resolve(__dirname, '..')
const fromRoot = (...args) => resolve(PATH_ROOT, ...args)

const collectSourceRouteMap = async ({ logger }) => {
  const { parseExport, getSourceRouteMap } = createExportParser({ logger })
  const parseWalkExport = (path, name) => parseExport(resolve(path, name))
  await walkDirectoryContent(await getDirectoryContent(fromRoot('source')), parseWalkExport)
  return getSourceRouteMap()
}

runMain(async (logger) => {
  logger.padLog(`collect sourceRouteMap`)
  const sourceRouteMap = await collectSourceRouteMap({ logger })

  logger.padLog(`generate exportInfo`)
  const exportInfoMap = generateExportInfo({ sourceRouteMap })

  logger.log(`output: SPEC.md`)
  writeFileSync(fromRoot('SPEC.md'), [
    '# Specification',
    '',
    '* [Export Path](#export-path)',
    '',
    '#### Export Path',
    ...renderMarkdownExportPath({ exportInfoMap, rootPath: PATH_ROOT }),
    ''
  ].join('\n'))
}, getLogger('generate-spec', argvFlag('quiet')))
