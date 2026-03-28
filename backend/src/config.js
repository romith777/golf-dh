const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

function parseOrigins(value) {
  if (!value || value === "*") {
    return ["*"];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  adminSetupKey: process.env.ADMIN_SETUP_KEY || "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  frontendUrl: process.env.FRONTEND_URL || "*",
  frontendOrigins: parseOrigins(process.env.FRONTEND_URL || "*"),
  mongoUri: process.env.MONGODB_URI,
  subscriptionPlans: {
    monthly: { id: "monthly", name: "Monthly", price: 29, billingCycle: "month" },
    yearly: { id: "yearly", name: "Yearly", price: 299, billingCycle: "year" }
  },
  prizePoolContributionRate: 0.35,
  prizeSplit: {
    five: 0.4,
    four: 0.35,
    three: 0.25
  },
  scoreRange: {
    min: 1,
    max: 45
  }
};
