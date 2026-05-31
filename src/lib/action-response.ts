import type { ActionResponse } from '@/types/interfaces'

export function ok<T>(data: T): ActionResponse<T> {
    return { success: true, data }
}

export function fail(error: unknown, fallback = 'Request failed'): ActionResponse<never> {
    const message = error instanceof Error && error.message ? error.message : fallback
    return { success: false, error: message }
}
