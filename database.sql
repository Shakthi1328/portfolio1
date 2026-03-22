-- Run this script in your MySQL interface (e.g., phpMyAdmin, MySQL Workbench, or CLI)

CREATE DATABASE IF NOT EXISTS portfolio;
USE portfolio;

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
