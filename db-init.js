const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDB() {
    try {
        // Connect without specifying a database first
        const c = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS
        });
        
        const dbName = process.env.DB_NAME || 'portfolio';
        await c.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        console.log(`Database '${dbName}' created or already exists.`);
        
        await c.query(`USE \`${dbName}\``);
        
        await c.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                subject VARCHAR(255),
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Table 'messages' created successfully.");
        
        await c.end();
    } catch (e) {
        console.error("DB INIT ERROR:", e.message);
    }
}
initDB();
