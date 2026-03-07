/* ============================================
   MongoDB Connection — Mongoose Setup
   Pool-optimised connection with auto-reconnect.
   Exits process on initial connection failure.
   ============================================ */

const mongoose = require('mongoose');

async function connectDB() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codelens';

    try {
        const conn = await mongoose.connect(mongoURI, {
            // Connection pool optimization
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });

        console.log('  MongoDB Connected: ' + conn.connection.host);

        // Handle connection events
        mongoose.connection.on('error', function(err) {
            console.error('  MongoDB Connection Error:', err.message);
        });

        mongoose.connection.on('disconnected', function() {
            console.warn('  MongoDB Disconnected. Attempting reconnect...');
        });

        mongoose.connection.on('reconnected', function() {
            console.log('  MongoDB Reconnected successfully.');
        });

    } catch (err) {
        console.error('  MongoDB Connection Error:', err.message);
        process.exit(1);
    }
}

module.exports = connectDB;
