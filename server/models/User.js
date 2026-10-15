const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer'
    },
    avatar: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    city: {
      type: String,
      default: '',
      trim: true
    },
    locality: {
      type: String,
      default: '',
      trim: true
    },
    state: {
      type: String,
      default: '',
      trim: true
    },
    interests: {
      type: [String],
      default: []
    },
    profileVisibility: {
      type: String,
      enum: ['public', 'community'],
      default: 'public'
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active'
    },
    trustScore: {
      type: Number,
      default: 95
    },
    rating: {
      type: Number,
      default: 0
    },
    reviewsCount: {
      type: Number,
      default: 0
    },
    responseRate: {
      type: String,
      default: 'Under 1 hour'
    },
    verified: {
      type: Boolean,
      default: true
    },
    points: {
      type: Number,
      default: 0,
      min: 0
    },
    resetPasswordToken: {
      type: String,
      select: false
    },
    resetPasswordExpires: {
      type: Date,
      select: false
    }
  },
  {
    timestamps: true
  }
);

// Performance indexes for authentication, role queries, and user governance
userSchema.index({ role: 1, accountStatus: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);

