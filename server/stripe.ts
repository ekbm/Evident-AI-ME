import Stripe from "stripe";
import { db } from "./auth-db";
import { users, subscriptions, entitlements, userPlans, PLAN_ENTITLEMENTS, uploadBoosts, UPLOAD_BOOST_CONFIG, usageMonthly, storageAddons, STORAGE_ADDON_TIERS, type StorageAddonKey } from "@shared/models/auth";
import { eq, and, sql } from "drizzle-orm";
import { sendWelcomeEmail } from "./email-service";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set - Stripe features will be disabled");
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const APP_BASE_URL = process.env.APP_BASE_URL || "";

export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER || "",
  scholar: process.env.STRIPE_PRICE_SCHOLAR || "",
  pro: process.env.STRIPE_PRICE_PRO || "",
  pro_plus: process.env.STRIPE_PRICE_PRO_PLUS || "",
} as const;

export const PRICE_TO_PLAN: Record<string, string> = {
  [STRIPE_PRICE_IDS.starter]: "starter",
  [STRIPE_PRICE_IDS.scholar]: "scholar",
  [STRIPE_PRICE_IDS.pro]: "pro",
  [STRIPE_PRICE_IDS.pro_plus]: "pro_plus",
};

async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (user[0]?.stripeCustomerId) {
    return user[0].stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return customer.id;
}

export type PaidPlan = "starter" | "scholar" | "pro" | "pro_plus";

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  plan: PaidPlan,
  trial: boolean = false
): Promise<string | null> {
  if (!stripe) {
    console.error("Stripe not configured");
    return null;
  }

  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) {
    console.error("Price ID not configured for plan:", plan);
    return null;
  }

  const customerId = await ensureStripeCustomer(userId, userEmail);

  // Build subscription data with optional trial period
  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    metadata: {
      userId,
      plan,
    },
  };

  // Add 30-day trial for starter and scholar plans
  if (trial && (plan === "starter" || plan === "scholar")) {
    subscriptionData.trial_period_days = 30;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${APP_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_BASE_URL}/billing`,
    metadata: {
      userId,
      plan,
      trial: trial ? "true" : "false",
    },
    subscription_data: subscriptionData,
  });

  return session.url;
}

export async function createBillingPortalSession(
  userId: string
): Promise<string | null> {
  if (!stripe) return null;

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const customerId = user[0]?.stripeCustomerId;
  
  if (!customerId) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_BASE_URL}/billing`,
  });

  return session.url;
}

async function upsertEntitlement(userId: string, planKey: string): Promise<void> {
  const entitlementConfig = PLAN_ENTITLEMENTS[planKey as keyof typeof PLAN_ENTITLEMENTS] || PLAN_ENTITLEMENTS.free;
  
  const existing = await db.select().from(entitlements).where(eq(entitlements.userId, userId)).limit(1);
  
  if (existing.length > 0) {
    await db
      .update(entitlements)
      .set({
        planKey,
        deviceLimit: entitlementConfig.deviceLimit,
        maxIndexedGb: entitlementConfig.maxIndexedGb,
        updatedAt: new Date(),
      })
      .where(eq(entitlements.userId, userId));
  } else {
    await db.insert(entitlements).values({
      userId,
      planKey,
      deviceLimit: entitlementConfig.deviceLimit,
      maxIndexedGb: entitlementConfig.maxIndexedGb,
    });
  }

  const existingPlan = await db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1);
  if (existingPlan.length > 0) {
    await db
      .update(userPlans)
      .set({ plan: planKey, updatedAt: new Date() })
      .where(eq(userPlans.userId, userId));
  } else {
    await db.insert(userPlans).values({
      userId,
      plan: planKey,
    });
  }
}

async function upsertSubscription(
  userId: string,
  stripeSubscriptionId: string,
  stripeCustomerId: string,
  status: string,
  priceId: string,
  planKey: string,
  currentPeriodEnd: Date | null
): Promise<void> {
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(subscriptions)
      .set({
        status,
        priceId,
        planKey,
        currentPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
  } else {
    await db.insert(subscriptions).values({
      userId,
      stripeSubscriptionId,
      stripeCustomerId,
      status,
      priceId,
      planKey,
      currentPeriodEnd,
    });
  }
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const type = session.metadata?.type;

  // Handle storage add-on checkout
  if (type === "storage_addon") {
    const addonKey = session.metadata?.addonKey;
    const storageBytes = session.metadata?.storageBytes;
    
    if (!userId || !addonKey || !storageBytes) {
      console.error("[StorageAddon] Missing metadata in checkout session");
      return;
    }
    
    if (session.subscription) {
      await handleStorageAddonSubscription(
        session.subscription as string,
        session.customer as string,
        { userId, addonKey, storageBytes }
      );
    }
    return;
  }

  // Handle regular plan checkout
  const plan = session.metadata?.plan;

  if (!userId || !plan) {
    console.error("Missing metadata in checkout session");
    return;
  }

  if (session.subscription && stripe) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    
    const priceId = subscription.items.data[0]?.price.id || "";
    const planKey = PRICE_TO_PLAN[priceId] || plan;
    const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

    await upsertSubscription(
      userId,
      subscription.id,
      session.customer as string,
      subscription.status,
      priceId,
      planKey,
      currentPeriodEnd
    );

    await upsertEntitlement(userId, planKey);
    
    console.log(`Checkout completed for user ${userId}: plan=${planKey}`);
    
    // Send welcome email
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length > 0 && user[0].email) {
        const planNames: Record<string, string> = {
          starter: "Evident Lite",
          scholar: "Evident Scholar", 
          pro: "Evident Advanced",
          pro_plus: "Evident Max"
        };
        const planDisplayName = planNames[planKey] || planKey;
        await sendWelcomeEmail(user[0].email, planDisplayName, user[0].firstName);
        console.log(`Welcome email sent to ${user[0].email}`);
      }
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }
  }
}

export async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }

  const priceId = subscription.items.data[0]?.price.id || "";
  const planKey = PRICE_TO_PLAN[priceId] || "free";
  const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

  await upsertSubscription(
    userId,
    subscription.id,
    (subscription as any).customer as string,
    subscription.status,
    priceId,
    planKey,
    currentPeriodEnd
  );

  if (subscription.status === "active" || subscription.status === "trialing") {
    await upsertEntitlement(userId, planKey);
  }

  console.log(`Subscription updated for user ${userId}: plan=${planKey}, status=${subscription.status}`);
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata.userId;
  if (!userId) return;

  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  await upsertEntitlement(userId, "free");

  console.log(`Subscription canceled for user ${userId}, downgraded to free`);
}

export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = (invoice as any).subscription as string;
  if (!subscriptionId || !stripe) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata.userId;
  
  if (!userId) return;

  const priceId = subscription.items.data[0]?.price.id || "";
  const planKey = PRICE_TO_PLAN[priceId] || "free";

  if (subscription.status === "active" || subscription.status === "trialing") {
    await upsertEntitlement(userId, planKey);
    console.log(`Invoice payment succeeded for user ${userId}, entitlement active: ${planKey}`);
  }
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = (invoice as any).subscription as string;
  if (!subscriptionId || !stripe) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata.userId;
  
  if (!userId) return;

  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    await db
      .update(subscriptions)
      .set({ status: subscription.status, updatedAt: new Date() })
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
    
    console.log(`Invoice payment failed for user ${userId}, status: ${subscription.status}`);
  }
}

// Normalize legacy plan keys to canonical values
function normalizePlanKey(plan: string | null | undefined): string {
  if (!plan) return "free";
  if (plan === "pro_plus") return "plus"; // normalize legacy pro_plus to plus
  if (plan === "enterprise") return "premium_org"; // enterprise maps to premium_org
  return plan;
}

export async function getBillingStatus(userId: string): Promise<{
  plan: string;
  entitlement: { planKey: string; deviceLimit: number; maxIndexedGb: number | null } | null;
  subscription: { status: string; currentPeriodEnd: Date | null } | null;
}> {
  const entitlementResult = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .limit(1);

  const subscriptionResult = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const userPlanResult = await db
    .select()
    .from(userPlans)
    .where(eq(userPlans.userId, userId))
    .limit(1);

  // PRIORITY: Entitlements (admin-assigned) takes precedence over userPlans
  let plan = "free";
  if (entitlementResult[0]?.planKey) {
    plan = normalizePlanKey(entitlementResult[0].planKey);
    // Sync to userPlans if different
    const currentUserPlan = userPlanResult[0]?.plan;
    if (currentUserPlan !== plan) {
      if (userPlanResult.length === 0) {
        await db.insert(userPlans).values({ userId, plan });
      } else {
        await db.update(userPlans).set({ plan, updatedAt: new Date() }).where(eq(userPlans.userId, userId));
      }
    }
  } else if (userPlanResult[0]?.plan) {
    plan = normalizePlanKey(userPlanResult[0].plan);
  }

  return {
    plan,
    entitlement: entitlementResult[0] ? {
      planKey: normalizePlanKey(entitlementResult[0].planKey),
      deviceLimit: entitlementResult[0].deviceLimit,
      maxIndexedGb: entitlementResult[0].maxIndexedGb,
    } : null,
    subscription: subscriptionResult[0] ? {
      status: subscriptionResult[0].status,
      currentPeriodEnd: subscriptionResult[0].currentPeriodEnd,
    } : null,
  };
}

export function verifyWebhookSignature(
  payload: Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// ============================================
// UPLOAD BOOST (One-time $1 for 50MB upload)
// ============================================

export async function createUploadBoostCheckout(
  userId: string,
  userEmail: string
): Promise<{ url: string; boostId: string } | null> {
  if (!stripe) {
    console.error("Stripe not configured");
    return null;
  }

  const customerId = await ensureStripeCustomer(userId, userEmail);
  
  // Calculate expiration (24 hours from now)
  const expiresAt = new Date(Date.now() + UPLOAD_BOOST_CONFIG.expirationHours * 60 * 60 * 1000);

  // Create pending boost record
  const [boost] = await db.insert(uploadBoosts).values({
    userId,
    maxFileSizeMB: UPLOAD_BOOST_CONFIG.maxFileSizeMB,
    status: "pending",
    expiresAt,
  }).returning();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Upload Boost - 50MB Document",
            description: "One-time upload boost: Upload a document up to 50MB (valid for 24 hours)",
          },
          unit_amount: UPLOAD_BOOST_CONFIG.priceInCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${APP_BASE_URL}/?boost_success=true&boost_id=${boost.id}`,
    cancel_url: `${APP_BASE_URL}/?boost_cancelled=true`,
    metadata: {
      userId,
      boostId: boost.id,
      type: "upload_boost",
    },
  });

  // Update boost with Stripe session ID
  await db.update(uploadBoosts)
    .set({ stripePaymentId: session.id })
    .where(eq(uploadBoosts.id, boost.id));

  return { url: session.url!, boostId: boost.id };
}

export async function handleUploadBoostPayment(sessionId: string): Promise<boolean> {
  if (!stripe) return false;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== "paid") {
      return false;
    }

    const boostId = session.metadata?.boostId;
    const userId = session.metadata?.userId;
    if (!boostId) {
      console.error("[UploadBoost] No boostId in session metadata");
      return false;
    }

    // Mark boost as paid
    await db.update(uploadBoosts)
      .set({ status: "paid" })
      .where(eq(uploadBoosts.id, boostId));

    // Increment one-off boost count in monthly usage
    if (userId) {
      const yearMonth = new Date().toISOString().slice(0, 7); // '2025-01' format
      
      try {
        // Upsert: increment or create monthly usage record using ON CONFLICT
        await db.execute(sql`
          INSERT INTO usage_monthly (id, user_id, year_month, one_off_boost_count, storage_bytes, total_uploads, queries_used, media_seconds_used)
          VALUES (gen_random_uuid(), ${userId}, ${yearMonth}, 1, 0, 0, 0, 0)
          ON CONFLICT ON CONSTRAINT uq_usage_monthly_user_month 
          DO UPDATE SET one_off_boost_count = usage_monthly.one_off_boost_count + 1
        `);
        
        console.log(`[UploadBoost] Incremented one-off boost count for user ${userId}`);
      } catch (upsertError) {
        console.error("[UploadBoost] Error incrementing boost count:", upsertError);
      }
    }

    console.log(`[UploadBoost] Boost ${boostId} marked as paid`);
    return true;
  } catch (error) {
    console.error("[UploadBoost] Error handling payment:", error);
    return false;
  }
}

export async function getActiveUploadBoost(userId: string): Promise<{
  id: string;
  maxFileSizeMB: number;
  expiresAt: Date | null;
} | null> {
  const now = new Date();
  
  const [boost] = await db.select()
    .from(uploadBoosts)
    .where(and(
      eq(uploadBoosts.userId, userId),
      eq(uploadBoosts.status, "paid")
    ))
    .limit(1);

  if (!boost) return null;
  
  // Check if expired
  if (boost.expiresAt && boost.expiresAt < now) {
    // Mark as expired
    await db.update(uploadBoosts)
      .set({ status: "expired" })
      .where(eq(uploadBoosts.id, boost.id));
    return null;
  }

  return {
    id: boost.id,
    maxFileSizeMB: boost.maxFileSizeMB,
    expiresAt: boost.expiresAt,
  };
}

export async function consumeUploadBoost(boostId: string, assetId: string): Promise<boolean> {
  try {
    await db.update(uploadBoosts)
      .set({ 
        status: "used",
        usedForAssetId: assetId,
        usedAt: new Date(),
      })
      .where(eq(uploadBoosts.id, boostId));
    
    console.log(`[UploadBoost] Boost ${boostId} consumed for asset ${assetId}`);
    return true;
  } catch (error) {
    console.error("[UploadBoost] Error consuming boost:", error);
    return false;
  }
}

// ============ Storage Add-ons ============

// Stripe price IDs for storage add-ons (set these as env variables)
export const STORAGE_ADDON_PRICE_IDS: Record<StorageAddonKey, string> = {
  storage_5gb: process.env.STRIPE_PRICE_STORAGE_5GB || "",
  storage_10gb: process.env.STRIPE_PRICE_STORAGE_10GB || "",
  storage_25gb: process.env.STRIPE_PRICE_STORAGE_25GB || "",
};

export async function createStorageAddonCheckout(
  userId: string,
  userEmail: string,
  addonKey: StorageAddonKey
): Promise<string | null> {
  if (!stripe) {
    console.error("[StorageAddon] Stripe not configured");
    return null;
  }

  const priceId = STORAGE_ADDON_PRICE_IDS[addonKey];
  if (!priceId) {
    console.error("[StorageAddon] Price ID not configured for:", addonKey);
    return null;
  }

  const addonTier = STORAGE_ADDON_TIERS[addonKey];
  if (!addonTier) {
    console.error("[StorageAddon] Invalid addon key:", addonKey);
    return null;
  }

  const customerId = await ensureStripeCustomer(userId, userEmail);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${APP_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}&type=storage_addon`,
    cancel_url: `${APP_BASE_URL}/pricing`,
    metadata: {
      userId,
      type: "storage_addon",
      addonKey,
      storageBytes: addonTier.storageBytes.toString(),
      bonusQuestions: addonTier.bonusQuestions.toString(),
    },
  });

  console.log(`[StorageAddon] Created checkout session for ${addonKey} user ${userId}`);
  return session.url;
}

export async function handleStorageAddonSubscription(
  subscriptionId: string,
  customerId: string,
  metadata: { userId: string; addonKey: string; storageBytes: string; bonusQuestions?: string }
): Promise<boolean> {
  try {
    const { userId, addonKey, storageBytes, bonusQuestions } = metadata;
    
    // Check if this addon already exists for user
    const existing = await db.select().from(storageAddons)
      .where(and(
        eq(storageAddons.userId, userId),
        eq(storageAddons.stripeSubscriptionId, subscriptionId)
      ))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[StorageAddon] Addon already exists for subscription ${subscriptionId}`);
      return true;
    }

    // Get bonus values from config if not in metadata (backwards compatibility)
    const addonTier = STORAGE_ADDON_TIERS[addonKey as keyof typeof STORAGE_ADDON_TIERS];
    const bonusQuestionsValue = bonusQuestions ? parseInt(bonusQuestions, 10) : (addonTier?.bonusQuestions || 0);
    const bonusMediaMinutesValue = addonTier?.bonusMediaMinutes || 0;

    // Create storage addon record with bonus questions and media minutes
    await db.insert(storageAddons).values({
      userId,
      addonKey,
      storageBytes: parseInt(storageBytes, 10),
      bonusQuestions: bonusQuestionsValue,
      bonusMediaMinutes: bonusMediaMinutesValue,
      stripeSubscriptionId: subscriptionId,
      status: "active",
    });

    console.log(`[StorageAddon] Added ${addonKey} for user ${userId} (${bonusQuestionsValue} questions, ${bonusMediaMinutesValue} media mins)`);
    return true;
  } catch (error) {
    console.error("[StorageAddon] Error handling subscription:", error);
    return false;
  }
}

export async function cancelStorageAddon(userId: string, addonId: string): Promise<boolean> {
  if (!stripe) return false;

  try {
    const [addon] = await db.select().from(storageAddons)
      .where(and(
        eq(storageAddons.id, addonId),
        eq(storageAddons.userId, userId)
      ))
      .limit(1);

    if (!addon) {
      console.error("[StorageAddon] Addon not found:", addonId);
      return false;
    }

    // Cancel subscription in Stripe
    if (addon.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(addon.stripeSubscriptionId);
    }

    // Update status in database
    await db.update(storageAddons)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(eq(storageAddons.id, addonId));

    console.log(`[StorageAddon] Canceled addon ${addonId} for user ${userId}`);
    return true;
  } catch (error) {
    console.error("[StorageAddon] Error canceling addon:", error);
    return false;
  }
}

export async function getUserStorageAddonsFromDb(userId: string): Promise<Array<{
  id: string;
  addonKey: string;
  storageBytes: number;
  status: string;
  name: string;
  price: number;
  purchasedAt: Date | null;
  expiresAt: Date | null;
  daysRemaining: number | null;
  isIOSPurchase: boolean;
}>> {
  const now = new Date();
  const addons = await db.select().from(storageAddons)
    .where(eq(storageAddons.userId, userId));

  // Check for expired iOS add-ons and mark them
  for (const addon of addons) {
    if (addon.expiresAt && addon.expiresAt < now && addon.status === "active") {
      await db.update(storageAddons)
        .set({ status: "expired", updatedAt: now })
        .where(eq(storageAddons.id, addon.id));
      addon.status = "expired";
      console.log(`[StorageAddon] Marked addon ${addon.id} as expired for user ${userId}`);
    }
  }

  return addons.map(addon => {
    const tier = STORAGE_ADDON_TIERS[addon.addonKey as StorageAddonKey];
    const isIOSPurchase = !!addon.iosTransactionId;
    
    // Calculate days remaining for iOS purchases
    let daysRemaining: number | null = null;
    if (isIOSPurchase && addon.expiresAt && addon.status === "active") {
      const msRemaining = addon.expiresAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
    }

    return {
      id: addon.id,
      addonKey: addon.addonKey,
      storageBytes: addon.storageBytes,
      status: addon.status,
      name: tier?.name || addon.addonKey,
      price: tier?.price || 0,
      purchasedAt: addon.purchasedAt,
      expiresAt: addon.expiresAt,
      daysRemaining,
      isIOSPurchase,
    };
  });
}
