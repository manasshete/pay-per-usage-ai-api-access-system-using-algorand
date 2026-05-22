import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

try {
  let serviceAccount;

  // 1. Check if JSON is provided directly in env (best for Render/Vercel deployment)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    // 2. Fallback to local file path (for local dev)
    const defaultPath = path.resolve("../backend/campusdo-1da53-firebase-adminsdk-fbsvc-2ad4b6917c.json");
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || defaultPath;
    
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    } else {
      throw new Error(`Service account file not found at ${serviceAccountPath} and FIREBASE_SERVICE_ACCOUNT_JSON env variable is not set.`);
    }
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin initialized for Chat Backend.");
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error.message);
}

export const auth = admin.auth();
