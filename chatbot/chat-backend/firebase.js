import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// Initialize Firebase Admin using the same service account as the main Sentinal backend
// In a real production deployment, this would be injected via environment variables.

const serviceAccountPath = path.resolve(
  "../backend/campusdo-1da53-firebase-adminsdk-fbsvc-2ad4b6917c.json"
);

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin initialized for Chat Backend.");
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error.message);
}

export const auth = admin.auth();
