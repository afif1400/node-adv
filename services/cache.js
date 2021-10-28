const mongoose = require('mongoose')
const redis = require('redis')
const util = require('util')

const redisUrl = 'redis-14896.c264.ap-south-1-1.ec2.cloud.redislabs.com'
const client = redis.createClient(14896, redisUrl);
client.auth('4lnkPnuTdzq8LuDMTZSR1SyO7mcHxIPm', () => {
  console.log('connected to redis')
})
client.hget = util.promisify(client.hget)

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true
  this.hashKey = JSON.stringify(options.key || 'hash')
  return this
}

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.exec = async function () {

  if (!this.useCache) {
    return exec.apply(this, arguments)
  }

  const key = JSON.stringify(Object.assign({}, this.getQuery(), {
    collection: this.mongooseCollection.name
  }))

  //* See if we have a value for key in redis
  const cacheValue = await client.hget(this.hashKey, key);

  //* If we do, return that
  if (cacheValue) {
    const doc = JSON.parse(cacheValue)

    return Array.isArray(doc) ? doc.map((d) => new this.model(d)) : new this.model(doc)

  }

  //* Else, issue query and store the result in redis
  const result = await exec.apply(this, arguments)
  client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10
  )
  return result;
}

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey))
  }
}