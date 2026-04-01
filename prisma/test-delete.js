const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('Fetching users...')
    const users = await prisma.user.findMany()
    const target = users.find(u => u.email === 'finaltest@iiitd.ac.in')
    if (!target) {
        console.log('Final Test user not found. Creating one...')
        const newUser = await prisma.user.create({
            data: {
                name: 'Final Test',
                email: 'finaltest@iiitd.ac.in',
                password: 'hash',
                phone: '1234567890',
                rollNumber: '2024FINAL'
            }
        });
        console.log('Created:', newUser.id);
        await deleteUserTrans(newUser.id);
    } else {
        console.log('Found:', target.id);
        await deleteUserTrans(target.id);
    }
}

async function deleteUserTrans(userId) {
    console.log(`Deleting user ${userId} and their related records...`)
    await prisma.$transaction([
        prisma.booking.deleteMany({ where: { userId } }),
        prisma.gymLog.deleteMany({ where: { userId } }),
        prisma.user.delete({ where: { id: userId } })
    ])
    console.log('Deletion successful!')
}

main()
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
