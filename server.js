const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static('public'));

// Root route handler
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database connection pool (PostgreSQL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Auto-initialize database table on startup
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                subject VARCHAR(255),
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Database table 'messages' is ready.");
    } catch (err) {
        console.error("DB init error (non-fatal):", err.message);
    }
}
initDB();

// Nodemailer transporter helper
function getTransporter() {
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

// Diagnostic endpoint to check email configuration on Render
app.get('/api/test-email', async (req, res) => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const allKeys = Object.keys(process.env).filter(k => k.includes('EMAIL') || k.includes('PASS'));

    const diagnostics = {
        detected_keys: allKeys,
        user_present: !!user,
        pass_present: !!pass,
        node_env: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    };

    if (!user || !pass) {
        return res.status(500).json({
            success: false,
            error: 'MISSING_CREDENTIALS',
            message: 'EMAIL_USER or EMAIL_PASS environment variables are not set on Render dashboard.',
            diagnostics
        });
    }

    try {
        const transporter = getTransporter();
        
        // Timeout for SMTP operations
        const smtpTimeout = (ms) => new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`SMTP operation timed out after ${ms}ms`)), ms)
        );

        console.log('Verifying SMTP connection...');
        await Promise.race([transporter.verify(), smtpTimeout(8000)]);
        
        console.log('Sending diagnostic email...');
        const sendPromise = transporter.sendMail({
            from: `"Diagnostic Test" <${user}>`,
            to: user,
            subject: 'Render Portfolio Diagnostic Test',
            text: `Diagnostic successful at ${diagnostics.timestamp}. If you see this, delivery is working!`
        });

        const info = await Promise.race([sendPromise, smtpTimeout(10000)]);

        res.json({
            success: true,
            message: 'SMTP connection verified and test email sent!',
            messageId: info.messageId,
            diagnostics
        });
    } catch (error) {
        console.error('Diagnostic email failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.code || 'SMTP_ERROR',
            message: error.message,
            diagnostics,
            hint: 'If you see an SMTP Timeout, Render might be blocked by Gmail. Try using an alternative email or checking your Gmail "Security" tab for blocked sign-ins.'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Validation
        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
        }

        let dbSaved = false;
        let emailInitiated = false;

        // 1. Save to database with timeout
        try {
            // Create a timeout promise
            const timeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Database timeout')), 5000)
            );

            // Race the query against the timeout
            await Promise.race([
                pool.query(
                    'INSERT INTO messages (name, email, subject, message) VALUES ($1, $2, $3, $4)',
                    [name, email, subject || 'No Subject', message]
                ),
                timeout
            ]);
            
            dbSaved = true;
            console.log('Message saved to database.');
        } catch (dbError) {
            console.error('DB operation failed:', dbError.message);
            // We continue even if DB fails, to try and send the email
        }

        // 2. Send email notification (NON-BLOCKING)
        const user = process.env.EMAIL_USER;
        const pass = process.env.EMAIL_PASS;

        if (user && pass) {
            emailInitiated = true;
            // We do NOT await this, so the user gets a response immediately
            const transporter = getTransporter();
            transporter.sendMail({
                from: `"Portfolio Contact" <${user}>`,
                to: user,
                replyTo: email,
                subject: `Portfolio Contact: ${subject || 'No Subject'} from ${name}`,
                text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject || 'No Subject'}\n\nMessage:\n${message}`,
                html: `
                    <h2 style="color:#333">New message from your portfolio</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                    <p><strong>Subject:</strong> ${subject || 'No Subject'}</p>
                    <hr/>
                    <p><strong>Message:</strong></p>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                `
            }).then(info => {
                console.log('Email sent successfully:', info.messageId);
            }).catch(emailError => {
                console.error('Email background send FAILED:', emailError.message);
            });
        } else {
            console.error('EMAIL CREDENTIALS MISSING on Render dashboard!');
        }

        // Return success if at least one action was attempted
        res.json({ 
            success: true, 
            message: 'Message processed!',
            details: {
                database_saved: dbSaved,
                email_sent_queued: emailInitiated
            }
        });

    } catch (error) {
        console.error('Error in /api/contact:', error);
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
