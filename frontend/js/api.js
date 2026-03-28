(function () {
  const baseUrl = window.APP_CONFIG.apiBaseUrl;

  async function request(path, options) {
    const token = localStorage.getItem("golf_charity_token");
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Request failed.");
    return payload;
  }

  window.api = {
    getOverview: () => request("/public/overview"),
    getCharities: (query = "") => request(`/public/charities?q=${encodeURIComponent(query)}`),
    getDraws: () => request("/public/draws"),
    signup: (body) => request("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
    adminSignup: (body) => request("/auth/admin-signup", { method: "POST", body: JSON.stringify(body) }),
    login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
    me: () => request("/user/me"),
    saveProfile: (body) => request("/user/profile", { method: "PUT", body: JSON.stringify(body) }),
    addScore: (body) => request("/user/scores", { method: "POST", body: JSON.stringify(body) }),
    updateSubscription: (body) => request("/user/subscription", { method: "POST", body: JSON.stringify(body) }),
    createRazorpayOrder: (body) => request("/payments/razorpay/order", { method: "POST", body: JSON.stringify(body) }),
    verifyRazorpayPayment: (body) => request("/payments/razorpay/verify", { method: "POST", body: JSON.stringify(body) }),
    uploadProof: (body) => request("/user/winner-proof", { method: "POST", body: JSON.stringify(body) }),
    adminSummary: () => request("/admin/summary"),
    updateAdminUser: (userId, body) => request(`/admin/users/${userId}`, { method: "PUT", body: JSON.stringify(body) }),
    createCharity: (body) => request("/admin/charities", { method: "POST", body: JSON.stringify(body) }),
    deleteCharity: (charityId) => request(`/admin/charities/${charityId}`, { method: "DELETE" }),
    simulateDraw: (body) => request("/admin/draws/simulate", { method: "POST", body: JSON.stringify(body) }),
    publishDraw: (body) => request("/admin/draws/publish", { method: "POST", body: JSON.stringify(body) }),
    getWinners: () => request("/admin/winners"),
    verifyWinner: (winnerId, body) => request(`/admin/winners/${winnerId}/verify`, { method: "POST", body: JSON.stringify(body) })
    ,
    payoutWinner: (winnerId) => request(`/admin/winners/${winnerId}/payout`, { method: "POST", body: JSON.stringify({}) })
  };
})();
