(function () {
  const messageNode = document.getElementById("dashboardMessage");
  const logoutButton = document.getElementById("logoutButton");
  const profileForm = document.getElementById("profileForm");
  const scoreForm = document.getElementById("scoreForm");
  const proofForm = document.getElementById("proofForm");
  const razorpayPayButton = document.getElementById("razorpayPayButton");

  function setMessage(message, isError) {
    messageNode.textContent = message || "";
    messageNode.style.color = isError ? "#a12727" : "#319f78";
    if (message && window.showToast) {
      window.showToast(message, { type: isError ? "error" : "success" });
    }
  }

  function ensureLoggedIn() {
    const token = localStorage.getItem("golf_charity_token");
    if (!token) {
      window.location.href = "./index.html";
      return false;
    }
    return true;
  }

  function maybeShowLatestNotification(user) {
    const latest = (user.notifications || [])[0];
    if (!latest || !window.showToast) {
      return;
    }

    const seenKey = `seen_notification_${user.id}`;
    const seenValue = localStorage.getItem(seenKey);
    if (seenValue === latest.id) {
      return;
    }

    window.showToast(`${latest.title}: ${latest.body}`, { type: "success", duration: 4500 });
    localStorage.setItem(seenKey, latest.id);
  }

  function getSubscriptionSummary(user) {
    const subscription = user.subscription || {};
    const planId = subscription.planId || "monthly";
    const isActive = subscription.status === "active" && subscription.activatedByPayment === true;

    return {
      planId,
      isActive,
      statusLabel: isActive ? "ACTIVE" : "PENDING PAYMENT",
      statusDescription: isActive
        ? "Your subscription is active and eligible for draw participation once you have five scores."
        : "Your account is created, but draw access starts only after a successful Razorpay payment."
    };
  }

  function getPlanAmount(planId) {
    return planId === "yearly" ? 299 : 29;
  }

  function renderUser(user, charities, draws) {
    const selectedCharity = charities.find((item) => item.id === user.charityId);
    const latestDraw = draws[0] || null;
    const subscription = getSubscriptionSummary(user);
    const isEligibleForDraw = subscription.isActive && (user.scores || []).length === 5;

    document.getElementById("dashboardName").textContent = `Welcome back, ${user.name}`;
    document.getElementById("subscriptionStatusPill").textContent = `${subscription.statusLabel} • ${subscription.planId}`;

    profileForm.querySelector('[name="name"]').value = user.name;
    profileForm.querySelector('[name="charityPercentage"]').value = user.charityPercentage;

    const charitySelect = document.getElementById("profileCharitySelect");
    charitySelect.innerHTML = charities.map((charity) => `<option value="${charity.id}">${charity.name}</option>`).join("");
    charitySelect.value = user.charityId;

    const planSelect = document.getElementById("profilePlanSelect");
    planSelect.innerHTML = `<option value="monthly">Monthly</option><option value="yearly">Yearly</option>`;
    planSelect.value = subscription.planId;

    razorpayPayButton.textContent = subscription.isActive ? "Pay again / change plan" : "Activate with Razorpay";

    document.getElementById("subscriptionMeta").innerHTML = `
      <div><strong>Status</strong><span>${subscription.statusDescription}</span></div>
      <div><strong>Renewal date</strong><span>${subscription.isActive && user.subscription?.renewalDate ? new Date(user.subscription.renewalDate).toLocaleDateString() : "Will be set after successful payment"}</span></div>
      <div><strong>Selected charity</strong><span>${selectedCharity?.name || "Unknown"}</span></div>
      <div><strong>Contribution</strong><span>${user.charityPercentage}%</span></div>
      <div><strong>Winnings total</strong><span>$${(user.winnings || []).reduce((sum, item) => sum + item.amount, 0)}</span></div>
    `;

    document.getElementById("scoreList").innerHTML = (user.scores || [])
      .map((score) => `<article class="row-card"><strong>${score.value} Stableford</strong><span class="soft">${new Date(score.playedAt).toLocaleDateString()}</span></article>`)
      .join("");

    document.getElementById("participationCard").innerHTML = `
      <article class="row-card">
        <strong>${isEligibleForDraw ? "Eligible for the next draw" : "Not yet eligible"}</strong>
        <span class="participation-highlight">${isEligibleForDraw ? "You are automatically entered because your payment is verified and you have 5 recent scores." : subscription.isActive ? `Add ${Math.max(0, 5 - (user.scores || []).length)} more score(s) to complete your last 5.` : `Complete your ${subscription.planId} payment of ₹${getPlanAmount(subscription.planId)} and then keep 5 recent scores on file.`}</span>
        <span>You do not add separate money to the draw. A fixed part of your verified subscription payment automatically funds the monthly prize pool.</span>
        <span class="soft">${latestDraw ? `Latest draw published: ${latestDraw.month} • ${latestDraw.numbers.join(" • ")}` : "No draw has been published yet."}</span>
      </article>
    `;

    document.getElementById("selectedCharityCard").innerHTML = selectedCharity
      ? `
          <img src="${selectedCharity.image}" alt="${selectedCharity.name}" />
          <strong>${selectedCharity.name}</strong>
          <span>${selectedCharity.category} • ${selectedCharity.location}</span>
          <span>${selectedCharity.description}</span>
          <span class="soft">Upcoming event: ${selectedCharity.upcomingEvent}</span>
        `
      : "<p class='soft'>No charity selected yet.</p>";

    document.getElementById("winningList").innerHTML = (user.winnings || []).length
      ? user.winnings.map((winning) => `<article class="winning-card"><strong>${winning.id}</strong><span>${winning.tier.toUpperCase()} match • $${winning.amount}</span><span class="soft">Payment: ${winning.status} | Proof: ${winning.proofStatus}</span></article>`).join("")
      : "<p class='soft'>No winnings yet.</p>";

    document.getElementById("notificationList").innerHTML = (user.notifications || [])
      .map((item) => `<article class="notification-card"><strong>${item.title}</strong><span>${item.body}</span></article>`)
      .join("");

    maybeShowLatestNotification(user);
  }

  async function load() {
    if (!ensureLoggedIn()) return;
    try {
      const [{ user }, charities, draws] = await Promise.all([window.api.me(), window.api.getCharities(), window.api.getDraws()]);
      renderUser(user, charities.items, draws.items);
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("golf_charity_token");
    localStorage.removeItem("golf_charity_role");
    window.location.href = "./index.html";
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(profileForm).entries());
      await window.api.saveProfile(payload);
      await window.api.updateSubscription({ planId: payload.planId });
      setMessage("Profile updated.");
      await load();
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  scoreForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(scoreForm).entries());
      await window.api.addScore(payload);
      scoreForm.reset();
      setMessage("Score added. Oldest score is removed automatically after five entries.");
      await load();
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  proofForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(proofForm).entries());
      await window.api.uploadProof(payload);
      proofForm.reset();
      setMessage("Winner proof uploaded for admin review.");
      await load();
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  razorpayPayButton.addEventListener("click", async () => {
    try {
      if (!window.Razorpay) {
        throw new Error("Razorpay checkout script did not load.");
      }

      const planId = profileForm.querySelector('[name="planId"]').value;
      const { order, keyId, plan } = await window.api.createRazorpayOrder({ planId });

      const razorpay = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Golf Charity Platform",
        description: `${plan.name} subscription`,
        order_id: order.id,
        handler: async function (response) {
          await window.api.verifyRazorpayPayment({
            ...response,
            planId
          });
          setMessage(`${plan.name} payment successful. Subscription activated.`);
          await load();
        },
        theme: {
          color: "#c98710"
        }
      });

      razorpay.open();
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  load();
})();
