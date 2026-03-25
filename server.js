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

    if (!user || !pass) {
        return res.status(500).json({
            success: false,
            error: 'MISSING_CREDENTIALS',
            message: 'EMAIL_USER or EMAIL_PASS environment variables are not set on Render dashboard.',
            env_user_present: !!user,
            env_pass_present: !!pass
        });
    }

    try {
        const transporter = getTransporter();
        await transporter.verify();
        
        const info = await transporter.sendMail({
            from: `"Diagnostic Test" <${user}>`,
            to: user,
            subject: 'Render Portfolio Diagnostic Test',
            text: 'If you are reading this, your Render portfolio email configuration is working correctly!'
        });

        res.json({
            success: true,
            message: 'SMTP connection verified and test email sent!',
            messageId: info.messageId,
            user_configured: user
        });
    } catch (error) {
        console.error('Diagnostic email failed:', error);
        res.status(500).json({
            success: false,
            error: error.code || 'SMTP_ERROR',
            message: error.message,
            stack: error.stack,
            hint: 'Check if your Gmail App Password is still valid and your email is correct.'
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

        // 1. Save to database
        try {
            await pool.query(
                'INSERT INTO messages (name, email, subject, message) VALUES ($1, $2, $3, $4)',
                [name, email, subject || 'No Subject', message]
            );
            console.log('Message saved to database.');
        } catch (dbError) {
            console.error('DB insert failed (non-fatal):', dbError.message);
        }

        // 2. Send email notification
        console.log('EMAIL_USER set:', !!process.env.EMAIL_USER);
        console.log('EMAIL_PASS set:', !!process.env.EMAIL_PASS);
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const transporter = getTransporter();
                const info = await transporter.sendMail({
                    from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
                    to: process.env.EMAIL_USER,
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
                });
                console.log('Email sent successfully:', info.messageId);
            } catch (emailError) {
                console.error('Email send FAILED:', emailError.message);
                console.error('Full email error:', JSON.stringify(emailError, null, 2));
                // Still return success since message was saved
            }
        } else {
            console.error('EMAIL CREDENTIALS MISSING - EMAIL_USER or EMAIL_PASS not set in environment!');
        }

        res.json({ success: true, message: 'Message sent successfully!' });

    } catch (error) {
        console.error('Error in /api/contact:', error);
        res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
