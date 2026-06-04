require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const matchRoutes = require("./routes/matches");
const messageRoutes = require("./routes/messages");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security middleware ───────────────────────────────────
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: [
      process.env.APP_URL,
      "http://localhost:5000",
      "http://localhost:3000",
    ],
    credentials: true,
  }),
);

// ─── Rate limiting ─────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please try again in 15 minutes." },
});

app.use("/api/", apiLimiter);

// ─── Body parsers ──────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));

// ─── Logging ──────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// ─── API Routes ───────────────────────────────────────────
app.use("/api/auth/profile", profileRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/matches", matchRoutes);

// ─── Health check ─────────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({ status: "ok", env: process.env.NODE_ENV }),
);

// ─── Serve frontend ───────────────────────────────────────
app.use(express.static(path.join(__dirname, "../client")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// ─── Global error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n🌿 Soulthread server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
