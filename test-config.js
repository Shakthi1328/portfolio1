const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testAll() {
    console.log('--- Testing DB ---');
    try {
        const c = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });
        
        // Also verify the table exists
        const [rows] = await c.execute(`SHOW TABLES LIKE 'messages'`);
        if (rows.length === 0) {
             console.log('DB ERROR: Database connected, but "messages" table is MISSING!');
        } else {
             console.log('DB SUCCESS: Connected and table exists.');
        }
        c.end();
    } catch (e) {
        console.log('DB CONNECTION ERROR:', e.message);
    }

    console.log('\n--- Testing Email ---');
    const t = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    t.verify(function(err, success) {
        if (err) {
            console.log('EMAIL ERROR:', err.message);
            process.exit(1);
        } else {
            console.log('EMAIL SUCCESS');
            process.exit(0);
        }
    });
}
testAll();
