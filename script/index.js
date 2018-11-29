import { resolve } from 'path'
import { execSync } from 'child_process'

import { getScriptFileListFromPathList } from 'dr-dev/module/node/fileList'
import { argvFlag, runMain } from 'dr-dev/module/main'
import { initOutput, packOutput, publishOutput } from 'dr-dev/module/output'
import { getTerserOption, minifyFileListWithTerser } from 'dr-dev/module/minify'

const PATH_ROOT = resolve(__dirname, '..')
const PATH_OUTPUT = resolve(__dirname, '../output-gitignore')
const fromRoot = (...args) => resolve(PATH_ROOT, ...args)
const fromOutput = (...args) => resolve(PATH_OUTPUT, ...args)
const execOptionRoot = { cwd: fromRoot(), stdio: argvFlag('quiet') ? [ 'ignore', 'ignore', 'inherit' ] : 'inherit', shell: true }

runMain(async (logger) => {
  const packageJSON = await initOutput({ fromRoot, fromOutput, logger })

  logger.padLog(`generate spec`)
  execSync('npm run script-generate-spec', execOptionRoot)
  if (!argvFlag('pack')) return

  logger.padLog(`build library`)
  execSync('npm run build-library', execOptionRoot)

  logger.padLog(`minify output`)
  const fileList = await getScriptFileListFromPathList([ '.' ], fromOutput)
  await minifyFileListWithTerser({ fileList, option: getTerserOption(), rootPath: PATH_OUTPUT, logger })
  await minifyFileListWithTerser({ fileList, option: getTerserOption(), rootPath: PATH_OUTPUT, logger }) // once more

  const pathPackagePack = await packOutput({ fromRoot, fromOutput, logger })
  await publishOutput({ flagList: process.argv, packageJSON, pathPackagePack, extraArgs: [ '--userconfig', '~/mockingbot.npmrc' ], logger })
})
