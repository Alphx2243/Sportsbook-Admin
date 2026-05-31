import { Redis } from '@upstash/redis/cloudflare'
const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

if (!redisUrl || !redisToken) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured.')
}

const redis = new Redis({
    url: redisUrl,
    token: redisToken
})
export default redis;
