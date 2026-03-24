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
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASS || ''}@${process.env.DB_HOST || 'localhost'}:5432/${process.env.DB_NAME || 'portfolio'}`,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Nodemailer transporter (Optimized for Render/Gmail)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Test connection endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Basic validation
        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
        }

        // 1. Save to database
        try {
            const query = 'INSERT INTO messages (name, email, subject, message) VALUES ($1, $2, $3, $4)';
            await pool.query(query, [name, email, subject || 'No Subject', message]);
        } catch (dbError) {
            console.error('Database insertion failed:', dbError.message);
            // We continue anyway to try sending the email
        }

        // 2. Send email notification
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to yourself
            replyTo: email,
            subject: `Portfolio Contact from ${name}: ${subject || 'No Subject'}`,
            text: `You have received a new message from your portfolio website.\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
            html: `
                <h3>New message from your portfolio website</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject || 'No Subject'}</p>
                <h4>Message:</h4>
                <p>${message.replace(/\n/g, '<br>')}</p>
            `
        };

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);
        } else {
            console.warn('Email credentials not configured. Message saved to DB only.');
        }

        res.json({ success: true, message: 'Message sent successfully!' });

    } catch (error) {
        console.error('Error in /api/contact:', error);
        res.status(500).json({ success: false, message: 'An error occurred while processing your request.', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
