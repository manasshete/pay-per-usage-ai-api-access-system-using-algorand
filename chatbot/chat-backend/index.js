import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import mongoose from "mongoose";
import chatRoutes from "./routes.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Connect to the specific Chat MongoDB cluster
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://debjitdebnath2978_db_user:ykniFvrZfRWw4FcC@cluster0.tict9x2.mongodb.net/";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to Chat MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use("/api", chatRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Sentinal Chat API" });
});

app.listen(PORT, () => {
  console.log(`Chat Backend running on port ${PORT}`);
});
