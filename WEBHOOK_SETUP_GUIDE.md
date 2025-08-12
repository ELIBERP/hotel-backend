# 🔔 Stripe Webhook Setup Guide - Complete Setup

## 🚀 Quick Start (Already have Stripe CLI?)

**❌ If you get "stripe is not recognized" error, you need to install Stripe CLI first. Skip to Part 1 below.**

If you already have Stripe CLI installed and just need to start listening:

```bash
# 1. Start your backend server
npm start

# 2. Open a new terminal and run:
stripe listen --forward-to localhost:3000/api/bookings/webhook --events checkout.session.completed

# 3. Copy the webhook secret (whsec_...) and add to your .env file:
# STRIPE_WEBHOOK_SECRET=whsec_your_secret_here

# 4. Restart your backend server
# Ctrl+C to stop, then npm start again

# 5. Test it works:
stripe trigger checkout.session.completed
```

## 🔧 Windows PowerShell Installation (Start Here!)

**You need to install Stripe CLI first. Choose ONE of these methods:**

### Method 1: Using Chocolatey (Recommended)
```powershell
# First install Chocolatey if you don't have it
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Then install Stripe CLI
choco install stripe-cli

# Verify installation
stripe --version
```

### Method 2: Direct Download (Alternative)
```powershell
# 1. Download from: https://github.com/stripe/stripe-cli/releases/latest
# 2. Look for: stripe_X.X.X_windows_x86_64.zip
# 3. Extract the zip file
# 4. Move stripe.exe to a folder in your PATH (e.g., C:\stripe\)
# 5. Add C:\stripe\ to your system PATH environment variable
```

### Method 3: Using Scoop (Alternative)
```powershell
# Install Scoop first
iwr -useb get.scoop.sh | iex

# Install Stripe CLI
scoop install stripe
```

### After Installation:
```powershell
# Login to Stripe
stripe login

# Now you can use the quick start commands above!
```

---

## Overview
This guide will walk you through setting up Stripe webhooks from scratch on a new terminal/machine for both development and production environments.

## 📋 Prerequisites
- Node.js and npm installed
- Your hotel booking application cloned
- Database set up and running
- Stripe account created

---

## 🛠️ Part 1: Initial Stripe CLI Setup

### Step 1: Install Stripe CLI

#### Windows (PowerShell - Run as Administrator):

**Method 1: Using Chocolatey (Easiest)**
```powershell
# Install Chocolatey package manager (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Stripe CLI
choco install stripe-cli

# Verify installation
stripe --version
```

**Method 2: Using Scoop**
```powershell
# Install Scoop (if not installed)
iwr -useb get.scoop.sh | iex

# Install Stripe CLI
scoop install stripe
```

**Method 3: Manual Download**
```powershell
# 1. Go to: https://github.com/stripe/stripe-cli/releases/latest
# 2. Download: stripe_X.X.X_windows_x86_64.zip
# 3. Extract to C:\stripe\
# 4. Add C:\stripe\ to your PATH environment variable
# 5. Restart PowerShell and test: stripe --version
```

#### macOS:
```bash
# Using Homebrew
brew install stripe/stripe-cli/stripe

# Or using curl
curl -L "https://github.com/stripe/stripe-cli/releases/latest/download/stripe_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m).tar.gz" | tar -xz
sudo mv stripe /usr/local/bin/
```

#### Linux:
```bash
# Download and install
curl -L "https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz" | tar -xz
sudo mv stripe /usr/local/bin/
```

### Step 2: Verify Installation
```bash
stripe --version
```

### Step 3: Login to Stripe
```bash
stripe login
```
- This will open your browser
- Login to your Stripe account
- Authorize the CLI access

---

## 🏗️ Part 2: Development Environment Setup

### Step 1: Project Environment Setup

#### Navigate to your backend directory:
```bash
cd path/to/your/hotel-backend
```

#### Install dependencies (if not done):
```bash
npm install
```

#### Check your .env file:
```bash
# Create or update .env file
touch .env  # Linux/macOS
# or
echo. > .env  # Windows
```

Add these variables to your `.env` file:
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=  # We'll fill this in step 3

# Server Configuration
PORT=3000
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hotel_booking_db
```

### Step 2: Get Your Stripe Keys

#### From Stripe Dashboard:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API Keys**
3. Copy your **Test** keys (for development):
   - Publishable key: `pk_test_...`
   - Secret key: `sk_test_...`
4. Update your `.env` file with these keys

### Step 3: Set Up Local Webhook Forwarding

#### Start your backend server:
```bash
npm start
# or
node index.js
```
Your server should be running on `http://localhost:3000`

#### In a new terminal, start Stripe webhook forwarding:

**Basic command:**
```bash
stripe listen --forward-to localhost:3000/api/bookings/webhook
```

**With specific events (recommended):**
```bash
stripe listen --forward-to localhost:3000/api/bookings/webhook --events checkout.session.completed
```

**Expected output:**
```
> Ready! Your webhook signing secret is whsec_1234567890abcdef...
> Forwarding events to localhost:3000/api/bookings/webhook
> Listening for events...
```

#### IMPORTANT: Copy the webhook secret shown and add to .env:
```env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

#### Quick Command Reference:
```bash
# Check if Stripe CLI is working
stripe --version

# Login to Stripe (if not done already)
stripe login

# Start listening (basic)
stripe listen --forward-to localhost:3000/api/bookings/webhook

# Start listening with specific events
stripe listen --forward-to localhost:3000/api/bookings/webhook --events checkout.session.completed

# Test trigger a webhook event
stripe trigger checkout.session.completed

# View recent events
stripe events list --limit 10
```

#### Restart your backend server to load the new secret:
```bash
# Stop server (Ctrl+C) and restart
npm start
```

### Step 4: Test the Development Setup

#### Trigger a test webhook:
```bash
# In another terminal
stripe trigger checkout.session.completed
```

#### Check your server logs for:
```
🔔 Webhook received: checkout.session.completed
✅ Webhook signature verified
💳 Processing payment session: cs_test_...
✅ Test webhook processed successfully
```

---

## 🚀 Part 3: Production Environment Setup

### Step 1: Deploy Your Application

#### Make sure your production environment has:
- Your application deployed and running
- Database connected and accessible
- SSL certificate installed (HTTPS required for webhooks)
- Environment variables properly set

### Step 2: Configure Production Webhook Endpoint

#### In Stripe Dashboard:
1. Go to **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Enter your production URL:
   ```
   https://yourdomain.com/api/bookings/webhook
   ```
4. Select events to listen for:
   - ✅ `checkout.session.completed`
5. Click **"Add endpoint"**

### Step 3: Get Production Webhook Secret

#### After creating the endpoint:
1. Click on your newly created webhook endpoint
2. Click **"Reveal signing secret"**
3. Copy the secret (starts with `whsec_`)
4. Add to your production environment variables:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret
   ```

### Step 4: Update Production Stripe Keys

#### Switch to Live Keys:
1. In Stripe Dashboard, toggle to **"Live"** mode (top right)
2. Go to **Developers** → **API Keys**
3. Copy your **Live** keys:
   - Publishable key: `pk_live_...`
   - Secret key: `sk_live_...`
4. Update your production environment:
   ```env
   STRIPE_SECRET_KEY=sk_live_your_live_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
   ```

### Step 5: Test Production Webhook

#### Method 1: Real Payment Test
1. Make a real booking with a real payment method
2. Check server logs for webhook processing
3. Verify booking creation in database

#### Method 2: Dashboard Test
1. Go to **Developers** → **Webhooks**
2. Click on your production endpoint
3. Click **"Send test webhook"**
4. Select `checkout.session.completed`
5. Click **"Send test webhook"**

---

## 🔍 Part 4: Verification & Troubleshooting

### Verify Your Setup Works

#### Check these components:
1. **Backend webhook endpoint responds:**
   ```bash
   curl -X POST https://yourdomain.com/api/bookings/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

2. **Database connection works:**
   ```bash
   # Check if you can connect to your database
   # Run a simple query to verify
   ```

3. **Environment variables loaded:**
   ```javascript
   // Add this to your server for testing
   console.log('Webhook secret loaded:', !!process.env.STRIPE_WEBHOOK_SECRET);
   console.log('Stripe key loaded:', !!process.env.STRIPE_SECRET_KEY);
   ```

### Common Issues & Solutions

#### Issue 1: "Webhook signature verification failed"
```bash
# Solution: Check webhook secret
echo $STRIPE_WEBHOOK_SECRET  # Should start with whsec_
```

#### Issue 2: "Cannot connect to database"
```bash
# Solution: Verify database connection
# Check DB_HOST, DB_USER, DB_PASSWORD in .env
```

#### Issue 3: "404 Not Found" for webhook endpoint
```bash
# Solution: Verify route is registered
# Check that webhook route is added BEFORE body parser
```

#### Issue 4: Development webhook not receiving events
```bash
# Solution: Restart stripe listen
stripe listen --forward-to localhost:3000/api/bookings/webhook
```

### Webhook Logs to Watch For

#### Successful webhook processing:
```
🔔 Webhook received: checkout.session.completed
✅ Webhook signature verified
💳 Payment successful via webhook: cs_live_...
✅ Booking created with ID: booking_12345
✅ Payment session marked as completed
```

#### Failed webhook processing:
```
❌ Webhook signature verification failed
❌ Database error: [specific error]
❌ Invalid session data: [details]
```

---

## 📝 Part 5: Environment Configuration Summary

### Development (.env):
```env
# Development Stripe Keys
STRIPE_SECRET_KEY=sk_test_your_test_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_dev_webhook_secret

# Local URLs
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Local Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hotel_booking_db
```

### Production (.env):
```env
# Production Stripe Keys
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret

# Production URLs
CLIENT_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Production Database
DB_HOST=your_production_db_host
DB_USER=your_production_db_user
DB_PASSWORD=your_production_db_password
DB_NAME=hotel_booking_db
```

---

## ✅ Success Checklist

### Development Environment:
- [ ] Stripe CLI installed and authenticated
- [ ] Local server running on port 3000
- [ ] Stripe webhook forwarding active
- [ ] Test webhook triggers successfully
- [ ] Database connection working
- [ ] Booking creation on webhook event

### Production Environment:
- [ ] Application deployed with HTTPS
- [ ] Production webhook endpoint created in Stripe Dashboard
- [ ] Live Stripe keys configured
- [ ] Production webhook secret set
- [ ] Real payment test successful
- [ ] Database booking creation verified

## 🚀 You're Ready!

Your webhook system is now configured for both development and production environments. Payments will automatically create bookings in your database when completed successfully.
