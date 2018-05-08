import { Wrapper as ALI_OSS_SDK } from 'ali-oss-slim'

import { ACCESS_TYPE } from './type'

const connectOssBucket = async ({ accessKeyId, accessKeySecret, region, bucket, showLog = false }) => {
  let ossService

  try { ossService = ALI_OSS_SDK({ accessKeyId, accessKeySecret, bucket, region }) } catch (error) {
    showLog && console.warn(error)
    throw new Error(`[connectOssBucket] failed to load ALI_OSS_SDK. region: ${region}, bucket: ${bucket}`)
  }

  const { bucketList } = await getOssBucketList(ossService)
  if (!bucketList.find(({ name }) => name === bucket)) throw new Error(`[connectOssBucket] bucket not found with name: ${bucket}`)
  showLog && console.log(`[connectOssBucket] selected region: ${region}, bucket: ${bucket}`)

  const getBufferList = async (keyPrefix, maxKey) => {
    const { objectList: bufferList } = await getOssObjectList(ossService, keyPrefix, maxKey)
    __DEV__ && console.log(`[getBufferList] downloaded buffer list. length: ${bufferList.length}`)
    return { bufferList } // [ {  key, eTag, size, lastModified } ]
  }
  const getBuffer = async (key) => {
    const { buffer, eTag } = await getOssObject(ossService, key)
    __DEV__ && console.log(`[getBuffer] downloaded buffer. eTag: ${eTag}`)
    return { key, buffer }
  }
  const putBuffer = async (key, buffer, accessType) => {
    const { eTag } = await putOssObject(ossService, key, buffer, accessType)
    __DEV__ && console.log(`[putBuffer] uploaded buffer. eTag: ${eTag}`)
    return { key, eTag }
  }
  const copyBuffer = async (key, sourceInfo, accessType) => {
    const { copyObjectETag } = await copyOssObject(ossService, key, bucket, sourceInfo.key, accessType)
    __DEV__ && console.log(`[copyBuffer] copied buffer. copyObjectETag: ${copyObjectETag}`)
  }
  const deleteBuffer = async (key) => {
    await deleteOssObject(ossService, key)
    __DEV__ && console.log(`[deleteBuffer] deleted buffer`)
  }
  const deleteBufferList = async (keyList) => {
    const { errorList } = await deleteOssObjectList(ossService, keyList)
    __DEV__ && console.log(`[deleteBufferList] deleted buffer list, length of errorList: ${errorList.length}`)
    return { errorList }
  }

  return {
    getBufferList,
    getBuffer,
    putBuffer,
    copyBuffer,
    deleteBuffer,
    deleteBufferList
  }
}

// check: https://github.com/ali-sdk/ali-oss#oss-usage
const getOssBucketList = (ossService) => ossService.listBuckets()
  .then((result) => {
    __DEV__ && console.log('[getOssBucketList]', result)
    const { buckets: bucketList } = result
    return { bucketList }
  })
const getOssObjectList = (ossService, keyPrefix = '', maxKey = 512) => ossService.list({ prefix: keyPrefix, 'max-keys': maxKey })
  .then((result) => {
    __DEV__ && console.log('[getOssObjectList]', result)
    const { objects: listObjectList = [] } = result // [ { name, size, lastmodified, etag } ]
    return { objectList: listObjectList.map((v) => ({ key: v.name, eTag: v.etag, size: v.size, lastModified: v.lastModified })) }
  })
const getOssObject = (ossService, key) => ossService.get(key)
  .then((result) => {
    __DEV__ && console.log('[getOssObject]', result)
    const { content: buffer, res: { headers: { etag: eTag } } } = result
    return { buffer, eTag }
  })
const putOssObject = (ossService, key, buffer, accessType = ACCESS_TYPE.PRIVATE) => ossService.put(key, buffer)
  .then((result) => {
    __DEV__ && console.log('[putOssObject] put', result)
    const { res: { headers: { etag: eTag } } } = result
    return ossService.putACL(key, accessType).then((result) => {
      __DEV__ && console.log('[putOssObject] putACL', result)
      return { eTag }
    })
  })
const copyOssObject = (ossService, key, sourceBucketName, sourceKey, accessType = ACCESS_TYPE.PRIVATE) => ossService.copy(key, `/${sourceBucketName}/${sourceKey}`)
  .then((result) => {
    __DEV__ && console.log('[copyOssObject] copy', result)
    const { data: { etag: copyObjectETag } } = result
    return ossService.putACL(key, accessType).then((result) => {
      __DEV__ && console.log('[copyOssObject] putACL', result)
      return { copyObjectETag }
    })
  })
const deleteOssObject = (ossService, key) => ossService.delete(key)
  .then((result) => {
    __DEV__ && console.log('[deleteOssObject]', result)
    return {}
  })

const deleteOssObjectList = (ossService, keyList) => ossService.deleteMulti(keyList)
  .then((result) => {
    __DEV__ && console.log('[deleteOssObjectList]', result)
    const { deleted: deletedList = [] } = result
    return {
      errorList: keyList
        .filter((key) => !deletedList.includes(key))
        .map((key) => ({ key }))
    }
  })

export { connectOssBucket }
