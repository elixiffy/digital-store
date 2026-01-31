const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const Stripe = require("stripe");
const path = require("path");
const crypto = require("crypto");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const products = [
  {
    id: "prod_1",
    name: "E-Book",
    price: 1500,
    filePath: path.join(__dirname, "downloads", "ebook.pdf"),
    fileName: "ebook.pdf",
  },
  {
    id: "prod_2",
    name: "Video Course",
    price: 3000,
    filePath: path.join(__dirname, "downloads", "course.zip"),
    fileName: "course.zip",
  },
];

const downloadTokens = new Map();
const sessionToToken = new Map();
const processedEvents = new Set();

app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://YOUR-NETLIFY-SITE.netlify.app"
  ]
}));


app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency: Stripe can retry webhooks
  if (processedEvents.has(event.id)) {
    return res.json({ received: true, deduped: true });
  }
  processedEvents.add(event.id);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // We stored productId in metadata earlier
    const productId = session?.metadata?.productId;
    const product = products.find(p => p.id === productId);

    if (product) {
      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

      downloadTokens.set(token, {
        filePath: product.filePath,
        fileName: product.fileName,
        expiresAt,
      });

      sessionToToken.set(session.id, token);
      console.log("Created download token for session:", session.id);
    } else {
      console.warn("Product not found for webhook session:", session.id, productId);
    }
  }

  res.json({ received: true });
});

app.get("/download-link", (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

  const token = sessionToToken.get(sessionId);
  if (!token) return res.status(404).json({ error: "Not ready yet" });

  const data = downloadTokens.get(token);
  if (!data) return res.status(410).json({ error: "Link expired" });

  res.json({
    fileName: data.fileName,
    downloadUrl: `${req.protocol}://${req.get("host")}/download/${token}`,
  });
});

app.listen(4242, () => {
  console.log("Server running on http://localhost:4242");
});


app.use(express.json());


