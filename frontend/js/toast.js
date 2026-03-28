(function () {
  const container = document.createElement("div");
  container.className = "toast-container";
  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(container);
  });

  window.showToast = function showToast(message, options = {}) {
    const { type = "success", duration = 3000 } = options;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Close">×</button>
    `;

    const removeToast = () => {
      toast.classList.add("toast-hide");
      window.setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector(".toast-close").addEventListener("click", removeToast);
    container.appendChild(toast);
    window.setTimeout(removeToast, duration);
  };
})();
