(function () {
  const adminMessage = document.getElementById("adminMessage");
  const adminLogoutButton = document.getElementById("adminLogoutButton");
  const simulateDrawForm = document.getElementById("simulateDrawForm");
  const publishDrawButton = document.getElementById("publishDrawButton");
  const charityForm = document.getElementById("charityForm");
  const adminGate = document.getElementById("adminGate");
  const adminDashboard = document.getElementById("adminDashboard");
  const adminLoginForm = document.getElementById("adminLoginForm");
  const adminCreateForm = document.getElementById("adminCreateForm");

  function setMessage(message, isError) {
    adminMessage.textContent = message || "";
    adminMessage.style.color = isError ? "#a12727" : "#319f78";
    if (message && window.showToast) {
      window.showToast(message, { type: isError ? "error" : "success" });
    }
  }

  function showAdminGate() {
    adminGate.classList.remove("hidden");
    adminDashboard.classList.add("hidden");
  }

  function showAdminDashboard() {
    adminGate.classList.add("hidden");
    adminDashboard.classList.remove("hidden");
  }

  function hasAdminSession() {
    return localStorage.getItem("golf_charity_role") === "admin" && localStorage.getItem("golf_charity_token");
  }

  function hasAnySession() {
    return Boolean(localStorage.getItem("golf_charity_token"));
  }

  function statCard(label, value) {
    return `<article class="stat-card glass"><strong>${value}</strong><span>${label}</span></article>`;
  }

  function buildCharityOptions(charities, selectedId) {
    return charities.map((charity) => (
      `<option value="${charity.id}" ${charity.id === selectedId ? "selected" : ""}>${charity.name}</option>`
    )).join("");
  }

  function buildSubscriptionText(user) {
    if (!user.subscription) {
      return "Admin account • no subscriber plan";
    }

    const paymentState = user.subscription.activatedByPayment ? (user.subscription.paymentProvider || "verified") : "awaiting payment";
    return `${user.subscription.status} • ${user.subscription.planId} • ${paymentState}`;
  }

  function renderUserEditor(user, charities) {
    if (user.role === "admin") {
      return `
        <form class="row-card admin-user-editor" data-user-form="${user.id}">
          <div class="admin-user-header">
            <div>
              <strong>${user.name}</strong>
              <span class="admin-detail-meta">${user.role}</span>
            </div>
            <button class="button button-primary" type="submit">Save admin</button>
          </div>
          <div class="admin-user-grid">
            <label>
              <span class="soft">Full name</span>
              <input class="input" name="name" value="${user.name}" required />
            </label>
            <label>
              <span class="soft">Email</span>
              <input class="input" value="${user.email}" disabled />
            </label>
          </div>
          <p class="soft admin-user-note">Admin accounts do not need subscriber plan or charity details.</p>
        </form>
      `;
    }

    const subscription = user.subscription || {};
    return `
      <form class="row-card admin-user-editor" data-user-form="${user.id}">
        <div class="admin-user-header">
          <div>
            <strong>${user.name}</strong>
            <span class="admin-detail-meta">${user.role}</span>
          </div>
          <button class="button button-primary" type="submit">Save subscriber</button>
        </div>
        <div class="admin-user-grid">
          <label>
            <span class="soft">Full name</span>
            <input class="input" name="name" value="${user.name}" required />
          </label>
          <label>
            <span class="soft">Email</span>
            <input class="input" value="${user.email}" disabled />
          </label>
          <label>
            <span class="soft">Subscription status</span>
            <select class="input" name="subscriptionStatus">
              <option value="pending" ${subscription.status === "pending" ? "selected" : ""}>Pending payment</option>
              <option value="active" ${subscription.status === "active" ? "selected" : ""}>Active</option>
              <option value="cancelled" ${subscription.status === "cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
          </label>
          <label>
            <span class="soft">Plan</span>
            <select class="input" name="planId">
              <option value="monthly" ${subscription.planId === "monthly" ? "selected" : ""}>Monthly</option>
              <option value="yearly" ${subscription.planId === "yearly" ? "selected" : ""}>Yearly</option>
            </select>
          </label>
          <label>
            <span class="soft">Charity</span>
            <select class="input" name="charityId">
              ${buildCharityOptions(charities, user.charityId)}
            </select>
          </label>
          <label>
            <span class="soft">Contribution %</span>
            <input class="input" name="charityPercentage" type="number" min="10" value="${user.charityPercentage || 10}" required />
          </label>
        </div>
        <p class="soft admin-user-note">Current subscription: ${buildSubscriptionText(user)}</p>
      </form>
    `;
  }

  function attachUserFormHandlers() {
    document.querySelectorAll("[data-user-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const payload = Object.fromEntries(new FormData(form).entries());
          await window.api.updateAdminUser(form.dataset.userForm, payload);
          setMessage("User updated.");
          await load();
        } catch (error) {
          setMessage(error.message, true);
        }
      });
    });
  }

  function attachCharityDeleteHandlers() {
    document.querySelectorAll("[data-delete-charity]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await window.api.deleteCharity(button.dataset.deleteCharity);
          setMessage("Charity deleted.");
          await load();
        } catch (error) {
          setMessage(error.message, true);
        }
      });
    });
  }

  function renderSummary(data) {
    document.getElementById("adminStats").innerHTML = [
      statCard("Total users", data.summary.totalUsers),
      statCard("Active subscribers", data.summary.activeSubscribers),
      statCard("Prize pool total", `$${data.summary.totalPrizePool}`),
      statCard("Charity contributions", `$${data.summary.charityContributionTotals}`)
    ].join("");

    document.getElementById("adminUsers").innerHTML = data.users.length
      ? data.users.map((user) => renderUserEditor(user, data.charities)).join("")
      : "<p class='soft'>No users found.</p>";

    document.getElementById("adminCharities").innerHTML = data.charities.length
      ? data.charities
          .map((charity) => `
            <article class="row-card charity-admin-card">
              <strong>${charity.name}</strong>
              <span>${charity.category} • ${charity.location}</span>
              <span>${charity.description}</span>
              <span class="soft">Upcoming event: ${charity.upcomingEvent}</span>
              <div class="charity-admin-actions">
                <button class="button button-secondary" data-delete-charity="${charity.id}">Delete charity</button>
              </div>
            </article>
          `)
          .join("")
      : "<p class='soft'>No charities found.</p>";

    attachUserFormHandlers();
    attachCharityDeleteHandlers();
  }

  function renderSimulation(result) {
    document.getElementById("drawSimulationResult").innerHTML = `
      <article class="result-card">
        <strong>Preview draw • ${result.preview.mode}</strong>
        <span>${result.preview.numbers.join(" • ")}</span>
        <span class="soft">Prize pool: $${result.preview.prizePool.total}</span>
        <span class="soft">Potential carryover: $${result.jackpotCarryoverIfUnclaimed}</span>
      </article>
      ${(result.winners || []).length
        ? result.winners.map((winner) => `<article class="row-card"><strong>${winner.userId}</strong><span>${winner.tier.toUpperCase()} match • $${winner.amount}</span></article>`).join("")
        : "<p class='soft'>No projected winners for this simulation.</p>"}
    `;
  }

  async function renderWinners() {
    const response = await window.api.getWinners();
    document.getElementById("winnerList").innerHTML = response.items.length
      ? response.items
          .map((winner) => `
            <article class="row-card">
              <strong>${winner.userName}</strong>
              <span>${winner.userEmail}</span>
              <span>${winner.drawMonth} • ${winner.tier.toUpperCase()} match • $${winner.amount}</span>
              <span class="soft">Proof: ${winner.proofStatus} | Payout: ${winner.status}</span>
              <div class="button-row">
                <button class="button button-secondary" data-verify="${winner.id}" data-action="approve">Approve</button>
                <button class="button button-secondary" data-verify="${winner.id}" data-action="reject">Reject</button>
                <button class="button button-primary" data-payout="${winner.id}" ${winner.status === "paid" ? "disabled" : ""}>Mark paid</button>
              </div>
            </article>
          `)
          .join("")
      : "<p class='soft'>No winners yet.</p>";

    document.querySelectorAll("[data-verify]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await window.api.verifyWinner(button.dataset.verify, { action: button.dataset.action });
          setMessage(`Winner ${button.dataset.action}d.`);
          await load();
        } catch (error) {
          setMessage(error.message, true);
        }
      });
    });

    document.querySelectorAll("[data-payout]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await window.api.payoutWinner(button.dataset.payout);
          setMessage("Payout marked as completed.");
          await load();
        } catch (error) {
          setMessage(error.message, true);
        }
      });
    });
  }

  async function load() {
    if (!hasAdminSession()) {
      if (hasAnySession()) {
        if (window.showToast) {
          window.showToast("This logged-in account is not an admin account.", { type: "error" });
        }
        window.location.href = "./dashboard.html";
        return;
      }
      showAdminGate();
      setMessage("Login as admin to access the dashboard.");
      return;
    }

    try {
      const summary = await window.api.adminSummary();
      showAdminDashboard();
      renderSummary(summary);
      await renderWinners();
    } catch (error) {
      if (/admin access required|invalid|missing auth token/i.test(error.message)) {
        localStorage.removeItem("golf_charity_token");
        localStorage.removeItem("golf_charity_role");
        showAdminGate();
      }
      setMessage(error.message, true);
    }
  }

  adminLogoutButton.addEventListener("click", () => {
    localStorage.removeItem("golf_charity_token");
    localStorage.removeItem("golf_charity_role");
    window.location.href = "./index.html";
  });

  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(adminLoginForm).entries());
      const response = await window.api.login(payload);
      if (response.user.role !== "admin") {
        throw new Error("This account is not an admin account.");
      }
      localStorage.setItem("golf_charity_token", response.token);
      localStorage.setItem("golf_charity_role", response.user.role);
      adminLoginForm.reset();
      setMessage("Admin login successful.");
      await load();
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  adminCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(adminCreateForm).entries());
      const response = await window.api.adminSignup(payload);
      localStorage.setItem("golf_charity_token", response.token);
      localStorage.setItem("golf_charity_role", response.user.role);
      adminCreateForm.reset();
      setMessage("Admin account created and logged in.");
      await load();
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  simulateDrawForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(simulateDrawForm).entries());
      const response = await window.api.simulateDraw(payload);
      renderSimulation(response);
      setMessage("Simulation complete.");
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  publishDrawButton.addEventListener("click", async () => {
    try {
      const payload = Object.fromEntries(new FormData(simulateDrawForm).entries());
      await window.api.publishDraw(payload);
      setMessage("Draw published.");
      await load();
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  charityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const formData = new FormData(charityForm);
      const payload = Object.fromEntries(formData.entries());
      payload.featured = formData.get("featured") === "on";
      await window.api.createCharity(payload);
      charityForm.reset();
      setMessage("Charity created.");
      await load();
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  load();
})();
