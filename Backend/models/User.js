/* ============================================
   User Model — MongoDB Schema (Mongoose)
   Fields: name, email, password, role, avatar, createdAt
           resetOtp, resetOtpExpires, resetOtpVerified
   Features:
     • Pre-save hook: bcrypt password hashing (10 rounds)
     • comparePassword(): bcrypt comparison
     • toPublicJSON(): safe serialisation (excludes password)
     • Indexes on email (unique), role, createdAt
     • OTP fields (select:false) for forgot-password flow
   ============================================ */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define User Schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false  // Don't return password in queries by default
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'tester'],
        default: 'user'
    },
    avatar: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    // ---- Forgot-password OTP fields (never returned in queries by default) ----
    resetOtp: {
        type: String,
        select: false
    },
    resetOtpExpires: {
        type: Date,
        select: false
    },
    resetOtpVerified: {
        type: Boolean,
        default: false,
        select: false
    }
});

// Indexes for frequent queries
// Note: email index is auto-created by unique:true
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with stored hash
userSchema.methods.comparePassword = async function(enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

// Helper: format user object for API response (avoids repeating fields)
userSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        avatar: this.avatar,
        createdAt: this.createdAt
    };
};

const User = mongoose.model('User', userSchema);
module.exports = User;
