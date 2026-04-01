const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
require('dotenv').config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
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
            totalEquipments: ['Racket:20', 'Shuttle:50'],
            equipmentsInUse: ['Racket:0', 'Shuttle:0'],
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Court 1:0', 'Court 2:0', 'Court 3:0'],
        },
        {
            name: 'Squash',
            numberOfCourts: 2,
            totalEquipments: ['Racket:10', 'Ball:20'],
            equipmentsInUse: ['Racket:0', 'Ball:0'],
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Court 1:0', 'Court 2:0'],
        },
        {
            name: 'Table Tennis',
            numberOfCourts: 4,
            totalEquipments: ['Racket:20', 'Ball:50'],
            equipmentsInUse: ['Racket:0', 'Ball:0'],
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Table 1:0', 'Table 2:0', 'Table 3:0', 'Table 4:0'],
        },
        {
            name: 'Tennis',
            numberOfCourts: 2,
            totalEquipments: ['Racket:15', 'Ball:40'],
            equipmentsInUse: ['Racket:0', 'Ball:0'],
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Court 1:0', 'Court 2:0'],
        },
        {
            name: 'Swimming',
            numberOfCourts: 1,
            totalEquipments: [],
            maxCapacity: 20,
            equipmentsInUse: [],
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['RPool:0'],
        },
        {
            name: 'Gym',
            numberOfCourts: 1,
            maxCapacity: 50,
            totalEquipments: [],
            equipmentsInUse: [],
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Main Gym:0'],
        },
    ]
    const users = [
        {
            name: 'Kunal Budhiraja',
            email: 'kunal24313@iiitd.ac.in',
            password: 'aforapple',
            phone: '9810593078',
            rollNumber: '2024313',

        },
        {
            name: 'Alphx',
            email: 'alphx@iiitd.ac.in',
            password: 'aforapple',
            phone: '8700740987',
            rollNumber: '2024333',
        },
        {
            name: 'Admin',
            email: 'admin@iiitd.ac.in',
            password: 'aforapple',
            phone: '9810593072',
            rollNumber: '2024213',
            role: 'Admin'
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
