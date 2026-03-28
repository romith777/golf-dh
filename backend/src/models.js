const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    value: { type: Number, required: true },
    playedAt: { type: String, required: true }
  },
  { _id: false }
);

const winningSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    drawId: { type: String, default: "" },
    userId: { type: String, default: "" },
    tier: { type: String, required: true },
    amount: { type: Number, default: 0 },
    status: { type: String, default: "pending" },
    proofStatus: { type: String, default: "pending" },
    proofUrl: { type: String, default: "" }
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true }
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    planId: { type: String, required: true },
    renewalDate: { type: String, required: true },
    cancelledAt: { type: String, default: null },
    activatedByPayment: { type: Boolean, default: false },
    paymentProvider: { type: String, default: "" },
    paymentId: { type: String, default: "" }
  },
  { _id: false }
);

const charitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    location: { type: String, required: true },
    featured: { type: Boolean, default: false },
    description: { type: String, required: true },
    image: { type: String, required: true },
    upcomingEvent: { type: String, required: true }
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    charityId: { type: String, default: null },
    charityPercentage: { type: Number, default: 0 },
    subscription: { type: subscriptionSchema, default: null },
    scores: { type: [scoreSchema], default: [] },
    winnings: { type: [winningSchema], default: [] },
    notifications: { type: [notificationSchema], default: [] }
  },
  { timestamps: true }
);

const prizePoolSchema = new mongoose.Schema(
  {
    total: { type: Number, default: 0 },
    five: { type: Number, default: 0 },
    four: { type: Number, default: 0 },
    three: { type: Number, default: 0 }
  },
  { _id: false }
);

const drawSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    month: { type: String, required: true, index: true },
    mode: { type: String, required: true },
    numbers: { type: [Number], default: [] },
    resultStatus: { type: String, required: true },
    jackpotCarryover: { type: Number, default: 0 },
    prizePool: { type: prizePoolSchema, required: true },
    winners: { type: [winningSchema], default: [] }
  },
  { timestamps: true }
);

const Charity = mongoose.models.Charity || mongoose.model("Charity", charitySchema);
const User = mongoose.models.User || mongoose.model("User", userSchema);
const Draw = mongoose.models.Draw || mongoose.model("Draw", drawSchema);

module.exports = {
  Charity,
  User,
  Draw
};
