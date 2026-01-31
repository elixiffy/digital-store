const API_BASE = "http://localhost:4242";

const productsEl = document.getElementById("products");
const statusEl = document.getElementById("status");

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function loadProducts() {
  statusEl.textContent = "Loading products...";
  const res = await fetch(`${API_BASE}/products`);
  const products = await res.json();

  productsEl.innerHTML = products.map(p => `
    <div class="card">
      <h2>${p.name}</h2>
      <p class="price">${money(p.price)}</p>
      <button data-id="${p.id}">Buy</button>
    </div>
  `).join("");

  statusEl.textContent = "";
}

async function startCheckout(productId) {
  statusEl.textContent = "Creating checkout session...";
  const res = await fetch(`${API_BASE}/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId })
  });

  const data = await res.json();
  if (!data.url) {
    statusEl.textContent = "Checkout failed. Check backend logs.";
    return;
  }

  window.location.href = data.url;
}

productsEl.addEventListener("click", (e) => {
  if (e.target.tagName === "BUTTON") {
    startCheckout(e.target.dataset.id);
  }
});

loadProducts().catch(err => {
  console.error(err);
  statusEl.textContent = "Could not load products. Is the backend running?";
});
