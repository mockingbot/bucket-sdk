import TC_SDK from 'cos-nodejs-sdk-slim' // TenCent Cloud

import { ACCESS_TYPE } from './type'

const connectTcBucket = async ({ appId, secretId, secretKey, region, bucket, showLog = false }) => {
  let tcService
  const bucketName = `${bucket}-${appId}`

  try {
    tcService = new TC_SDK({ SecretId: secretId, SecretKey: secretKey })
  } catch (error) {
    showLog && console.warn(error)
    throw new Error(`[connectTcBucket] failed to load TC_SDK. region: ${region}, bucket: ${bucket}`)
  }

  const { isExist, isAuth } = await checkTcBucket(tcService, region, bucketName)
  if (!isExist || !isAuth) throw new Error(`[connectTcBucket] bucket not found with name: ${bucket} (isExist: ${isExist}, isAuth: ${isAuth})`)
  showLog && console.log(`[connectTcBucket] selected region: ${region}, bucket: ${bucket}`)

  const getBufferList = async (keyPrefix, maxKey) => {
    const { objectList: bufferList } = await getTcObjectList(tcService, region, bucketName, keyPrefix, maxKey)
    __DEV__ && console.log(`[getBufferList] downloaded buffer list. length: ${bufferList.length}`)
    return { bufferList }
  }
  const getBuffer = async (key) => {
    const { buffer } = await getTcObject(tcService, region, bucketName, key)
    __DEV__ && console.log(`[getBuffer] downloaded buffer.`)
    return { key, buffer }
  }
  const putBuffer = async (key, buffer, accessType) => {
    const { eTag, url } = await putTcObject(tcService, region, bucketName, key, buffer, accessType)
    __DEV__ && console.log(`[putBuffer] uploaded buffer. eTag: ${eTag}, url: ${url}`)
    return { key, eTag, url } // return `url` for `copyBuffer`
  }
  const copyBuffer = async (key, sourceInfo, accessType) => {
    const sourceObjectUrl = sourceInfo.url.replace(/^\w+:\/\//, '') // TODO: STRANGE: must remove protocol
    const { copyObjectETag } = await copyTcObject(tcService, region, bucketName, key, sourceObjectUrl, accessType)
    __DEV__ && console.log(`[copyBuffer] copied buffer. copyObjectETag: ${copyObjectETag}, sourceObjectUrl: ${sourceObjectUrl}`)
  }
  const deleteBuffer = async (key) => {
    const { statusCode } = await deleteTcObject(tcService, region, bucketName, key)
    __DEV__ && console.log(`[deleteBuffer] deleted buffer, statusCode: ${statusCode}`)
  }

  const deleteBufferList = async (keyList) => {
    const { errorList } = await deleteTcObjectList(tcService, region, bucketName, keyList)
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

// check: https://cloud.tencent.com/document/product/436/12264
const checkTcBucket = (tcService, region, bucketName) => new Promise((resolve, reject) => tcService.headBucket(
  { Region: region, Bucket: bucketName },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[checkTcBucket]', result)
    const { statusCode } = result
    resolve({ isExist: statusCode !== 404, isAuth: statusCode !== 403 })
  }
))
const getTcObjectList = (tcService, region, bucketName, keyPrefix = '', maxKey = 512) => new Promise((resolve, reject) => tcService.getBucket(
  { Region: region, Bucket: bucketName, Prefix: keyPrefix, MaxKeys: String(maxKey) },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[getTcObjectList]', result)
    const { Contents: listObjectList } = result // [ { Key, Size, LastModified, ETag, Owner, StorageClass } ]
    resolve({ objectList: listObjectList.map((v) => ({ key: v.Key, eTag: v.ETag, size: v.Size, lastModified: v.LastModified })) })
  }
))
const getTcObject = (tcService, region, bucketName, key) => new Promise((resolve, reject) => tcService.getObject(
  { Region: region, Bucket: bucketName, Key: key },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[getTcObject]', result)
    const { Body: body } = result
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body) // body might be Buffer, according to Doc: (Buffer, Typed Array, Blob, String, ReadableStream) Object data
    resolve({ buffer })
  }
))
const putTcObject = (tcService, region, bucketName, key, buffer, accessType = ACCESS_TYPE.PRIVATE) => new Promise((resolve, reject) => {
  if (accessType !== undefined) console.warn(`[WARN][putTcObject] dropped object accessType: ${accessType} (due to TC single Bucket 999 ACL count limit)`)
  return tcService.putObject(
    { Region: region, Bucket: bucketName, Key: key, Body: buffer }, // ACL: accessType
    (error, result) => {
      if (error) return reject(error)
      // __DEV__ && console.log('[putTcObject]', result)
      const { ETag: eTag, Location: url } = result
      resolve({ eTag, url })
    }
  )
})
const copyTcObject = (tcService, region, bucketName, key, sourceObjectUrl, accessType = ACCESS_TYPE.PRIVATE) => new Promise((resolve, reject) => {
  if (accessType !== undefined) console.warn(`[WARN][copyTcObject] dropped object accessType: ${accessType} (due to TC single Bucket 999 ACL count limit)`)
  return tcService.putObjectCopy(
    { Region: region, Bucket: bucketName, Key: key, CopySource: sourceObjectUrl }, // ACL: accessType
    (error, result) => {
      if (error) return reject(error)
      // __DEV__ && console.log('[copyTcObject]', result)
      const { ETag: copyObjectETag } = result
      resolve({ copyObjectETag })
    }
  )
})
const deleteTcObject = (tcService, region, bucketName, key) => new Promise((resolve, reject) => tcService.deleteObject(
  { Region: region, Bucket: bucketName, Key: key },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[deleteTcObject]', result)
    const { statusCode } = result
    resolve({ statusCode })
  }
))

const deleteTcObjectList = (tcService, region, bucketName, keyList) => new Promise((resolve, reject) => tcService.deleteMultipleObject(
  { Region: region, Bucket: bucketName, Objects: keyList.map((v) => ({ Key: v })), Quiet: true },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[deleteTcObjectList]', result)
    const { Error: deleteErrorList } = result
    resolve({ errorList: deleteErrorList.map((v) => ({ key: v.Key, code: v.Code, message: v.Message })) })
  }
))

export { connectTcBucket }
