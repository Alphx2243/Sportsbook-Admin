'use server'

import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { ActionResponse } from '@/types/interfaces'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'supersecretkey123')


export async function createAccount(): Promise<ActionResponse> {
    return { 
        success: false, 
        error: 'Registration is disabled for the Admin Portal. Please use the main application for user registration.' 
    }
}

export async function login({ email, password }: { email: string; password: string }): Promise<ActionResponse> {
    try {
        const user = await prisma.user.findUnique({ where: { email }, })
        if (!user) {
            throw new Error('Invalid email or password.')
        }

        
        if (user.role !== 'Admin') {
            throw new Error('Access denied. This portal is restricted to administrators.')
        }

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
            throw new Error('Invalid email or password.')
        }
        await createSession(user)
        return { success: true, data: user }
    }
    catch (error: any) {
        console.error('Login error:', error)
        return { success: false, error: error.message || 'Failed to login' }
    }
}

export async function updateUser(userId: string, data: {
    name?: string;
    phone?: string;
    rollNumber?: string;
    sportsExperience?: string[];
}): Promise<ActionResponse> {
    try {
        const { name, phone, rollNumber, sportsExperience } = data;
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                name, phone,
                rollNumber, sportsExperience
            }
        });
        return { success: true, data: user };
    }
    catch (error: any) {
        console.error("Update user error:", error);
        return { success: false, error: error.message || 'Failed to update user' };
    }
}

export async function logout(): Promise<ActionResponse> {
    const cookieStore = await cookies()
    cookieStore.delete('session')
    return { success: true, data: null }
}

export async function getCurrentUser(): Promise<ActionResponse> {
    try {
        const cookieStore = await cookies()
        const session = cookieStore.get('session')

        if (!session) return { success: false, error: 'No session' }
        const { payload } = await jwtVerify(session.value, SECRET_KEY)
        if (!payload || !payload.userId) return { success: false, error: 'Invalid session' }
        const user = await prisma.user.findUnique({
            where: { id: payload.userId as string },
            select: {
                id: true, email: true,
                name: true, phone: true,
                rollNumber: true, sportsExperience: true,
                qrCodePath: true, role: true,
            }
        })
        if (!user) return { success: false, error: 'User not found' }
        return { success: true, data: user }
    }
    catch (error: any) {
        return { success: false, error: error.message || 'Failed to get current user' }
    }
}

export async function getUsers(): Promise<ActionResponse<{ documents: any[], total: number }>> {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true, email: true,
                name: true, phone: true,
                rollNumber: true, sportsExperience: true,
                qrCodePath: true, role: true,
            }
        });
        return { success: true, data: { documents: users, total: users.length } };
    }
    catch (error: any) {
        console.error("Get users error:", error);
        return { success: false, error: error.message || 'Failed to get users' };
    }
}

export async function requestPasswordReset(email: string): Promise<ActionResponse> {
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return { success: true, data: "If an account exists with this email, a reset link has been sent." };
        }

        const token = uuidv4();
        const expiry = new Date(Date.now() + 3600000); 

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: token,
                resetTokenExpiry: expiry,
            },
        });

        const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

        await sendResetEmail(email, resetLink);

        return { success: true, data: "Reset link sent to your email." };
    } catch (error: any) {
        console.error("Request password reset error:", error);
        return { success: false, error: error.message || "Failed to process request." };
    }
}

export async function resetPassword(token: string, newPassword: string): Promise<ActionResponse> {
    try {
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: { gt: new Date() },
            },
        });

        if (!user) {
            return { success: false, error: "Invalid or expired reset token." };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
            },
        });

        return { success: true, data: "Password updated successfully." };
    } catch (error: any) {
        console.error("Reset password error:", error);
        return { success: false, error: error.message || "Failed to reset password." };
    }
}

async function sendResetEmail(email: string, link: string) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM || '"SportsBook" <noreply@sportsbook.com>',
        to: email,
        subject: "Password Reset Request",
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #3b82f6;">Password Reset</h2>
        <p>Hello,</p>
        <p>You requested a password reset for your SportsBook account. Click the button below to reset it. This link will expire in 1 hour.</p>
        <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
        </div>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>Best regards,<br>The SportsBook Team</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this link: <br> ${link}</p>
        </div>
        `,
    });
}

async function createSession(user: any) {
    const token = await new SignJWT({ userId: user.id, email: user.email, role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d').sign(SECRET_KEY)
    const cookieStore = await cookies()
    cookieStore.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, 
        path: '/',
    })
}
