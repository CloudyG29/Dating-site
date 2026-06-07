const { PrismaMssql } = require('@prisma/adapter-mssql');
const { PrismaClient } = require('@prisma/client');

// Prisma 7+ requires an explicit driver adapter when connecting to Azure SQL Server
const adapter = new PrismaMssql(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;