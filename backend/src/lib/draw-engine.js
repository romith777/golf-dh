const { prizePoolContributionRate, prizeSplit, scoreRange, subscriptionPlans } = require("../config");

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function uniqueNumbers(generator) {
  const set = new Set();
  while (set.size < 5) {
    set.add(generator());
  }
  return Array.from(set);
}

function createRandomDraw() {
  return uniqueNumbers(() => randomInt(scoreRange.min, scoreRange.max));
}

function createAlgorithmicDraw(subscribers) {
  const frequency = new Map();

  subscribers.forEach((subscriber) => {
    subscriber.scores.forEach((score) => {
      frequency.set(score.value, (frequency.get(score.value) || 0) + 1);
    });
  });

  const weighted = Array.from(frequency.entries()).sort((a, b) => b[1] - a[1]);
  if (!weighted.length) {
    return createRandomDraw();
  }

  const numbers = [];
  weighted.forEach(([value]) => {
    if (numbers.length < 5 && !numbers.includes(value)) {
      numbers.push(value);
    }
  });

  while (numbers.length < 5) {
    const candidate = randomInt(scoreRange.min, scoreRange.max);
    if (!numbers.includes(candidate)) {
      numbers.push(candidate);
    }
  }

  return numbers;
}

function calculatePrizePool(activeSubscribers, carryover = 0) {
  const totalSubscriptions = activeSubscribers.reduce((sum, user) => {
    const plan = subscriptionPlans[user.subscription.planId] || subscriptionPlans.monthly;
    return sum + plan.price;
  }, 0);

  const total = Number((totalSubscriptions * prizePoolContributionRate + carryover).toFixed(2));
  return {
    total,
    five: Number((total * prizeSplit.five).toFixed(2)),
    four: Number((total * prizeSplit.four).toFixed(2)),
    three: Number((total * prizeSplit.three).toFixed(2))
  };
}

function scoreMatches(userScores, drawNumbers) {
  const userValues = userScores.map((score) => score.value);
  return drawNumbers.filter((num) => userValues.includes(num)).length;
}

function tierFromMatches(count) {
  if (count >= 5) return "five";
  if (count >= 4) return "four";
  if (count >= 3) return "three";
  return null;
}

function distributeWinnings(draw, subscribers) {
  const winnerBuckets = { five: [], four: [], three: [] };

  subscribers.forEach((subscriber) => {
    const matchCount = scoreMatches(subscriber.scores, draw.numbers);
    const tier = tierFromMatches(matchCount);

    if (!tier) return;

    winnerBuckets[tier].push({
      id: `winner-${draw.id}-${subscriber.id}-${tier}`,
      userId: subscriber.id,
      tier,
      amount: 0,
      status: "pending",
      proofStatus: "pending",
      proofUrl: ""
    });
  });

  const jackpotClaimed = winnerBuckets.five.length > 0;
  const carryover = jackpotClaimed ? 0 : draw.prizePool.five;

  Object.entries(winnerBuckets).forEach(([tier, bucket]) => {
    if (!bucket.length) return;
    const totalForTier = draw.prizePool[tier];
    const each = Number((totalForTier / bucket.length).toFixed(2));
    bucket.forEach((winner) => {
      winner.amount = each;
    });
  });

  return {
    winners: [...winnerBuckets.five, ...winnerBuckets.four, ...winnerBuckets.three],
    carryover
  };
}

module.exports = {
  createRandomDraw,
  createAlgorithmicDraw,
  calculatePrizePool,
  distributeWinnings
};
