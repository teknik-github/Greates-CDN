import { getFiles } from '../../utils/db'

export default defineEventHandler(async () => {
  return getFiles()
})
