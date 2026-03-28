const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const { adminSetupKey, frontendOrigins, razorpayKeyId, razorpayKeySecret, subscriptionPlans, scoreRange, prizeSplit } = require("./config");
const { signToken } = require("./lib/jwt");
const { requireAuth, requireAdmin } = require("./middleware/auth");
const store = require("./lib/data-store");
const { createRandomDraw, createAlgorithmicDraw, calculatePrizePool, distributeWinnings } = require("./lib/draw-engine");

const app = express();

function normalizeOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const normalizedHost = parsed.hostname === "127.0.0.1" ? "localhost" : parsed.hostname;
    return `${parsed.protocol}//${normalizedHost}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch (_error) {
    return origin;
  }
}

const allowAllOrigins = frontendOrigins.includes("*");
const allowedOrigins = new Set(frontendOrigins.map(normalizeOrigin));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowAllOrigins) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function ensureSubscriber(user) {
  return user.role === "subscriber";
}

function hasActivePaidSubscription(user) {
  return user.role === "subscriber" && user.subscription?.status === "active" && user.subscription?.activatedByPayment === true;
}

function getAuthedUser(req) {
  return store.getUserById(req.auth.userId);
}

function getActiveSubscribers() {
  return store.listUsers().then((users) => users.filter((user) => hasActivePaidSubscription(user)));
}

function latestFiveSorted(scores) {
  return [...scores]
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
    .slice(0, 5);
}

function getUserPlan(user) {
  return subscriptionPlans[user.subscription?.planId] || subscriptionPlans.monthly;
}

function createRenewalDate(planId) {
  const renewalDate = new Date();
  if (planId === "yearly") {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  } else {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  }
  return renewalDate.toISOString();
}

const razorpay = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: "mongodb" });
});

app.get("/api/public/overview", asyncHandler(async (_req, res) => {
  const [draws, charities, users, activeSubscribers] = await Promise.all([
    store.listDraws(),
    store.listCharities(),
    store.listUsers(),
    getActiveSubscribers()
  ]);
  const totalPrizePool = draws.reduce((sum, draw) => sum + (draw.prizePool?.total || 0), 0);
  const charityRaised = users.reduce((sum, user) => {
    if (!hasActivePaidSubscription(user) || !user.charityId) {
      return sum;
    }
    const plan = getUserPlan(user);
    return sum + plan.price * ((user.charityPercentage || 0) / 100);
  }, 0);

  res.json({
    stats: {
      activeSubscribers: activeSubscribers.length,
      charityPartners: charities.length,
      totalPrizePool: Number(totalPrizePool.toFixed(2)),
      charityRaisedEstimate: Number(charityRaised.toFixed(2))
    },
    featuredCharities: charities.filter((item) => item.featured).slice(0, 3),
    latestDraw: draws.find((draw) => draw.resultStatus === "published") || null,
    plans: Object.values(subscriptionPlans)
  });
}));

app.get("/api/public/charities", asyncHandler(async (req, res) => {
  const query = (req.query.q || "").toString().toLowerCase();
  const items = (await store.listCharities()).filter((charity) => {
    if (!query) return true;
    return [charity.name, charity.category, charity.location, charity.description].join(" ").toLowerCase().includes(query);
  });

  res.json({ items });
}));

app.get("/api/public/draws", asyncHandler(async (_req, res) => {
  res.json({ items: await store.listDraws() });
}));

app.post("/api/auth/signup", asyncHandler(async (req, res) => {
  const { name, email, password, planId, charityId, charityPercentage = 10 } = req.body || {};

  if (!name || !email || !password || !planId || !charityId) {
    return res.status(400).json({ error: "Missing required signup fields." });
  }

  if (await store.getUserByEmail(email)) {
    return res.status(409).json({ error: "Email is already registered." });
  }

  if (!subscriptionPlans[planId]) {
    return res.status(400).json({ error: "Invalid subscription plan." });
  }

  if (!(await store.getCharity(charityId))) {
    return res.status(400).json({ error: "Selected charity does not exist." });
  }

  if (Number(charityPercentage) < 10) {
    return res.status(400).json({ error: "Charity contribution must be at least 10%." });
  }

  const user = {
    id: createId("user"),
    name,
    email: email.toLowerCase(),
    password,
    role: "subscriber",
    charityId,
    charityPercentage: Number(charityPercentage),
    subscription: {
      status: "pending",
      planId,
      renewalDate: "",
      cancelledAt: null,
      activatedByPayment: false,
      paymentProvider: "",
      paymentId: ""
    },
    scores: [],
    winnings: [],
    notifications: [
      {
        id: createId("note"),
        title: "Welcome to the platform",
        body: "Your account is ready. Complete payment to activate your subscription and join the draw."
      }
    ]
  };

  await store.saveUser(user);
  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  res.status(201).json({ token, user: sanitizeUser(user) });
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const user = email ? await store.getUserByEmail(email) : null;

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  res.json({ token, user: sanitizeUser(user) });
}));

app.post("/api/auth/admin-signup", asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    setupKey
  } = req.body || {};

  if (!adminSetupKey) {
    return res.status(403).json({ error: "Admin creation is disabled. Set ADMIN_SETUP_KEY on the backend." });
  }

  if (setupKey !== adminSetupKey) {
    return res.status(403).json({ error: "Invalid admin setup key." });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing required admin signup fields." });
  }

  if (await store.getUserByEmail(email)) {
    return res.status(409).json({ error: "Email is already registered." });
  }

  const user = {
    id: createId("user"),
    name,
    email: email.toLowerCase(),
    password,
    role: "admin",
    charityId: null,
    charityPercentage: 0,
    subscription: null,
    scores: [],
    winnings: [],
    notifications: [
      {
        id: createId("note"),
        title: "Admin account created",
        body: "Your admin account is ready to manage the platform."
      }
    ]
  };

  await store.saveUser(user);
  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  res.status(201).json({ token, user: sanitizeUser(user) });
}));

app.get("/api/user/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await getAuthedUser(req);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: sanitizeUser({ ...user, scores: latestFiveSorted(user.scores || []) }) });
}));

app.put("/api/user/profile", requireAuth, asyncHandler(async (req, res) => {
  const user = await getAuthedUser(req);
  const { name, charityId, charityPercentage } = req.body || {};

  if (!user) return res.status(404).json({ error: "User not found." });
  if (charityId && !(await store.getCharity(charityId))) return res.status(400).json({ error: "Selected charity does not exist." });

  user.name = name || user.name;
  user.charityId = charityId || user.charityId;
  user.charityPercentage = Math.max(10, Number(charityPercentage || user.charityPercentage));
  await store.saveUser(user);

  res.json({ user: sanitizeUser(user) });
}));

app.get("/api/user/scores", requireAuth, asyncHandler(async (req, res) => {
  const user = await getAuthedUser(req);
  res.json({ items: latestFiveSorted(user?.scores || []) });
}));

app.post("/api/user/scores", requireAuth, asyncHandler(async (req, res) => {
  const user = await getAuthedUser(req);
  const scoreValue = Number(req.body?.value);
  const playedAt = req.body?.playedAt;

  if (!user) return res.status(404).json({ error: "User not found." });
  if (!Number.isInteger(scoreValue) || scoreValue < scoreRange.min || scoreValue > scoreRange.max) {
    return res.status(400).json({ error: `Score must be an integer between ${scoreRange.min} and ${scoreRange.max}.` });
  }
  if (!playedAt) return res.status(400).json({ error: "Played date is required." });

  user.scores = user.scores || [];
  user.scores.push({ id: createId("score"), value: scoreValue, playedAt });
  user.scores = latestFiveSorted(user.scores);
  await store.saveUser(user);

  res.status(201).json({ items: user.scores });
}));

app.post("/api/user/subscription", requireAuth, asyncHandler(async (req, res) => {
  const user = await getAuthedUser(req);
  const { planId, status } = req.body || {};

  if (!user) return res.status(404).json({ error: "User not found." });
  if (planId && !subscriptionPlans[planId]) return res.status(400).json({ error: "Invalid subscription plan." });

  user.subscription = user.subscription || {
    status: "pending",
    planId: planId || "monthly",
    renewalDate: "",
    cancelledAt: null,
    activatedByPayment: false,
    paymentProvider: "",
    paymentId: ""
  };
  user.subscription.planId = planId || user.subscription.planId;
  if (status) {
    user.subscription.status = status;
  }
  await store.saveUser(user);

  res.json({ subscription: user.subscription });
}));

app.post("/api/payments/razorpay/order", requireAuth, asyncHandler(async (req, res) => {
  const user = await getAuthedUser(req);
  const { planId } = req.body || {};

  if (!user) return res.status(404).json({ error: "User not found." });
  if (!subscriptionPlans[planId]) return res.status(400).json({ error: "Invalid subscription plan." });
  if (!razorpay) return res.status(400).json({ error: "Razorpay is not configured on the backend yet." });

  const plan = subscriptionPlans[planId];
  const order = await razorpay.orders.create({
    amount: plan.price * 100,
    currency: "INR",
    receipt: `receipt_${user.id}_${Date.now()}`,
    notes: {
      userId: user.id,
      planId
    }
  });

  res.json({
    order,
    keyId: razorpayKeyId,
    plan
  });
}));

app.post("/api/payments/razorpay/verify", requireAuth, asyncHandler(async (req, res) => {
  const user = await getAuthedUser(req);
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    planId
  } = req.body || {};

  if (!user) return res.status(404).json({ error: "User not found." });
  if (!subscriptionPlans[planId]) return res.status(400).json({ error: "Invalid subscription plan." });
  if (!razorpayKeySecret) return res.status(400).json({ error: "Razorpay is not configured on the backend yet." });

  const generated = crypto
    .createHmac("sha256", razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (generated !== signature) {
    return res.status(400).json({ error: "Invalid Razorpay payment signature." });
  }

  user.subscription = {
    status: "active",
    planId,
    renewalDate: createRenewalDate(planId),
    cancelledAt: null,
    activatedByPayment: true,
    paymentProvider: "razorpay",
    paymentId: paymentId
  };
  user.notifications = user.notifications || [];
  user.notifications.unshift({
    id: createId("note"),
    title: "Subscription payment successful",
    body: `Your ${subscriptionPlans[planId].name} subscription is now active.`
  });

  await store.saveUser(user);

  res.json({
    ok: true,
    subscription: user.subscription
  });
}));

app.post("/api/user/winner-proof", requireAuth, asyncHandler(async (req, res) => {
  const user = await getAuthedUser(req);
  const { winningId, proofUrl } = req.body || {};
  const winning = user?.winnings?.find((item) => item.id === winningId);

  if (!winning) return res.status(404).json({ error: "Winning entry not found." });

    winning.proofUrl = proofUrl || "";
    winning.proofStatus = "submitted";
    winning.status = winning.status === "paid" ? "paid" : "pending";
    await store.saveUser(user);

  res.json({ winning });
}));

app.get("/api/admin/summary", requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const [users, draws, charities, activeSubscribers] = await Promise.all([
    store.listUsers(),
    store.listDraws(),
    store.listCharities(),
    getActiveSubscribers()
  ]);
  const charityTotals = users.reduce((sum, user) => {
    if (!hasActivePaidSubscription(user) || !user.charityId) {
      return sum;
    }
    const plan = getUserPlan(user);
    return sum + plan.price * ((user.charityPercentage || 0) / 100);
  }, 0);

  res.json({
    summary: {
      totalUsers: users.length,
      activeSubscribers: activeSubscribers.length,
      totalPrizePool: draws.reduce((sum, draw) => sum + (draw.prizePool?.total || 0), 0),
      charityContributionTotals: Number(charityTotals.toFixed(2)),
      totalCharities: charities.length
    },
    latestDraw: draws[0] || null,
    users: users.map(sanitizeUser),
    charities,
    draws
  });
}));

app.put("/api/admin/users/:userId", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const user = await store.getUserById(req.params.userId);
  const { name, subscriptionStatus, planId, charityId, charityPercentage } = req.body || {};

  if (!user) return res.status(404).json({ error: "User not found." });
  if (user.role !== "admin") {
    if (charityId && !(await store.getCharity(charityId))) return res.status(400).json({ error: "Selected charity does not exist." });
    if (planId && !subscriptionPlans[planId]) return res.status(400).json({ error: "Invalid plan selected." });
  }

  user.name = name || user.name;
  if (user.role !== "admin") {
    user.subscription = user.subscription || {
      status: "pending",
      planId: planId || "monthly",
      renewalDate: "",
      cancelledAt: null,
      activatedByPayment: false,
      paymentProvider: "",
      paymentId: ""
    };

    user.charityId = charityId || user.charityId;
    user.charityPercentage = Number(charityPercentage || user.charityPercentage || 10);
    user.subscription.planId = planId || user.subscription.planId;
    user.subscription.status = subscriptionStatus || user.subscription.status;

    if (user.subscription.status === "active") {
      user.subscription.activatedByPayment = true;
      user.subscription.paymentProvider = user.subscription.paymentProvider || "admin-manual";
      user.subscription.renewalDate = createRenewalDate(user.subscription.planId);
      user.subscription.cancelledAt = null;
    } else {
      user.subscription.activatedByPayment = false;
      user.subscription.paymentProvider = user.subscription.status === "cancelled" ? "admin-manual" : "";
      user.subscription.paymentId = user.subscription.status === "active" ? user.subscription.paymentId : "";
      user.subscription.renewalDate = user.subscription.status === "pending" ? "" : user.subscription.renewalDate;
      user.subscription.cancelledAt = user.subscription.status === "cancelled" ? new Date().toISOString() : null;
    }

    user.notifications = user.notifications || [];
    user.notifications.unshift({
      id: createId("note"),
      title: "Subscription updated by admin",
      body: `Your ${user.subscription.planId} subscription is now ${user.subscription.status}.`
    });
  }
  await store.saveUser(user);

  res.json({ user: sanitizeUser(user) });
}));

app.post("/api/admin/charities", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const charity = {
    id: createId("charity"),
    name: req.body.name,
    category: req.body.category,
    location: req.body.location,
    featured: Boolean(req.body.featured),
    description: req.body.description,
    image: req.body.image,
    upcomingEvent: req.body.upcomingEvent
  };

  await store.saveCharity(charity);
  res.status(201).json({ charity });
}));

app.delete("/api/admin/charities/:charityId", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const charityId = req.params.charityId;
  const users = await store.listUsers();
  const isInUse = users.some((user) => user.charityId === charityId);

  if (isInUse) {
    return res.status(400).json({ error: "This charity is assigned to one or more users and cannot be deleted yet." });
  }

  await store.deleteCharity(charityId);
  res.status(204).send();
}));

app.post("/api/admin/draws/simulate", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const mode = req.body?.mode || "random";
  const subscribers = await getActiveSubscribers();
  const latestPublished = (await store.listDraws()).find((draw) => draw.resultStatus === "published");
  const carryover = latestPublished ? Number(latestPublished.jackpotCarryover || 0) : 0;
  const numbers = mode === "algorithm" ? createAlgorithmicDraw(subscribers) : createRandomDraw();
  const prizePool = calculatePrizePool(subscribers, carryover);
  const preview = {
    id: createId("draw-preview"),
    month: new Date().toISOString().slice(0, 7),
    mode,
    numbers,
    prizePool,
    rolloverPolicy: prizeSplit
  };
  const outcome = distributeWinnings(preview, subscribers);

  res.json({ preview, winners: outcome.winners, jackpotCarryoverIfUnclaimed: outcome.carryover });
}));

app.post("/api/admin/draws/publish", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const mode = req.body?.mode || "random";
  const subscribers = await getActiveSubscribers();
  const latestPublished = (await store.listDraws()).find((draw) => draw.resultStatus === "published");
  const carryover = latestPublished ? Number(latestPublished.jackpotCarryover || 0) : 0;
  const numbers = mode === "algorithm" ? createAlgorithmicDraw(subscribers) : createRandomDraw();
  const prizePool = calculatePrizePool(subscribers, carryover);
  const draw = {
    id: `draw-${new Date().toISOString().slice(0, 7)}`,
    month: new Date().toISOString().slice(0, 7),
    mode,
    numbers,
    resultStatus: "published",
    jackpotCarryover: 0,
    prizePool,
    winners: []
  };

  const outcome = distributeWinnings(draw, subscribers);
  draw.winners = outcome.winners;
  draw.jackpotCarryover = outcome.carryover;
  await store.saveDraw(draw);

  for (const winner of outcome.winners) {
    const user = await store.getUserById(winner.userId);
    if (!user) continue;
      user.winnings = user.winnings || [];
      user.winnings.unshift({ ...winner, drawId: draw.id });
      user.notifications = user.notifications || [];
      user.notifications.unshift({
        id: createId("note"),
        title: "You won the draw",
        body: `You matched ${winner.tier} numbers in draw ${draw.month} and won $${winner.amount}. Upload proof to continue verification.`
      });
      await store.saveUser(user);
    }

  res.status(201).json({ draw });
}));

app.get("/api/admin/winners", requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const draws = await store.listDraws();
  const users = await store.listUsers();
  const winners = draws.flatMap((draw) => (draw.winners || []).map((winner) => {
    const user = users.find((item) => item.id === winner.userId);
    return {
      ...winner,
      drawId: draw.id,
      drawMonth: draw.month,
      userName: user?.name || "Unknown user",
      userEmail: user?.email || "Unknown email"
    };
  }));
  res.json({ items: winners });
}));

app.post("/api/admin/winners/:winnerId/verify", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const action = req.body?.action || "approve";
  const winnerId = req.params.winnerId;
  const draws = await store.listDraws();
  const users = await store.listUsers();
  const draw = draws.find((item) => (item.winners || []).some((winner) => winner.id === winnerId));

  if (!draw) return res.status(404).json({ error: "Winner not found." });

  const drawWinning = draw.winners.find((winner) => winner.id === winnerId);
  drawWinning.proofStatus = action === "approve" ? "approved" : "rejected";
  if (action !== "approve") {
    drawWinning.status = "pending";
  }

  const user = users.find((item) => item.id === drawWinning.userId);
  if (!user) return res.status(404).json({ error: "Winner user not found." });

  const winning = (user.winnings || []).find((item) =>
    item.id === winnerId || (item.drawId === draw.id && item.tier === drawWinning.tier)
  );

  if (winning) {
    winning.id = drawWinning.id;
    winning.proofStatus = drawWinning.proofStatus;
    winning.status = drawWinning.status;
  }

  user.notifications = user.notifications || [];
  user.notifications.unshift({
    id: createId("note"),
    title: action === "approve" ? "Winner proof approved" : "Winner proof rejected",
    body: action === "approve"
      ? `Your proof for draw ${draw.month} has been approved. Admin can now complete payout.`
      : `Your proof for draw ${draw.month} was rejected. Please review and re-upload if needed.`
  });

  await store.saveDraw(draw);
  await store.saveUser(user);

  res.json({ winning: drawWinning });
}));

app.post("/api/admin/winners/:winnerId/payout", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const winnerId = req.params.winnerId;
  const draws = await store.listDraws();
  const users = await store.listUsers();
  const draw = draws.find((item) => (item.winners || []).some((winner) => winner.id === winnerId));

  if (!draw) return res.status(404).json({ error: "Winner not found." });

  const drawWinning = draw.winners.find((winner) => winner.id === winnerId);
  if (drawWinning.proofStatus !== "approved") {
    return res.status(400).json({ error: "Payout can only be completed after proof approval." });
  }

  drawWinning.status = "paid";
  const user = users.find((item) => item.id === drawWinning.userId);
  if (!user) return res.status(404).json({ error: "Winner user not found." });

  const winning = (user.winnings || []).find((item) =>
    item.id === winnerId || (item.drawId === draw.id && item.tier === drawWinning.tier)
  );

  if (winning) {
    winning.id = drawWinning.id;
    winning.proofStatus = drawWinning.proofStatus;
    winning.status = "paid";
  }

  user.notifications = user.notifications || [];
  user.notifications.unshift({
    id: createId("note"),
    title: "Payout completed",
    body: `Your payout of $${drawWinning.amount} for draw ${draw.month} has been marked as completed.`
  });

  await store.saveDraw(draw);
  await store.saveUser(user);

  res.json({ winning: drawWinning });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

module.exports = app;
