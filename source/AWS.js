import AWS_SDK from 'aws-sdk/global'
import AWS_SDK_S3 from 'aws-sdk/clients/s3'

import { ACCESS_TYPE } from './type'

const connectAwsBucket = async ({ accessKeyId, secretAccessKey, region, bucket, showLog = false }) => {
  let s3Service

  try {
    AWS_SDK.config.update({ accessKeyId, secretAccessKey, region })
    s3Service = new AWS_SDK_S3()
  } catch (error) {
    showLog && console.warn(error)
    throw new Error(`[connectAwsBucket] failed to load AWS_SDK_S3. region: ${region}, bucket: ${bucket}`)
  }

  const { bucketList } = await getS3BucketList(s3Service)
  if (!bucketList.find(({ Name }) => Name === bucket)) throw new Error(`[connectAwsBucket] bucket not found with name: ${bucket}`)
  showLog && console.log(`[connectAwsBucket] selected region: ${region}, bucket: ${bucket}`)

  const getBufferList = async (keyPrefix) => {
    const { objectList: bufferList } = await getS3ObjectList(s3Service, bucket, keyPrefix)
    __DEV__ && console.log(`[getBufferList] downloaded buffer list. length: ${bufferList.length}`)
    return { bufferList } // [ {  key, eTag, size, lastModified } ]
  }
  const getBuffer = async (key) => {
    const { buffer, eTag } = await getS3Object(s3Service, bucket, key)
    __DEV__ && console.log(`[getBuffer] downloaded buffer. eTag: ${eTag}`)
    return { key, buffer }
  }
  const putBuffer = async (key, buffer, accessType) => {
    const { eTag } = await putS3Object(s3Service, bucket, key, buffer, accessType)
    __DEV__ && console.log(`[putBuffer] uploaded buffer. eTag: ${eTag}`)
    return { key, eTag }
  }
  const copyBuffer = async (key, sourceInfo, accessType) => {
    const { copyObjectETag } = await copyS3Object(s3Service, bucket, key, bucket, sourceInfo.key, accessType)
    __DEV__ && console.log(`[copyBuffer] copied buffer. copyObjectETag: ${copyObjectETag}`)
  }
  const deleteBuffer = async (key) => {
    await deleteS3Object(s3Service, bucket, key)
    __DEV__ && console.log(`[deleteBuffer] deleted buffer`)
  }
  const deleteBufferList = async (keyList) => {
    const { errorList } = await deleteS3ObjectList(s3Service, bucket, keyList)
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

// check: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
const getS3BucketList = (s3Service) => new Promise((resolve, reject) => s3Service.listBuckets(
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[getS3BucketList]', result)
    const { Buckets: bucketList, Owner: ownerMap } = result
    resolve({ bucketList, ownerMap })
  }
))
const getS3ObjectList = (s3Service, bucketName, keyPrefix = '') => new Promise((resolve, reject) => s3Service.listObjects(
  { Bucket: bucketName, MaxKeys: 512, Prefix: keyPrefix },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[getS3ObjectList]', result)
    const { Contents: listObjectList } = result // [ { Key, Size, LastModified, ETag } ]
    resolve({ objectList: listObjectList.map((v) => ({ key: v.Key, eTag: v.ETag, size: v.Size, lastModified: v.LastModified })) })
  }
))
const getS3Object = (s3Service, bucketName, key) => new Promise((resolve, reject) => s3Service.getObject(
  { Bucket: bucketName, Key: key },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[getS3Object]', result)
    const { Body: body, ETag: eTag } = result
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
    resolve({ buffer, eTag })
  }
))
const putS3Object = (s3Service, bucketName, key, buffer, accessType = ACCESS_TYPE.PRIVATE) => new Promise((resolve, reject) => s3Service.putObject(
  { Bucket: bucketName, Key: key, Body: buffer, ACL: accessType },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[putS3Object]', result)
    const { ETag: eTag } = result
    resolve({ eTag })
  }
))
const copyS3Object = (s3Service, bucketName, key, sourceBucketName, sourceKey, accessType = ACCESS_TYPE.PRIVATE) => new Promise((resolve, reject) => s3Service.copyObject(
  { Bucket: bucketName, Key: key, CopySource: `/${sourceBucketName}/${sourceKey}`, ACL: accessType },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[copyS3Object]', result)
    const { CopyObjectResult: { ETag: copyObjectETag } } = result
    resolve({ copyObjectETag })
  }
))
const deleteS3Object = (s3Service, bucketName, key) => new Promise((resolve, reject) => s3Service.deleteObject(
  { Bucket: bucketName, Key: key },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[deleteS3Object]', result)
    resolve({})
  }
))
const deleteS3ObjectList = (s3Service, bucketName, keyList) => new Promise((resolve, reject) => s3Service.deleteObjects(
  { Bucket: bucketName, Delete: { Objects: keyList.map((v) => ({ Key: v })), Quiet: true } },
  (error, result) => {
    if (error) return reject(error)
    // __DEV__ && console.log('[deleteS3ObjectList]', result)
    const { Errors: deleteErrorList } = result
    resolve({ errorList: deleteErrorList.map((v) => ({ key: v.Key, code: v.Code, message: v.Message })) })
  }
))

export { connectAwsBucket }
