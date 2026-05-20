import axios from "axios";

// This URL points to the main Sentinal backend
const SENTINAL_API_URL = process.env.SENTINAL_API_URL || "http://localhost:5000";

export const sentinalApi = axios.create({
  baseURL: SENTINAL_API_URL,
  headers: { "Content-Type": "application/json" },
});
