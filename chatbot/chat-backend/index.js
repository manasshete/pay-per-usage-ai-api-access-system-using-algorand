import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import chatRoutes from "./routes.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === "production";

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.ALLOWED_ORIGIN,
  'http://localhost:5555',
  'http://localhost:5173',
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  credentials: true,
}))

app.use(express.json());
app.use(morgan(isProd ? "combined" : "dev"));

// ── MongoDB ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://debjitdebnath2978_db_user:ykniFvrZfRWw4FcC@cluster0.tict9x2.mongodb.net/";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to Chat MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api", chatRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Sentinal Chat API" });
});

// ── Static Frontend (production only) ────────────────────────────────────────
const distPath = path.join(__dirname, '../chat-front/dist')

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath))
  // catch-all: serve index.html for any non-API route
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'))
    }
  })
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal server error",
    detail: isProd ? undefined : err?.message,
  });
});

app.listen(PORT, () => {
  console.log(`Chat Backend running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});

