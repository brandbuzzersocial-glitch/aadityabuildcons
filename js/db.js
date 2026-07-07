/**
 * db.js — Dual-Mode Cloud + Local Fallback Database Coordinator
 *
 * Priority 1: MongoDB Atlas (cloud) — used when MONGODB_URI is valid & reachable.
 * Priority 2: Local JSON file (data/db.json) — automatic fallback when cloud is unavailable.
 *
 * This ensures the payment gateway ALWAYS works, whether or not MongoDB is configured.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────
// LOCAL JSON FILE FALLBACK SETUP
// ─────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory and file exist safely (ignoring read-only filesystem errors in cloud environments)
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]', 'utf8');
} catch (err) {
  console.warn('⚠️ Running in read-only environment (Vercel). Local JSON fallback storage disabled.');
}

let writeQueue = Promise.resolve(); // Async write lock

function readLocal() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeLocal(records) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Failed to write fallback record to disk:', err.message);
  }
}

// ─────────────────────────────────────────
// MONGODB ATLAS SETUP (OPTIONAL)
// ─────────────────────────────────────────
const mongoURI = (process.env.MONGODB_URI || '').trim();
let mongoConnected = false;

const PLACEHOLDER = 'YOUR_MONGODB_ATLAS_CONNECTION_STRING_HERE';
const isMongoConfigured = mongoURI && !mongoURI.includes(PLACEHOLDER);

if (isMongoConfigured) {
  mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 15000,   // Give Atlas 15 seconds to respond
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  })
    .then(() => {
      mongoConnected = true;
      console.log('✅ Successfully connected to Cloud MongoDB Database Cluster.');
    })
    .catch(err => {
      mongoConnected = false;
      console.warn('⚠️  MongoDB unavailable. Falling back to local JSON database.');
      console.warn('   Reason:', err.message);
    });
} else {
  console.log('ℹ️  MongoDB URI not configured. Using local JSON database (data/db.json).');
  console.log('   To enable cloud storage, add your Atlas connection string to .env as MONGODB_URI.');
}

// MongoDB Schema (only used if connected)
const RegistrationSchema = new mongoose.Schema({
  name:                  { type: String, required: true, trim: true },
  email:                 { type: String, required: true, lowercase: true, trim: true, index: true },
  phone:                 { type: String, required: true, trim: true, index: true },
  solution:              { type: String, default: '', trim: true },
  amount:                { type: Number },
  tier:                  { type: String, trim: true },
  razorpay_order_id:     { type: String, required: true },
  razorpay_payment_id:   { type: String, required: true, unique: true },
  payment_status:        { type: String, default: 'captured' },
  created_at:            { type: Date, default: Date.now }
});

const Registration = mongoose.models.Registration || mongoose.model('Registration', RegistrationSchema);

// ─────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────

// Helper for local JSON insertion
function insertLocal(entry) {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(() => {
      try {
        const records = readLocal();
        const newRecord = {
          id: `REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created_at: new Date().toISOString(),
          name: entry.name,
          email: entry.email.toLowerCase().trim(),
          phone: entry.phone,
          solution: entry.solution || '',
          amount: entry.amount ? Number(entry.amount) : undefined,
          tier: entry.tier,
          razorpay_order_id: entry.razorpay_order_id,
          razorpay_payment_id: entry.razorpay_payment_id,
          payment_status: entry.payment_status || 'captured'
        };
        records.push(newRecord);
        writeLocal(records);
        console.log('✅ [Local JSON] Registration saved:', newRecord.razorpay_payment_id);
        resolve(newRecord);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Insert a new verified registration.
 * Uses MongoDB if configured, otherwise falls back to local JSON.
 */
async function insert(entry) {
  if (isMongoConfigured) {
    try {
      const doc = new Registration({
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        solution: entry.solution || '',
        amount: entry.amount,
        tier: entry.tier,
        razorpay_order_id: entry.razorpay_order_id,
        razorpay_payment_id: entry.razorpay_payment_id,
        payment_status: entry.payment_status || 'captured'
      });
      const saved = await doc.save();
      console.log('✅ [MongoDB] Registration saved:', saved.razorpay_payment_id);
      return saved;
    } catch (err) {
      console.error('❌ [MongoDB] Insert failed:', err.message);
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️ Falling back to local JSON database for insertion.');
        return await insertLocal(entry);
      }
      throw err;
    }
  } else {
    return await insertLocal(entry);
  }
}

/**
 * Find a registration by email or phone.
 * Uses MongoDB if configured, otherwise falls back to local JSON.
 */
async function findEntry(email, phone) {
  const searchEmail = (email || '').toLowerCase().trim();
  const searchPhone = (phone || '').replace(/\s+/g, '').trim();

  if (!searchEmail && !searchPhone) return null;

  if (isMongoConfigured) {
    try {
      const conditions = [];
      if (searchEmail) conditions.push({ email: searchEmail });
      if (searchPhone) conditions.push({ phone: searchPhone });
      return await Registration.findOne({ $or: conditions });
    } catch (err) {
      console.error('❌ [MongoDB] Find entry failed:', err.message);
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️ Falling back to local JSON database for findEntry.');
        const records = readLocal();
        return records.find(r => {
          if (searchEmail && r.email === searchEmail) return true;
          if (searchPhone && r.phone === searchPhone) return true;
          return false;
        }) || null;
      }
      throw err;
    }
  } else {
    const records = readLocal();
    return records.find(r => {
      if (searchEmail && r.email === searchEmail) return true;
      if (searchPhone && r.phone === searchPhone) return true;
      return false;
    }) || null;
  }
}

/**
 * Get all registered participants.
 */
async function getAll() {
  if (isMongoConfigured) {
    try {
      return await Registration.find({});
    } catch (err) {
      console.error('❌ [MongoDB] GetAll failed:', err.message);
      if (process.env.NODE_ENV !== 'production') {
        return readLocal();
      }
      throw err;
    }
  } else {
    return readLocal();
  }
}

module.exports = { insert, findEntry, getAll };
