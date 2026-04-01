'use server'

import cloudinary from '@/lib/cloudinary'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { ActionResponse } from '@/interfaces'

export async function uploadFile(formData: FormData): Promise<ActionResponse> {
    let tempFilePath = null
    try {
        const file = formData.get('file') as File;
        if (!file || typeof file === 'string') {
            throw new Error('No file uploaded or invalid file format')
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const uploadDir = join(process.cwd(), 'public', 'temp_uploads')
        await mkdir(uploadDir, { recursive: true })
        const fileName = `${uuidv4()}-${file.name}`
        tempFilePath = join(uploadDir, fileName)
        await writeFile(tempFilePath, buffer)
        
        const result = await cloudinary.uploader.upload(tempFilePath, { folder: 'sportsbook', })
        return {
            success: true,
            data: { id: result.public_id, name: file.name, url: result.secure_url }
        }
    }
    catch (error: any) {
        console.error('Cloudinary upload error:', error)
        return { success: false, error: error.message || 'Failed to upload file' }
    }
    finally {
        if (tempFilePath) {
            try { await unlink(tempFilePath) }
            catch (err) { console.error('Failed to delete temporary file:', err) }
        }
    }
}

export async function getFilePreview(path: string): Promise<ActionResponse<string>> {
    try {
        if (!path) {
            return { success: true, data: '/sblogo.png' }
        }
        if (path.startsWith('http')) {
            return { success: true, data: path }
        }
        return { success: true, data: `/uploads/${path}` }
    } catch (error: any) {
        console.error('Error getting file preview:', error)
        return { success: false, error: error.message || 'Failed to get file preview' }
    }
}
