# 🚀 StarPips Premium Webinar Platform (Serverless & Zero-Cost)

Welcome to the **StarPips Webinar Platform**! This codebase is fully optimized for **Cloudflare Pages** (for the lightning-fast, static frontend pages) and **Cloudflare Workers** (for the serverless database, CRM sync, and automation backend APIs).

This entire stack is designed to run **100% on Cloudflare's free tier**, capable of handling millions of webinar attendees with **zero server costs**, **zero command-line operations**, and **instant, globally distributed performance**.

---

## 📂 Simplified Project Structure (Optimized for GitHub & Cloudflare)

When downloading or exporting this sandbox, your project files are organized as follows:

```text
├── index.html          <-- MAIN LANDING, COUNTDOWN & LIVE WEBINAR ROOM
├── admin.html          <-- WEBINAR CONTROL DESK (Admin CRM, AI chat generator, etc.)
├── replay.html         <-- WEBINAR REPLAY STAGE
├── js/
│   ├── index.js        <-- Client-side UI & Live Streaming Player Loop
│   ├── admin.js        <-- Admin CRM & Settings sync controller
│   └── player.js       <-- Dedicated video buffering & control engine
│
├── worker.js           <-- CLOUDFLARE WORKER FILE (Copy & paste this into the CF Dashboard!)
│
├── data/               <-- Local fallback data (Used only during sandbox preview)
│   ├── campaign.json   
│   └── leads.json      
├── server.js           <-- Sandbox Dev-Server Helper (Serves files & simulates APIs locally)
├── package.json        <-- Project metadata & sandbox local runner scripts
└── README.md           <-- This deployment and setup guide
```

---

## 🌐 Single Domain vs. Multi-Domain: Which is Better?

For the ultimate user experience, speed, and reliability, **we strongly recommend a Single Domain Setup**!

### 🟢 Option 1: Single Domain (Highly Recommended & Easiest)
*Example: You run everything on `webinar.starpipsforex.com`*
* **Why it's better:**
  * **Zero CORS issues:** Because the frontend pages and API worker run on the exact same domain, the browser does not perform preflight check-ups. This makes registration, chat messages, and webhooks load **sub-milliseconds faster** and avoids all cross-origin browser security blocks.
  * **Simpler settings:** In your client-side JavaScript (`js/index.js` and `js/admin.js`), you can use clean relative URLs like `/api/register` and `/api/campaign`. The browser automatically routes requests to your worker!
  * **Higher credibility:** Your attendees see a single, clean URL in their browser bar.

### 🟡 Option 2: Multi-Domain (Separate Subdomains)
*Example: Static Pages on `webinar.starpipsforex.com` and API Worker on `api.starpipsforex.com` or `starpips-worker.workers.dev`*
* **Pros & Cons:**
  * Requires setting up CORS headers (we already built CORS into our `worker.js` for you).
  * If the worker domain suffers configuration errors, the registration form will fail.
  * You will have to replace relative API paths in your frontend JS with the absolute Worker URL.

---

## ⚡ 100% Browser-Based Cloudflare Setup (No Terminal / No Commands Required!)

Follow these simple steps directly on your Cloudflare browser dashboard to go live in minutes.

### 📁 STEP 1: Deploy the Static Frontend to Cloudflare Pages
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left sidebar, click **Workers & Pages** -> **Pages**.
3. Click **Create application** -> select the **Upload assets** tab.
4. Name your project (e.g., `starpips-webinar`).
5. Drag and drop the static files directly:
   * Drag your **`index.html`**, **`admin.html`**, **`replay.html`**, and the **`js`** folder.
   * *(Do not upload server.js or package.json to Cloudflare Pages; they are only sandbox runners).*
6. Click **Deploy site**. Your high-performance frontend is live!

---

### 🛢️ STEP 2: Create a Cloudflare KV Database Namespace
Your worker needs a database to store leads, payments, and campaign configurations. We use Cloudflare KV (Key-Value) because it replicates instantly around the world for free.
1. In the Cloudflare Dashboard, go to **Workers & Pages** -> **KV**.
2. Click **Create namespace**.
3. Name it exactly: `STARPIPS_KV`.
4. Click **Add**.

---

### ⚙️ STEP 3: Create and Deploy the Cloudflare Worker API
1. In the Cloudflare Dashboard, go to **Workers & Pages** -> **Overview** -> click **Create application** -> **Create Worker**.
2. Name your worker (e.g., `starpips-api`).
3. Click **Deploy**.
4. Once deployed, click **Edit Code** to open the browser-based code editor.
5. In your local files, open **`worker.js`**, select all code, copy it, and paste it to replace everything inside the Cloudflare code editor.
6. Click **Save and deploy** on the top right.

---

### 🔗 STEP 4: Bind the Database and Add Environment Secrets
1. Go back to your newly created Worker details page.
2. Navigate to **Settings** -> **Variables**.
3. Scroll down to **KV Namespace Bindings** and click **Add binding**:
   * **Variable name:** `STARPIPS_KV`
   * **KV Namespace:** Select `STARPIPS_KV` from the dropdown.
4. Scroll up to **Environment Variables** and add your credentials:
   * `ADMIN_USER` = `admin` (or your custom admin login)
   * `ADMIN_PASS` = `StarPips2026!` (or your custom admin password)
   * `GEMINI_API_KEY` = (Your Gemini API key from AI Studio for automatic live chat script generation)
   * `PAYSTACK_SECRET_KEY` = (Your Paystack security key to verify webhooks)
5. Click **Save and Deploy**.

---

### 🔀 STEP 5: Map Custom Domain and Routing (Single Domain Setup)
To connect your static frontend pages and the serverless Worker backend under a single domain:
1. Go to your **Pages** project details -> **Custom domains** -> Click **Set up a custom domain** and add your domain (e.g. `webinar.starpipsforex.com`).
2. Go to your **Workers** project details -> **Triggers** -> Click **Add route**:
   * **Route:** `webinar.starpipsforex.com/api/*`
   * **Zone:** Select your domain zone.
   * *(Repeat this step to add `webinar.starpipsforex.com/auth/*` if you are using Zoho OAuth).*
3. Now, whenever a user lands on your webinar page and registers, the request goes instantly to the worker on the same domain without any CORS redirects!

---

### 🧪 What is `server.js` used for?
The `server.js` file is a local developer emulator. It mimics all of Cloudflare Worker's endpoints (Zoho Sync, lead recording, Gemini script generator, Selar webhooks) so you can edit, test, and preview the entire application directly inside this interactive AI Studio Sandbox preview before pushing to production! It is **never** uploaded to Cloudflare.
