import { getImages } from '../../utils/db'

export default defineEventHandler(async () => {
  return getImages()
})
