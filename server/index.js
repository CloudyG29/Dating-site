require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const paymentRoutes = require('./routes/payment');
const matchRoutes = require('./routes/matches');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security middleware ───────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // Disabled so frontend can load external fonts/scripts
}));

app.use(cors({
  origin: [
    process.env.APP_URL,
    'http://localhost:5000',
    'http://localhost:3000',
  ],
  credentials: true,
}));

// ─── Rate limiting ─────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many payment attempts.' },
});

app.use('/api/', apiLimiter);
app.use('/payment/initiate', paymentLimiter);

// ─── Body parsers ──────────────────────────────────────────
// PayFast ITN sends application/x-www-form-urlencoded — must be raw before express.json
app.use('/payment/notify', express.urlencoded({ extended: false }));
app.use(express.json({ limit: '2mb' }));

// ─── Logging ──────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─── API Routes ───────────────────────────────────────────
app.use('/api/auth/profile', profileRoutes);
app.use('/api/auth', authRoutes);
app.use('/payment', paymentRoutes);
app.use('/api/matches', matchRoutes);

// ─── Health check ─────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// ─── Serve frontend (production) ──────────────────────────
// In development Firebase Hosting serves the frontend.
// In production (if hosting both on same server) serve from /public
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

// ─── Global error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🌿 Soulthread server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   PayFast: ${process.env.PF_SANDBOX === 'true' ? 'SANDBOX' : 'LIVE'}\n`);
});

module.exports = app;

// COMMENTED OUT FOR TESTING PURPOSES ONLY - TO ISOLATE FRONTEND ISSUES

// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const path = require('path');

// // 1. COMMENT THESE OUT
// // const authRoutes = require('./routes/auth');
// // const paymentRoutes = require('./routes/payment');
// // const matchRoutes = require('./routes/matches');

// const app = express();
// const PORT = process.env.PORT || 3000;

// app.use(helmet({ contentSecurityPolicy: false }));
// app.use(cors());
// app.use(express.json());
// app.use(morgan('dev'));

// // 2. COMMENT THESE OUT
// // app.use('/api/auth', authRoutes);
// // app.use('/payment', paymentRoutes);
// // app.use('/api/matches', matchRoutes);

// app.get('/health', (req, res) => res.json({ status: 'ok' }));

// // 3. FORCE SERVE THE FRONTEND 
// // (Remove the if (process.env.NODE_ENV === 'production') check temporarily)
// app.use(express.static(path.join(__dirname, '../public')));
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, '../public/index.html'));
// });

// app.listen(PORT, () => {
//   console.log(`Test server running at http://localhost:${PORT}`);
// });