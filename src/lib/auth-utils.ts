import { getCurrentUser } from '@/actions/auth';

export async function ensureAdmin() {
    const res = await getCurrentUser();
    if (!res.success || !res.data || res.data.role !== 'Admin') {
        throw new Error('Unauthorized: Administrative access required.');
    }
    return res.data;
}
