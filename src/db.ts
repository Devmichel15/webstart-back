import './env.js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

console.log('--- Prisma Initialization ---');
console.log('DATABASE_URL defined:', !!process.env.DATABASE_URL);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

console.log('Adapter created:', !!adapter);

export const prisma = new PrismaClient({ adapter });

console.log('Prisma instance created successfully');

export default prisma;
