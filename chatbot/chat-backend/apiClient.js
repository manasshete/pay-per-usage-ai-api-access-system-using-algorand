import axios from "axios";

// This URL points to the main Sentinal backend
const SENTINAL_API_URL = process.env.SENTINEL_API_URL || process.env.SENTINAL_API_URL || "https://sentinal-j4ox.onrender.com";

export const sentinalApi = axios.create({
  baseURL: SENTINAL_API_URL,
  headers: { "Content-Type": "application/json" },
});
