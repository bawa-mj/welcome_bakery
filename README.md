# 🎂 EZmart — Welcome Bakery E-Commerce Backend & Frontend

A modern, fast, and light-weight full-stack e-commerce web application built for local bakeries. It supports Google OAuth Sign-In, automated Google Sheets order logging, cash on delivery (COD) & Razorpay UPI payment integration, and instant WhatsApp notification links.

---

## 🚀 Features

- **Google OAuth Authentication:** Secure and seamless sign-in verified via Google ID Tokens (No user limit).
- **Automated Order Logging:** Logs every incoming order straight to a Google Sheet (acting as the single source of truth).
- **Flexible Payment Methods:**
  - **COD (Cash on Delivery):** Instant confirmation + $20$ INR surcharge calculation.
  - **UPI / Razorpay Integration:** Online payments handled securely with webhook status updates.
- **WhatsApp Notification Link:** Auto-generates a pre-filled WhatsApp message link for the store owner with order details and customer delivery location.
- **Server-Side Price Calculation:** Prevents price tampering by re-calculating order totals strictly on the backend.
- **COOP & CORS Enabled:** Custom security headers configured to prevent Google OAuth popup blocking and cross-origin issues.
- **SEO & Google Search Console Ready:** Pre-configured with Schema.org JSON-LD, Open Graph tags, favicons, and Google Search Console meta tags.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.11+, FastAPI, Uvicorn, Pydantic, gspread, Google Auth Library, Razorpay SDK
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+), Google Sign-In SDK (GSI)
- **Database / Storage:** Google Sheets API (via Google Cloud Service Account)
- **Deployment:** Render (FastAPI Web Service)

---

## 📁 Project Layout

```text
sahil_bakery/
├── backend/
│   ├── main.py              # FastAPI application, routes, and StaticFiles mount
│   ├── .env                 # Environment variables (IGNORED BY GIT)
│   └── service_account.json # Google Service Account credentials (IGNORED BY GIT)
├── frontend/
│   ├── index.html           # Main landing page & cake menu
│   ├── css/
│   │   └── styles.css       # Responsive styling
│   └── js/
│       └── main.js          # Google Sign-In & Cart/Order logic
├── .gitignore               # Git rules for hiding secrets & pycache
├── requirements.txt         # Backend Python dependencies
└── README.md                # Project documentation
