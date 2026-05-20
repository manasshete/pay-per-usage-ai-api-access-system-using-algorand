import admin from "firebase-admin";
import fs from "fs";
import path from "path";

let firebaseAdminInitialized = false;

/**
 * Initializes and returns the Firebase Admin SDK instance.
 * If FIREBASE_PROJECT_ID is not set in the environment, it returns null
 * (useful for local development in mock mode).
 */
export function getFirebaseAdmin() {
  if (firebaseAdminInitialized) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (projectId || serviceAccountJson || serviceAccountPath) {
    try {
      let credential = undefined;
      
      if (serviceAccountPath) {
        // Option A: Path to the downloaded .json file
        const cleanPath = serviceAccountPath.trim().replace(/^["']|["']$/g, '');
        const fullPath = path.resolve(process.cwd(), cleanPath);
        console.log(`[Firebase Admin] Attempting to load service account from: ${fullPath}`);
        if (fs.existsSync(fullPath)) {
          const fileContent = fs.readFileSync(fullPath, "utf-8");
          credential = admin.credential.cert(JSON.parse(fileContent));
        }
      } else if (serviceAccountJson) {
        // Option B: Raw JSON string in .env
        const parsedCredentials = JSON.parse(serviceAccountJson);
        credential = admin.credential.cert(parsedCredentials);
      }

      admin.initializeApp({ 
        projectId: projectId || undefined,
        credential
      });
      firebaseAdminInitialized = true;
      console.log(`[Firebase Admin] Initialized globally ${credential ? 'WITH Service Account (Write Access Enabled)' : 'without Service Account (Read Only)'}`);
      return admin;
    } catch (e) {
      console.error("[Firebase Admin] Initialization failed:", e.message);
      return null;
    }
  } else {
    console.warn("[Firebase Admin] FIREBASE_PROJECT_ID is not set. Admin SDK disabled. Using Mock Mode.");
    firebaseAdminInitialized = true; // Mark as initialized so we don't spam the warning
    return null;
  }
}
