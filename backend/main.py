"""
EZmart — backend
=======================
What this does:
  1. Verifies Google Sign-In tokens from the frontend (free, no user limit)
  2. Logs every order straight to a Google Sheet the moment it's placed
     (this is the "source of truth" — not WhatsApp)
  3. For COD orders: confirms immediately
  4. For UPI orders: creates a Razorpay order, and only marks the order
     "Paid" once Razorpay confirms payment via webhook
  5. Sends the owner a WhatsApp notification link back to the frontend
  6. Serves the frontend website itself (see the StaticFiles mount at the bottom)

Setup (all free unless noted):
  pip install -r requirements.txt
  Fill in the .env values described below, then:
  uvicorn main:app --reload
"""

import os
import json
import hmac
import hashlib
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

import gspread
from google.oauth2.service_account import Credentials as ServiceAccountCredentials

# import razorpay


# ---------------------------------------------------------------------------
# APP SETUP
# ---------------------------------------------------------------------------
app = FastAPI(title="EZmart backend")

# SECURITY: "*" is fine for local testing only. Before going live, change this
# to your real site, e.g. allow_origins=["https://layerandloaf.com"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "EZmart backend is running. Visit /docs to test endpoints."}


# ---------------------------------------------------------------------------
# CONFIG — read from environment variables, never hardcode real keys in code
# ---------------------------------------------------------------------------
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_SERVICE_ACCOUNT_FILE = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
GOOGLE_SHEET_NAME = os.environ.get("GOOGLE_SHEET_NAME", "EZmart Orders")

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")

OWNER_WHATSAPP = os.environ.get("OWNER_WHATSAPP", "916399791643")

razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# ---------------------------------------------------------------------------
# PRICING — the single source of truth for prices. Must match the frontend's
# FLAVORS list. SECURITY: never trust a price sent by the browser — always
# recompute it here, or a customer could edit the page and pay ₹10 for a cake.
# ---------------------------------------------------------------------------
PRICE_PER_POUND = {
    "choc": 150, "van": 130, "rv": 280,
    "bscotch": 130, "bf": 130, "pine": 130,
    "straw": 130, "darkchoc": 250, "mava": 300,
    "blueberry": 180, "mango": 189, "elaichi": 180,
    "blackcurrant": 180, "fruitcake": 300, "rasmalai": 300, "brownie": 350,
}
COD_SURCHARGE = 20


def calculate_total(flavor_id: str, weight_pound: int, payment_method: str) -> int:
    if flavor_id not in PRICE_PER_POUND:
        raise HTTPException(status_code=400, detail="Unknown flavour")
    base = PRICE_PER_POUND[flavor_id] * weight_pound
    return base + (COD_SURCHARGE if payment_method == "cod" else 0)


# ---------------------------------------------------------------------------
# GOOGLE SHEET CONNECTION
# ---------------------------------------------------------------------------
def get_sheet():
    """
    Connects to your Google Sheet using a free service account.
    One-time setup:
      1. console.cloud.google.com -> create a project (free)
      2. Enable "Google Sheets API"
      3. Create a Service Account -> download its JSON key -> save as service_account.json
      4. Share your Google Sheet with the service account's email
         (looks like xxx@xxx.iam.gserviceaccount.com) as an Editor
    """
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = ServiceAccountCredentials.from_service_account_file(GOOGLE_SERVICE_ACCOUNT_FILE, scopes=scopes)
    client = gspread.authorize(creds)
    return client.open(GOOGLE_SHEET_NAME).sheet1


def append_order_row(order: dict):
    try:
        sheet = get_sheet()
        order_number = len(sheet.get_all_values())  # header row + previous orders

        location_link = order.get("location_link") or ""

        sheet.append_row([
            order_number,
            order["order_id"],
            order["created_at"],
            order["customer_name"],
            order.get("customer_email") or "",
            order["phone"],
            order["flavor"],                  # cake name — flavour only, one column
            f"{order['weight_pound']} Pound",
            order.get("address") or "",       # typed address
            location_link,                    # raw map URL — Sheets auto-links it (USER_ENTERED below)
            order["payment_method"],
            order["status"],
            order["total"],
        ], value_input_option="USER_ENTERED")  # USER_ENTERED so Sheets auto-detects the URL and makes it clickable

        # Google Sheets sometimes auto-extends the header row's bold
        # formatting onto newly appended rows. Explicitly force this new
        # row back to plain (non-bold) text so it never inherits that.
        # Column J (the map link) is skipped so Sheets' auto blue+underline
        # link styling stays intact there.
        new_row_number = order_number + 1  # 1-indexed, header is row 1
        try:
            sheet.format(f"A{new_row_number}:I{new_row_number}", {"textFormat": {"bold": False}})
            sheet.format(f"K{new_row_number}:M{new_row_number}", {"textFormat": {"bold": False}})
        except Exception as fmt_err:
            print("Could not clear row formatting (non-fatal):", fmt_err)

        print(f"Order #{order_number} saved to sheet")

    except Exception as e:
        print("Google Sheet error:", e)
        raise HTTPException(status_code=500, detail="Failed to log order to Google Sheet")


def build_whatsapp_message(row: dict) -> str:
    msg = (
        f"New order — EZmart\n\n"
        f"Order ID: {row['order_id']}\n"
        f"Cake: {row['flavor']}\n"
        f"Cake Size: {row['weight_pound']} Pound\n"
        f"Name: {row['customer_name']}\n"
        f"Phone: {row['phone']}\n"
    )

    # Address and map link are different, useful info — show both when given.
    if row.get("address"):
        msg += f"Address: {row['address']}\n"
    if row.get("location_link"):
        msg += f"Live location: {row['location_link']}\n"

    msg += f"Payment: {row['payment_method'].upper()}\nTotal: Rs.{row['total']}"
    return urllib.parse.quote(msg)


# ---------------------------------------------------------------------------
# MODELS
# ---------------------------------------------------------------------------
class GoogleAuthRequest(BaseModel):
    credential: str  # the id_token from Google Sign-In on the frontend


class OrderRequest(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None  # from verified Google sign-in
    phone: str
    flavor: str            # display name, e.g. "Chocolate Truffle" — the only cake name we store
    flavor_id: str          # e.g. "choc" — must match PRICE_PER_POUND keys
    weight_pound: int       # in pounds, e.g. 1, 2, 3
    address: Optional[str] = None
    location_link: Optional[str] = None
    payment_method: str     # "cod" or "upi"
    total: int               # SECURITY: display-only, server recalculates and ignores this


# ---------------------------------------------------------------------------
# 1. GOOGLE LOGIN
# ---------------------------------------------------------------------------
@app.post("/auth/google")
def verify_google_login(body: GoogleAuthRequest):
    try:
        payload = id_token.verify_oauth2_token(body.credential, google_requests.Request(), GOOGLE_CLIENT_ID)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    return {
        "email": payload["email"],
        "name": payload.get("name"),
        "picture": payload.get("picture"),
    }


@app.get("/orders/mine")
def get_my_orders(email: str):
    """
    Returns past orders placed by this email address, most recent first.
    Reads directly from the Google Sheet — matches the column order used
    in append_order_row() above.
    """
    try:
        sheet = get_sheet()
        rows = sheet.get_all_values()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not read order history")

    if not rows:
        return {"orders": []}

    data_rows = rows[1:]  # skip header row
    orders = []
    for r in data_rows:
        if len(r) > 4 and r[4] == email:
            orders.append({
                "order_id": r[1] if len(r) > 1 else "",
                "created_at": r[2] if len(r) > 2 else "",
                "flavor": r[6] if len(r) > 6 else "",
                "weight": r[7] if len(r) > 7 else "",
                "status": r[11] if len(r) > 11 else "",
                "total": r[12] if len(r) > 12 else "",
            })

    orders.reverse()  # most recent first
    return {"orders": orders}


# ---------------------------------------------------------------------------
# 2. PLACE ORDER
#    COD -> confirmed immediately, logged to sheet, WhatsApp link returned
#    UPI -> logged as "Pending payment", Razorpay order created, NOT confirmed
#           until the webhook below fires
# ---------------------------------------------------------------------------
@app.post("/orders")
def place_order(order: OrderRequest):
    order_id = "ORD" + datetime.now().strftime("%Y%m%d%H%M%S")
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M")

    # SECURITY: recompute the price ourselves — never trust order.total from the browser
    real_total = calculate_total(order.flavor_id, order.weight_pound, order.payment_method)

    if order.payment_method == "cod":
        status = "Confirmed (COD)"
        row = {**order.dict(), "order_id": order_id, "created_at": created_at, "status": status, "total": real_total}
        append_order_row(row)

        whatsapp_link = f"https://wa.me/{OWNER_WHATSAPP}?text={build_whatsapp_message(row)}"
        return {"order_id": order_id, "status": status, "total": real_total, "whatsapp_link": whatsapp_link}

    elif order.payment_method == "upi":
        if not razorpay_client:
            raise HTTPException(status_code=500, detail="Payment gateway not configured yet")

        status = "Pending payment"
        row = {**order.dict(), "order_id": order_id, "created_at": created_at, "status": status, "total": real_total}
        append_order_row(row)  # logged now so nothing is lost, marked Paid later by webhook

        rp_order = razorpay_client.order.create({
            "amount": real_total * 100,  # paise
            "currency": "INR",
            "receipt": order_id,
            "notes": {"order_id": order_id},
        })
        return {
            "order_id": order_id,
            "status": status,
            "total": real_total,
            "razorpay_order_id": rp_order["id"],
            "razorpay_key_id": RAZORPAY_KEY_ID,
            "amount": real_total * 100,
        }

    else:
        raise HTTPException(status_code=400, detail="payment_method must be 'cod' or 'upi'")


# ---------------------------------------------------------------------------
# 3. RAZORPAY WEBHOOK — this is what actually confirms a UPI order.
#    Configure this URL in your Razorpay dashboard under Webhooks.
# ---------------------------------------------------------------------------
@app.post("/payment/webhook")
async def razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    expected_signature = hmac.new(RAZORPAY_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = json.loads(body)

    if payload.get("event") == "payment.captured":
        order_id = payload["payload"]["payment"]["entity"]["notes"].get("order_id")
        # TODO: find this order_id's row in the sheet and update its status to "Paid"
        # TODO: send the owner a WhatsApp/Cloud API notification now that payment is confirmed
        print(f"Payment captured for {order_id}")

    return {"received": True}


# ---------------------------------------------------------------------------
# SERVE THE FRONTEND
# Must come AFTER all API routes above, otherwise it would swallow requests
# meant for /orders, /auth/google, etc. Expected folder layout:
#   sahil_bakery/
#     backend/main.py           <- you are here
#     frontend/index.html
#     frontend/css/styles.css
#     frontend/js/main.js
# ---------------------------------------------------------------------------
app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")


# ---------------------------------------------------------------------------
# requirements.txt
# ---------------------------------------------------------------------------
# fastapi
# uvicorn
# pydantic
# python-dotenv
# google-auth
# gspread
# razorpay