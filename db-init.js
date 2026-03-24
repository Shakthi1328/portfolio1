const { Pool } = require('pg');
require('dotenv').config();

async function initDB() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASS || ''}@${process.env.DB_HOST || 'localhost'}:5432/${process.env.DB_NAME || 'portfolio'}`,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    try {
        const client = await pool.connect();
        console.log("Connected to PostgreSQL successfully.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                subject VARCHAR(255),
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Table 'messages' ensured in database.");

        client.release();
        await pool.end();
    } catch (e) {
        console.error("DB INIT ERROR:", e.message);
    }
}

initDB();
