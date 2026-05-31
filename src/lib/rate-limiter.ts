import { RateLimitResult } from '../interfaces/index';
import redis from "./redis";

export async function slidingWindowRateLimiter(input: { identifier: string, limit: number, windowsMs: number }): Promise<RateLimitResult> {
    const { identifier, limit, windowsMs } = input;
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const uniqueId = `${now}-${Math.random()}`;
    const luaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local uniqueId = ARGV[4]
        
        local windowStart = now - window
        
        -- 1. Remove expired entries
        redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
        
        -- 2. Get current request count
        local currentCount = redis.call('ZCARD', key)
        
        if currentCount < limit then
            -- 3. Add current request
            redis.call('ZADD', key, now, uniqueId)
            -- 4. Refresh expiry
            redis.call('EXPIRE', key, math.ceil(window / 1000))
            return {1, limit - currentCount - 1}
        else
            return {0, 0}
        end
    `;

    try {
        const [success, remaining] = await redis.eval(luaScript, [key], [now, windowsMs, limit, uniqueId]) as [number, number];

        return {
            success: success === 1,
            limit: limit,
            remaining: remaining,
            reset: now + windowsMs
        };
    } catch (error) {
        console.error("Rate Limiter Redis Error:", error);
        return {
            success: false,
            limit: limit,
            remaining: 0,
            reset: now + windowsMs
        };
    }
}
