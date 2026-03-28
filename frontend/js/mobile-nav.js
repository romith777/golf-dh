(function () {
  function closeMenus() {
    document.querySelectorAll("[data-mobile-nav]").forEach((nav) => nav.classList.remove("mobile-open"));
    document.querySelectorAll("[data-mobile-menu-toggle]").forEach((button) => button.classList.remove("is-open"));
  }

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-mobile-menu-toggle]");
    if (toggle) {
      const nav = toggle.parentElement.querySelector("[data-mobile-nav]");
      const willOpen = !nav.classList.contains("mobile-open");
      closeMenus();
      if (willOpen) {
        nav.classList.add("mobile-open");
        toggle.classList.add("is-open");
      }
      return;
    }

    if (!event.target.closest("[data-mobile-nav]")) {
      closeMenus();
    }
  });
})();
