require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const Razorpay = require('razorpay');
const db = require('./js/db');

const app = express();
const PORT = process.env.PORT || 8086;

// Initialize Razorpay Client
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

/**
 * 1. API: Create Razorpay Order
 * Route: POST /api/create-order
 */
app.post('/api/create-order', async (req, res) => {
  try {
    const options = {
      amount: 199900, // ₹1,999 in paise
      currency: 'INR',
      receipt: `rcpt_contest_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    
    res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate Razorpay transaction order. Please try again.'
    });
  }
});

/**
 * 2. API: Verify Razorpay Payment Signature & Save User Details
 * Route: POST /api/verify-payment
 */
app.post('/api/verify-payment', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      solution,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    // Validate inputs
    if (!name || !email || !phone || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Mandatory information or payment IDs are missing.'
      });
    }

    // Cryptographically verify Razorpay Signature
    const text = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        error: 'Payment cryptographic signature verification failed. Untrusted payment transaction.'
      });
    }

    // Save to database (best-effort — payment is already verified by HMAC above)
    const registrationData = {
      name,
      email,
      phone,
      solution: solution || '',
      razorpay_order_id,
      razorpay_payment_id,
      payment_status: 'captured'
    };

    let record = { id: `REG_${Date.now()}`, razorpay_payment_id };
    try {
      record = await db.insert(registrationData);
      console.log('✅ Registration saved to database:', razorpay_payment_id);
    } catch (dbErr) {
      // DB failure must NOT block payment confirmation — payment is already verified
      console.error('⚠️  DB save failed (payment still valid):', dbErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and contest entry registered successfully.',
      registration_id: record.id || record._id,
      payment_id: razorpay_payment_id
    });
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({
      success: false,
      error: 'An internal error occurred during payment verification. Please contact support.'
    });
  }
});

/**
 * 3. API: Check Contest Entry Registration Status
 * Route: GET /api/check-status
 */
app.get('/api/check-status', async (req, res) => {
  try {
    const { email, phone } = req.query;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either registered email address or phone number.'
      });
    }

    const entry = await db.findEntry(email, phone);

    if (!entry) {
      return res.status(200).json({
        success: true,
        found: false,
        message: 'No active entry found with the provided details.'
      });
    }

    res.status(200).json({
      success: true,
      found: true,
      entry: {
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        created_at: entry.created_at,
        payment_id: entry.razorpay_payment_id,
        status: 'Captured & Verified'
      }
    });
  } catch (err) {
    console.error('Error fetching entry status:', err);
    res.status(500).json({
      success: false,
      error: 'An error occurred during status lookup. Please try again.'
    });
  }
});

// Start Server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Dynamic Premium Server running at http://localhost:${PORT}/`);
  });
}

module.exports = app;
