const mongoose = require('mongoose');

// Connection options for maximum resilience in cloud environments
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI || mongoURI.includes('YOUR_MONGODB_ATLAS_CONNECTION_STRING_HERE')) {
  console.warn('⚠️ WARNING: Cloud MONGODB_URI is not set or contains the default placeholder inside .env!');
  console.log('To set up your FREE database cluster:');
  console.log('1. Register on MongoDB Atlas (https://www.mongodb.com/cloud/atlas)');
  console.log('2. Provision an M0 permanently FREE Cluster.');
  console.log('3. Under Database Access, create a user (e.g. admin/admin123).');
  console.log('4. Copy your cluster connection string, paste it as MONGODB_URI in your secure .env, and restart server.');
}

// Connect to MongoDB Atlas
mongoose.connect(mongoURI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging indefinitely
})
.then(() => console.log('✅ Successfully connected to Cloud MongoDB Database Cluster.'))
.catch(err => {
  console.error('❌ CRITICAL: MongoDB Cloud Connection Failed!', err.message);
});

// Database Schema representing a verified contest entry
const RegistrationSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    lowercase: true, 
    trim: true, 
    index: true 
  },
  phone: { 
    type: String, 
    required: true, 
    trim: true, 
    index: true 
  },
  solution: { 
    type: String, 
    required: true,
    trim: true 
  },
  razorpay_order_id: { 
    type: String, 
    required: true 
  },
  razorpay_payment_id: { 
    type: String, 
    required: true, 
    unique: true 
  },
  payment_status: { 
    type: String, 
    default: 'captured' 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});

const Registration = mongoose.model('Registration', RegistrationSchema);

/**
 * Inserts a new verified registration document into MongoDB.
 * @param {Object} entry 
 */
async function insert(entry) {
  const reg = new Registration({
    name: entry.name,
    email: entry.email,
    phone: entry.phone,
    solution: entry.solution,
    razorpay_order_id: entry.razorpay_order_id,
    razorpay_payment_id: entry.razorpay_payment_id,
    payment_status: entry.payment_status || 'captured'
  });
  return await reg.save();
}

/**
 * Performs a dynamic, high-performance lookup in MongoDB.
 * Searches by exact lowercase email or phone number.
 * @param {string} email 
 * @param {string} phone 
 */
async function findEntry(email, phone) {
  const searchEmail = (email || '').toLowerCase().trim();
  const searchPhone = (phone || '').replace(/\s+/g, '').trim();

  const queryConditions = [];
  if (searchEmail) queryConditions.push({ email: searchEmail });
  if (searchPhone) queryConditions.push({ phone: searchPhone });

  if (queryConditions.length === 0) return null;

  return await Registration.findOne({ $or: queryConditions });
}

/**
 * Retrieves all registered participant records.
 */
async function getAll() {
  return await Registration.find({});
}

module.exports = {
  insert,
  findEntry,
  getAll
};
