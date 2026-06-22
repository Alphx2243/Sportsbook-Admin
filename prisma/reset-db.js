const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
require('dotenv').config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    if (process.env.ALLOW_DB_RESET !== 'true') {
        throw new Error('Refusing to reset database unless ALLOW_DB_RESET=true is set.')
    }

    const seedUserPassword = process.env.RESET_SEED_USER_PASSWORD
    const seedAdminPassword = process.env.RESET_SEED_ADMIN_PASSWORD
    if (!seedUserPassword || !seedAdminPassword || seedUserPassword.length < 12 || seedAdminPassword.length < 12) {
        throw new Error('Set RESET_SEED_USER_PASSWORD and RESET_SEED_ADMIN_PASSWORD to strong values before seeding.')
    }

    console.log('Starting database reset...')
    console.log('Cleaning GymLog...')
    await prisma.gymLog.deleteMany({})
    console.log('Cleaning Invite...')
    await prisma.invite.deleteMany({})
    console.log('Cleaning GuideApplication...')
    await prisma.guideApplication.deleteMany({})
    console.log('Cleaning Match...')
    await prisma.match.deleteMany({})
    console.log('Cleaning Booking...')
    await prisma.booking.deleteMany({})
    console.log('Cleaning User...')
    await prisma.user.deleteMany({})
    console.log('Cleaning Sport...')
    await prisma.sport.deleteMany({})
    console.log('Database cleared.')
    const sports = [
        {
            name: 'Badminton',
            numberOfCourts: 3,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Court 1:0', 'Court 2:0', 'Court 3:0'],
            equipments: {
                create: [
                    { name: 'Racket', total: 20 },
                    { name: 'Shuttle', total: 50 }
                ]
            }
        },
        {
            name: 'Squash',
            numberOfCourts: 2,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Court 1:0', 'Court 2:0'],
            equipments: {
                create: [
                    { name: 'Racket', total: 10 },
                    { name: 'Ball', total: 20 }
                ]
            }
        },
        {
            name: 'Table Tennis',
            numberOfCourts: 4,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Table 1:0', 'Table 2:0', 'Table 3:0', 'Table 4:0'],
            equipments: {
                create: [
                    { name: 'Racket', total: 20 },
                    { name: 'Ball', total: 50 }
                ]
            }
        },
        {
            name: 'Tennis',
            numberOfCourts: 2,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Court 1:0', 'Court 2:0'],
            equipments: {
                create: [
                    { name: 'Racket', total: 15 },
                    { name: 'Ball', total: 40 }
                ]
            }
        },
        {
            name: 'Swimming',
            numberOfCourts: 1,
            maxCapacity: 20,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['RPool:0'],
        },
        {
            name: 'Gym',
            numberOfCourts: 1,
            maxCapacity: 50,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Main Gym:0'],
        },
    ]
    const users = [
        {
            name: 'Kunal Budhiraja',
            email: 'kunal24313@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9810593078',
            rollNumber: '2024313',
        },
        {
            name: 'Alphx',
            email: 'alphx@iiitd.ac.in',
            password: seedUserPassword,
            phone: '8700740987',
            rollNumber: '2024333',
        },
        {
            name: 'Admin',
            email: 'admin@iiitd.ac.in',
            password: seedAdminPassword,
            phone: '9810593072',
            rollNumber: '2024213',
            role: 'Admin'
        },
        {
            name: 'Guard',
            email: 'guard@iiitd.ac.in',
            password: seedAdminPassword,
            phone: '9810593073',
            rollNumber: '2024214',
            role: 'guard'
        },
        {
            name: 'Facility Manager',
            email: 'facility.manager@iiitd.ac.in',
            password: seedAdminPassword,
            phone: '9810593074',
            rollNumber: '2024215',
            role: 'facility_manager'
        }
    ]

    for (const sport of sports) {
        await prisma.sport.create({
            data: sport,
        })
        console.log(`Created sport: ${sport.name}`)
    }
    for (const user of users) {
        const password = await bcrypt.hash(user.password, 10);
        await prisma.user.create({
            data: { ...user, password },
        })
        console.log(`Created user: ${user.name}`)
    }

    console.log('Database reset complete!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
