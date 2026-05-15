import { Router, Request, Response } from "express";
import { db } from "./auth-db";
import { iosTransactions, IOS_PRODUCT_PLAN_MAP, IOS_STORAGE_ADDON_MAP, storageAddons, STORAGE_ADDON_TIERS } from "@shared/models/auth";
import { setUserPlan } from "./usage";
import { eq, and, desc } from "drizzle-orm";
import { createVerify, X509Certificate } from "crypto";
import type { PlanType } from "@shared/models/auth";

const router = Router();

interface JWSTransactionPayload {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  environment: string;
  type: string;
  bundleId: string;
  appAccountToken?: string;
}

interface AppStoreNotification {
  signedPayload: string;
}

interface DecodedNotification {
  notificationType: string;
  subtype?: string;
  data?: {
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
    environment?: string;
    bundleId?: string;
  };
}

const EXPECTED_BUNDLE_ID = process.env.IOS_BUNDLE_ID || "com.evident.assistant";

const APPLE_ROOT_CA_G3 = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

function decodeJWSPayload<T>(jws: string): T | null {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload) as T;
  } catch (e) {
    console.error("Failed to decode JWS payload:", e);
    return null;
  }
}

function decodeJWSHeader(jws: string): { alg?: string; x5c?: string[] } | null {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) return null;
    const header = Buffer.from(parts[0], "base64url").toString("utf8");
    return JSON.parse(header);
  } catch (e) {
    console.error("Failed to decode JWS header:", e);
    return null;
  }
}

function verifyCertificateChain(x5cCerts: string[]): { valid: boolean; leafCert: X509Certificate | null; error?: string } {
  try {
    if (x5cCerts.length < 2) {
      return { valid: false, leafCert: null, error: "Certificate chain too short" };
    }

    const certs: X509Certificate[] = [];
    for (const certBase64 of x5cCerts) {
      const certPem = `-----BEGIN CERTIFICATE-----\n${certBase64}\n-----END CERTIFICATE-----`;
      certs.push(new X509Certificate(certPem));
    }

    const appleRootCert = new X509Certificate(APPLE_ROOT_CA_G3);

    for (let i = 0; i < certs.length - 1; i++) {
      const currentCert = certs[i];
      const issuerCert = certs[i + 1];
      
      if (currentCert.issuer !== issuerCert.subject) {
        return { valid: false, leafCert: null, error: `Certificate chain broken at position ${i}` };
      }

      try {
        const isValid = currentCert.verify(issuerCert.publicKey);
        if (!isValid) {
          return { valid: false, leafCert: null, error: `Certificate signature invalid at position ${i}` };
        }
      } catch (verifyError) {
        return { valid: false, leafCert: null, error: `Certificate verification failed at position ${i}` };
      }
    }

    const lastCert = certs[certs.length - 1];
    
    if (lastCert.issuer !== appleRootCert.subject) {
      return { valid: false, leafCert: null, error: "Certificate chain does not terminate at Apple Root CA" };
    }

    try {
      const rootVerified = lastCert.verify(appleRootCert.publicKey);
      if (!rootVerified) {
        return { valid: false, leafCert: null, error: "Intermediate certificate not signed by Apple Root CA" };
      }
    } catch (rootVerifyError) {
      return { valid: false, leafCert: null, error: "Failed to verify intermediate against Apple Root CA" };
    }

    for (const cert of certs) {
      const now = new Date();
      const notBefore = new Date(cert.validFrom);
      const notAfter = new Date(cert.validTo);
      
      if (now < notBefore || now > notAfter) {
        return { valid: false, leafCert: null, error: "Certificate in chain is expired or not yet valid" };
      }
    }

    return { valid: true, leafCert: certs[0] };
  } catch (e) {
    console.error("Certificate chain verification error:", e);
    return { valid: false, leafCert: null, error: "Certificate chain verification exception" };
  }
}

async function verifyAppleJWS(jws: string): Promise<{ valid: boolean; payload: JWSTransactionPayload | null; error?: string }> {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) {
      return { valid: false, payload: null, error: "Invalid JWS format" };
    }

    const header = decodeJWSHeader(jws);
    if (!header || !header.x5c || header.x5c.length === 0) {
      return { valid: false, payload: null, error: "Missing x5c certificate chain in header" };
    }

    if (header.alg !== "ES256") {
      return { valid: false, payload: null, error: "Invalid algorithm, expected ES256" };
    }

    const chainResult = verifyCertificateChain(header.x5c);
    if (!chainResult.valid || !chainResult.leafCert) {
      return { valid: false, payload: null, error: chainResult.error || "Certificate chain validation failed" };
    }

    const signatureData = parts[0] + "." + parts[1];
    const signature = Buffer.from(parts[2], "base64url");
    
    const verifier = createVerify("SHA256");
    verifier.update(signatureData);
    
    const isValid = verifier.verify(chainResult.leafCert.publicKey, signature);
    
    if (!isValid) {
      return { valid: false, payload: null, error: "Signature verification failed" };
    }

    const payload = decodeJWSPayload<JWSTransactionPayload>(jws);
    if (!payload) {
      return { valid: false, payload: null, error: "Failed to decode payload" };
    }

    if (payload.bundleId !== EXPECTED_BUNDLE_ID) {
      console.warn(`Bundle ID mismatch: expected ${EXPECTED_BUNDLE_ID}, got ${payload.bundleId}`);
      return { valid: false, payload: null, error: "Bundle ID mismatch" };
    }

    return { valid: true, payload };
  } catch (e) {
    console.error("JWS verification error:", e);
    return { valid: false, payload: null, error: "Verification exception" };
  }
}

async function verifyNotificationJWS(jws: string): Promise<{ valid: boolean; payload: DecodedNotification | null; error?: string }> {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) {
      return { valid: false, payload: null, error: "Invalid JWS format" };
    }

    const header = decodeJWSHeader(jws);
    if (!header || !header.x5c || header.x5c.length === 0) {
      return { valid: false, payload: null, error: "Missing x5c certificate chain in header" };
    }

    if (header.alg !== "ES256") {
      return { valid: false, payload: null, error: "Invalid algorithm, expected ES256" };
    }

    const chainResult = verifyCertificateChain(header.x5c);
    if (!chainResult.valid || !chainResult.leafCert) {
      return { valid: false, payload: null, error: chainResult.error || "Certificate chain validation failed" };
    }

    const signatureData = parts[0] + "." + parts[1];
    const signature = Buffer.from(parts[2], "base64url");
    
    const verifier = createVerify("SHA256");
    verifier.update(signatureData);
    
    const isValid = verifier.verify(chainResult.leafCert.publicKey, signature);
    
    if (!isValid) {
      return { valid: false, payload: null, error: "Signature verification failed" };
    }

    const payload = decodeJWSPayload<DecodedNotification>(jws);
    if (!payload) {
      return { valid: false, payload: null, error: "Failed to decode payload" };
    }

    return { valid: true, payload };
  } catch (e) {
    console.error("Notification JWS verification error:", e);
    return { valid: false, payload: null, error: "Verification exception" };
  }
}

function mapProductToPlan(productId: string): PlanType | null {
  const planKey = IOS_PRODUCT_PLAN_MAP[productId];
  if (planKey && ["free", "starter", "scholar", "pro", "pro_plus"].includes(planKey)) {
    return planKey as PlanType;
  }
  return null;
}

function isStorageAddon(productId: string): boolean {
  return productId in IOS_STORAGE_ADDON_MAP;
}

async function applyStorageAddon(userId: string, productId: string, transactionId: string): Promise<boolean> {
  const addonKey = IOS_STORAGE_ADDON_MAP[productId];
  if (!addonKey) return false;

  const addonTier = STORAGE_ADDON_TIERS[addonKey as keyof typeof STORAGE_ADDON_TIERS];
  if (!addonTier) return false;

  // Check if addon already exists for this transaction
  const existing = await db.select().from(storageAddons)
    .where(and(
      eq(storageAddons.userId, userId),
      eq(storageAddons.iosTransactionId, transactionId)
    ))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[iOS StorageAddon] Addon already exists for transaction ${transactionId}`);
    return true;
  }

  // Calculate 30-day expiry for iOS non-renewing subscription
  const purchasedAt = new Date();
  const expiresAt = new Date(purchasedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  // Add the storage addon with 30-day validity
  await db.insert(storageAddons).values({
    userId,
    addonKey,
    storageBytes: addonTier.storageBytes,
    bonusQuestions: addonTier.bonusQuestions,
    bonusMediaMinutes: addonTier.bonusMediaMinutes,
    iosTransactionId: transactionId,
    purchasedAt,
    expiresAt,
    status: "active",
  });

  console.log(`[iOS StorageAddon] Added ${addonKey} for user ${userId} - valid until ${expiresAt.toISOString()} (${addonTier.bonusQuestions} questions, ${addonTier.bonusMediaMinutes} media mins)`);
  return true;
}

router.post("/verify-transaction", async (req: Request, res: Response) => {
  try {
    const { userId, signedTransactionInfo } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    if (!signedTransactionInfo) {
      return res.status(400).json({ error: "Missing signedTransactionInfo - unsigned transactions not accepted" });
    }

    const verification = await verifyAppleJWS(signedTransactionInfo);
    
    if (!verification.valid || !verification.payload) {
      console.error(`Transaction verification failed for user ${userId}: ${verification.error}`);
      return res.status(400).json({ error: verification.error || "Invalid transaction signature" });
    }

    const payload = verification.payload;
    
    // Check if this is a storage add-on purchase
    if (isStorageAddon(payload.productId)) {
      const addonKey = IOS_STORAGE_ADDON_MAP[payload.productId];
      await applyStorageAddon(userId, payload.productId, payload.transactionId);
      
      console.log(`iOS storage addon verified for user ${userId}: ${payload.productId} -> ${addonKey}`);
      
      return res.json({
        success: true,
        transactionId: payload.transactionId,
        productId: payload.productId,
        type: "storage_addon",
        addonKey,
        expiresDate: payload.expiresDate ? new Date(payload.expiresDate).toISOString() : null,
      });
    }
    
    // Otherwise it's a subscription plan purchase
    const planKey = mapProductToPlan(payload.productId) || "starter";

    const existing = await db.select()
      .from(iosTransactions)
      .where(eq(iosTransactions.originalTransactionId, payload.originalTransactionId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(iosTransactions)
        .set({
          transactionId: payload.transactionId,
          expiresDate: payload.expiresDate ? new Date(payload.expiresDate) : null,
          status: "active",
          planKey,
          updatedAt: new Date(),
        })
        .where(eq(iosTransactions.originalTransactionId, payload.originalTransactionId));
    } else {
      await db.insert(iosTransactions).values({
        userId,
        originalTransactionId: payload.originalTransactionId,
        transactionId: payload.transactionId,
        productId: payload.productId,
        purchaseDate: new Date(payload.purchaseDate),
        expiresDate: payload.expiresDate ? new Date(payload.expiresDate) : null,
        environment: payload.environment || "production",
        type: payload.type || "auto_renewable",
        status: "active",
        planKey,
        jwsPayload: signedTransactionInfo,
      });
    }

    await setUserPlan(userId, planKey);

    console.log(`iOS transaction verified for user ${userId}: ${payload.productId} -> ${planKey}`);

    return res.json({
      success: true,
      transactionId: payload.transactionId,
      productId: payload.productId,
      type: "subscription",
      planKey,
      expiresDate: payload.expiresDate ? new Date(payload.expiresDate).toISOString() : null,
    });
  } catch (error) {
    console.error("Error verifying iOS transaction:", error);
    return res.status(500).json({ error: "Failed to verify transaction" });
  }
});

router.post("/app-store-notifications", async (req: Request, res: Response) => {
  try {
    const { signedPayload } = req.body as AppStoreNotification;

    if (!signedPayload) {
      console.error("Missing signedPayload in App Store notification");
      return res.status(400).json({ error: "Missing signedPayload" });
    }

    const notificationVerification = await verifyNotificationJWS(signedPayload);
    
    if (!notificationVerification.valid || !notificationVerification.payload) {
      console.error(`App Store notification verification failed: ${notificationVerification.error}`);
      return res.status(400).json({ error: notificationVerification.error || "Invalid notification signature" });
    }

    const notificationData = notificationVerification.payload;
    const { notificationType, subtype } = notificationData;

    console.log(`App Store Notification: ${notificationType} (${subtype || "no subtype"})`);

    if (!notificationData.data?.signedTransactionInfo) {
      console.log("No transaction info in notification, acknowledging anyway");
      return res.status(200).json({ received: true });
    }

    const txVerification = await verifyAppleJWS(notificationData.data.signedTransactionInfo);
    
    if (!txVerification.valid || !txVerification.payload) {
      console.error(`App Store notification transaction verification failed: ${txVerification.error}`);
      return res.status(400).json({ error: "Invalid transaction in notification" });
    }

    const transactionPayload = txVerification.payload;

    const transaction = await db.select()
      .from(iosTransactions)
      .where(eq(iosTransactions.originalTransactionId, transactionPayload.originalTransactionId))
      .limit(1);

    if (transaction.length === 0) {
      console.log(`Transaction ${transactionPayload.originalTransactionId} not found, ignoring notification`);
      return res.status(200).json({ received: true });
    }

    const existingTx = transaction[0];

    switch (notificationType) {
      case "DID_RENEW":
      case "SUBSCRIBED":
        await db.update(iosTransactions)
          .set({
            transactionId: transactionPayload.transactionId,
            expiresDate: transactionPayload.expiresDate ? new Date(transactionPayload.expiresDate) : null,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(iosTransactions.originalTransactionId, transactionPayload.originalTransactionId));
        
        if (existingTx.userId && existingTx.planKey) {
          await setUserPlan(existingTx.userId, existingTx.planKey as PlanType);
        }
        break;

      case "EXPIRED":
      case "DID_FAIL_TO_RENEW":
        await db.update(iosTransactions)
          .set({
            status: "expired",
            updatedAt: new Date(),
          })
          .where(eq(iosTransactions.originalTransactionId, transactionPayload.originalTransactionId));
        
        if (existingTx.userId) {
          await setUserPlan(existingTx.userId, "free");
        }
        break;

      case "REFUND":
        await db.update(iosTransactions)
          .set({
            status: "refunded",
            updatedAt: new Date(),
          })
          .where(eq(iosTransactions.originalTransactionId, transactionPayload.originalTransactionId));
        
        if (existingTx.userId) {
          await setUserPlan(existingTx.userId, "free");
        }
        break;

      case "GRACE_PERIOD_EXPIRED":
        await db.update(iosTransactions)
          .set({
            status: "grace_period_expired",
            updatedAt: new Date(),
          })
          .where(eq(iosTransactions.originalTransactionId, transactionPayload.originalTransactionId));
        
        if (existingTx.userId) {
          await setUserPlan(existingTx.userId, "free");
        }
        break;

      case "DID_CHANGE_RENEWAL_STATUS":
        if (subtype === "AUTO_RENEW_DISABLED") {
          console.log(`User ${existingTx.userId} disabled auto-renewal`);
        }
        break;

      default:
        console.log(`Unhandled notification type: ${notificationType}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing App Store notification:", error);
    return res.status(500).json({ error: "Failed to process notification" });
  }
});

router.get("/subscription-status/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const transactions = await db.select()
      .from(iosTransactions)
      .where(and(
        eq(iosTransactions.userId, userId),
        eq(iosTransactions.status, "active")
      ))
      .orderBy(desc(iosTransactions.createdAt));

    if (transactions.length === 0) {
      return res.json({
        hasActiveSubscription: false,
        planKey: "free",
      });
    }

    const activeTransaction = transactions[0];
    const now = new Date();
    const isExpired = activeTransaction.expiresDate && activeTransaction.expiresDate < now;

    if (isExpired) {
      await db.update(iosTransactions)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(iosTransactions.id, activeTransaction.id));

      await setUserPlan(userId, "free");

      return res.json({
        hasActiveSubscription: false,
        planKey: "free",
        expiredAt: activeTransaction.expiresDate?.toISOString(),
      });
    }

    return res.json({
      hasActiveSubscription: true,
      planKey: activeTransaction.planKey || "starter",
      productId: activeTransaction.productId,
      expiresDate: activeTransaction.expiresDate?.toISOString(),
      environment: activeTransaction.environment,
    });
  } catch (error) {
    console.error("Error fetching iOS subscription status:", error);
    return res.status(500).json({ error: "Failed to fetch subscription status" });
  }
});

router.post("/restore-purchases", async (req: Request, res: Response) => {
  try {
    const { userId, signedTransactions } = req.body as {
      userId: string;
      signedTransactions: string[];
    };

    if (!userId || !signedTransactions || !Array.isArray(signedTransactions)) {
      return res.status(400).json({ error: "Missing userId or signedTransactions array" });
    }

    let restoredCount = 0;
    let latestPlan: PlanType = "free";
    let latestExpiry: Date | null = null;

    for (const signedTx of signedTransactions) {
      const verification = await verifyAppleJWS(signedTx);
      
      if (!verification.valid || !verification.payload) {
        console.warn(`Skipping invalid transaction during restore: ${verification.error}`);
        continue;
      }

      const payload = verification.payload;
      const expiresDate = payload.expiresDate ? new Date(payload.expiresDate) : null;

      if (expiresDate && expiresDate < new Date()) {
        console.log(`Skipping expired transaction during restore: ${payload.originalTransactionId}`);
        continue;
      }

      // Handle storage add-ons during restore
      if (isStorageAddon(payload.productId)) {
        await applyStorageAddon(userId, payload.productId, payload.transactionId);
        restoredCount++;
        continue;
      }

      // Handle subscription plans
      const planKey = mapProductToPlan(payload.productId) || "starter";

      const existing = await db.select()
        .from(iosTransactions)
        .where(eq(iosTransactions.originalTransactionId, payload.originalTransactionId))
        .limit(1);

      if (existing.length > 0) {
        await db.update(iosTransactions)
          .set({
            userId,
            transactionId: payload.transactionId,
            expiresDate,
            status: "active",
            planKey,
            updatedAt: new Date(),
          })
          .where(eq(iosTransactions.originalTransactionId, payload.originalTransactionId));
      } else {
        await db.insert(iosTransactions).values({
          userId,
          originalTransactionId: payload.originalTransactionId,
          transactionId: payload.transactionId,
          productId: payload.productId,
          purchaseDate: new Date(payload.purchaseDate),
          expiresDate,
          environment: payload.environment || "production",
          type: payload.type || "auto_renewable",
          status: "active",
          planKey,
          jwsPayload: signedTx,
        });
      }

      if (!latestExpiry || (expiresDate && expiresDate > latestExpiry)) {
        latestExpiry = expiresDate;
        latestPlan = planKey;
      }

      restoredCount++;
    }

    if (latestPlan !== "free") {
      await setUserPlan(userId, latestPlan);
    }

    console.log(`Restored ${restoredCount} purchases for user ${userId}, plan: ${latestPlan}`);

    return res.json({
      success: true,
      restoredCount,
      planKey: latestPlan,
      expiresDate: latestExpiry?.toISOString(),
    });
  } catch (error) {
    console.error("Error restoring iOS purchases:", error);
    return res.status(500).json({ error: "Failed to restore purchases" });
  }
});

export default router;
