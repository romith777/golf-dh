const today = new Date();
const nextMonth = new Date(today);
nextMonth.setMonth(nextMonth.getMonth() + 1);

module.exports = {
  charities: [
    {
      id: "charity-1",
      name: "Fairways For Families",
      category: "Children",
      location: "London",
      featured: true,
      description: "Funding family support programmes through golf-led fundraising.",
      image: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=900&q=80",
      upcomingEvent: "Spring Charity Golf Day"
    },
    {
      id: "charity-2",
      name: "Green Hope Foundation",
      category: "Environment",
      location: "Manchester",
      featured: false,
      description: "Protecting community green spaces and supporting youth golf access.",
      image: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=900&q=80",
      upcomingEvent: "Coastal Cleanup Invitational"
    },
    {
      id: "charity-3",
      name: "Recovery Swing Trust",
      category: "Health",
      location: "Bristol",
      featured: true,
      description: "Rehab and mental health programmes backed by club tournaments and donors.",
      image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=900&q=80",
      upcomingEvent: "Summer Wellness Scramble"
    }
  ],
  users: [
    {
      id: "user-admin",
      name: "Admin User",
      email: "admin@golfcharity.app",
      password: "admin123",
      role: "admin",
      charityId: null,
      charityPercentage: 0,
      subscription: null,
      scores: [],
      winnings: [],
      notifications: [
        {
          id: "note-admin-1",
          title: "Admin seeded",
          body: "Use this account to review the admin dashboard flows."
        }
      ]
    },
    {
      id: "user-demo",
      name: "Ava Thompson",
      email: "player@golfcharity.app",
      password: "player123",
      role: "subscriber",
      charityId: "charity-3",
      charityPercentage: 20,
      subscription: {
        status: "active",
        planId: "monthly",
        renewalDate: nextMonth.toISOString(),
        cancelledAt: null,
        activatedByPayment: true,
        paymentProvider: "seed",
        paymentId: "seed-payment-1"
      },
      scores: [
        { id: "score-1", value: 29, playedAt: "2026-03-01" },
        { id: "score-2", value: 34, playedAt: "2026-03-08" },
        { id: "score-3", value: 31, playedAt: "2026-03-11" },
        { id: "score-4", value: 36, playedAt: "2026-03-15" },
        { id: "score-5", value: 33, playedAt: "2026-03-22" }
      ],
      winnings: [
        {
          id: "winner-1",
          drawId: "draw-2026-02",
          tier: "three",
          amount: 120,
          status: "paid",
          proofStatus: "approved",
          proofUrl: "https://example.com/proof.png"
        }
      ],
      notifications: [
        {
          id: "note-player-1",
          title: "March draw opens soon",
          body: "Your last 5 scores are ready for the next monthly draw."
        }
      ]
    }
  ],
  draws: [
    {
      id: "draw-2026-02",
      month: "2026-02",
      mode: "random",
      numbers: [29, 34, 12, 17, 33],
      resultStatus: "published",
      jackpotCarryover: 0,
      prizePool: {
        total: 210,
        five: 84,
        four: 73.5,
        three: 52.5
      },
      winners: [
        {
          id: "winner-1",
          userId: "user-demo",
          tier: "three",
          amount: 120,
          status: "paid",
          proofStatus: "approved",
          proofUrl: "https://example.com/proof.png"
        }
      ]
    }
  ]
};
