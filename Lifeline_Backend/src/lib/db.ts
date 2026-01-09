import { Pool } from 'pg';
import * as fs from 'fs';
import path = require('path');

const caPath = path.resolve("./ca.pem")
const production = new Pool({
    connectionString: process.env.AIVEN_DB_URL?.replace('&sslmode=require', ''),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: {
        rejectUnauthorized: false,
        ca: fs.readFileSync(caPath, "utf8")
    }
})

const development = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
})

export const dbPool = process.env.NODE_ENV === 'production' ? production : development;
export default dbPool;
