import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function readServiceAccount(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) {
    const parsed = JSON.parse(rawJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      };
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, "\n").trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

export function getAdminDb() {
  if (!getApps().length) {
    const sa = readServiceAccount();
    initializeApp({
      credential: cert({
        projectId: sa.projectId,
        clientEmail: sa.clientEmail,
        privateKey: sa.privateKey,
      }),
    });
  }
  return getFirestore();
}

export function getAdminAuth() {
  if (!getApps().length) {
    const sa = readServiceAccount();
    initializeApp({
      credential: cert({
        projectId: sa.projectId,
        clientEmail: sa.clientEmail,
        privateKey: sa.privateKey,
      }),
    });
  }
  return getAuth();
}
