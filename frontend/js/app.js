(function () {
  const modalBackdrop = document.getElementById("authModalBackdrop");
  const closeModalButton = document.getElementById("closeModalButton");
  const authMessage = document.getElementById("authMessage");
  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  const charitySearch = document.getElementById("charitySearch");
  const primaryHeroAction = document.getElementById("primaryHeroAction");
  const secondaryHeroAction = document.getElementById("secondaryHeroAction");
  const navAdminLink = document.getElementById("navAdminLink");
  const navDashboardLink = document.getElementById("navDashboardLink");
  const homeLogoutButton = document.getElementById("homeLogoutButton");

  function setMessage(message, isError) {
    if (!authMessage) return;
    authMessage.textContent = message || "";
    authMessage.style.color = isError ? "#a12727" : "#319f78";
    if (message && window.showToast) {
      window.showToast(message, { type: isError ? "error" : "success" });
    }
  }

  function toggleTab(tab) {
    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authTab === tab);
    });
    signupForm.classList.toggle("hidden", tab !== "signup");
    loginForm.classList.toggle("hidden", tab !== "login");
  }

  function openModal(tab) {
    modalBackdrop.classList.remove("hidden");
    toggleTab(tab);
  }

  function closeModal() {
    modalBackdrop.classList.add("hidden");
    setMessage("");
  }

  function getSession() {
    return {
      token: localStorage.getItem("golf_charity_token"),
      role: localStorage.getItem("golf_charity_role")
    };
  }

  function renderAuthState() {
    const { token, role } = getSession();
    const loggedIn = Boolean(token);

    if (!loggedIn) {
      primaryHeroAction.textContent = "Start Subscription";
      primaryHeroAction.dataset.openModal = "signup";
      primaryHeroAction.onclick = null;
      secondaryHeroAction.textContent = "Use Demo Login";
      secondaryHeroAction.dataset.openModal = "login";
      secondaryHeroAction.classList.remove("hidden");
      navAdminLink.classList.remove("hidden");
      navDashboardLink.textContent = "Dashboard";
      homeLogoutButton.classList.add("hidden");
      return;
    }

    homeLogoutButton.classList.remove("hidden");
    primaryHeroAction.removeAttribute("data-open-modal");
    secondaryHeroAction.classList.add("hidden");
    navAdminLink.classList.toggle("hidden", role !== "admin");

    if (role === "admin") {
      primaryHeroAction.textContent = "Go To Admin Panel";
      primaryHeroAction.onclick = () => {
        window.location.href = "./admin.html";
      };
      navDashboardLink.textContent = "Admin";
      navDashboardLink.href = "./admin.html";
    } else {
      primaryHeroAction.textContent = "Open Dashboard";
      primaryHeroAction.onclick = () => {
        window.location.href = "./dashboard.html";
      };
      navDashboardLink.textContent = "Dashboard";
      navDashboardLink.href = "./dashboard.html";
    }
  }

  function renderStats(stats) {
    const grid = document.getElementById("statsGrid");
    if (!grid || !stats) return;
    const cards = [
      { label: "Active subscribers", value: stats.activeSubscribers },
      { label: "Charity partners", value: stats.charityPartners },
      { label: "Prize pool generated", value: `$${stats.totalPrizePool}` },
      { label: "Estimated charity impact", value: `$${stats.charityRaisedEstimate}` }
    ];
    grid.innerHTML = cards.map((card) => `<article class="stat-card glass"><strong>${card.value}</strong><span>${card.label}</span></article>`).join("");
  }

  function renderDrawBalls(draw) {
    const ballContainer = document.getElementById("latestDrawBalls");
    const month = document.getElementById("latestDrawMonth");
    const prizePool = document.getElementById("latestPrizePool");
    if (!ballContainer) return;
    if (!draw) {
      ballContainer.innerHTML = "<p class='soft'>No published draw yet.</p>";
      return;
    }
    ballContainer.innerHTML = draw.numbers.map((num) => `<span class="ball">${num}</span>`).join("");
    month.textContent = draw.month;
    prizePool.textContent = `$${draw.prizePool.total}`;
  }

  function renderPlans(plans) {
    const target = document.getElementById("planGrid");
    const signupPlanSelect = document.getElementById("signupPlanSelect");
    if (!target || !signupPlanSelect) return;
    target.innerHTML = plans
      .map((plan) => `<article class="plan-card glass"><h3>${plan.name}</h3><p class="lede">$${plan.price}</p><p class="soft">Billed per ${plan.billingCycle}. Includes draw access and charity contribution settings.</p></article>`)
      .join("");
    signupPlanSelect.innerHTML = plans.map((plan) => `<option value="${plan.id}">${plan.name} - $${plan.price}</option>`).join("");
  }

  function renderCharities(charities) {
    const grid = document.getElementById("charityGrid");
    const signupCharitySelect = document.getElementById("signupCharitySelect");
    if (!grid || !signupCharitySelect) return;
    grid.innerHTML = charities
      .map((charity) => `<article class="charity-card glass"><img src="${charity.image}" alt="${charity.name}" /><p class="eyebrow">${charity.category}</p><h3>${charity.name}</h3><p>${charity.description}</p><p class="soft">${charity.location} • ${charity.upcomingEvent}</p></article>`)
      .join("");
    signupCharitySelect.innerHTML = charities.map((charity) => `<option value="${charity.id}">${charity.name}</option>`).join("");
  }

  function renderDrawHistory(draws) {
    const target = document.getElementById("drawHistory");
    if (!target) return;
    target.innerHTML = draws
      .map((draw) => `<article class="result-card"><strong>${draw.month} • ${draw.mode}</strong><p>${draw.numbers.join(" • ")}</p><span class="soft">Prize pool: $${draw.prizePool.total} | Carryover: $${draw.jackpotCarryover || 0}</span></article>`)
      .join("");
  }

  async function load() {
    try {
      const [overview, charities, draws] = await Promise.all([window.api.getOverview(), window.api.getCharities(), window.api.getDraws()]);
      renderStats(overview.stats);
      renderDrawBalls(overview.latestDraw);
      renderPlans(overview.plans);
      renderCharities(charities.items);
      renderDrawHistory(draws.items);
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.openModal) {
        openModal(button.dataset.openModal);
      }
    });
  });
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => toggleTab(button.dataset.authTab));
  });
  if (closeModalButton) closeModalButton.addEventListener("click", closeModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (event) => {
      if (event.target === modalBackdrop) closeModal();
    });
  }
  if (charitySearch) {
    charitySearch.addEventListener("input", async (event) => {
      const response = await window.api.getCharities(event.target.value);
      renderCharities(response.items);
    });
  }

  homeLogoutButton.addEventListener("click", () => {
    localStorage.removeItem("golf_charity_token");
    localStorage.removeItem("golf_charity_role");
    renderAuthState();
    window.showToast("Logged out.");
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(signupForm).entries());
      const response = await window.api.signup(payload);
      localStorage.setItem("golf_charity_token", response.token);
      localStorage.setItem("golf_charity_role", response.user.role);
      window.location.href = "./dashboard.html";
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(loginForm).entries());
      const response = await window.api.login(payload);
      localStorage.setItem("golf_charity_token", response.token);
      localStorage.setItem("golf_charity_role", response.user.role);
      window.location.href = response.user.role === "admin" ? "./admin.html" : "./dashboard.html";
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  renderAuthState();
  load();
})();
