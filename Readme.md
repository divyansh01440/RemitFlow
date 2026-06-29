# RemitFlow Polygon 🌐

> Cross-border USDC remittance on the Polygon blockchain — send money globally in seconds for pennies.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Polygon](https://img.shields.io/badge/Polygon-Amoy%20Testnet-8247e5)](https://polygon.technology/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636)](https://soliditylang.org/)

---

## 🌍 What is RemitFlow?

RemitFlow is a decentralized web app that lets anyone send USDC stablecoins across borders instantly using the Polygon blockchain — no bank account needed. Instead of waiting days and paying high fees with traditional services, transfers arrive in under 2 seconds with only a 0.3% fee. Users can also deposit idle USDC into the built-in savings pool and earn 5% APY yield, withdrawable at any time.

---

## ✨ Features

- 💸 **Send USDC Globally** — Transfer to any wallet address worldwide in under 2 seconds
- 💰 **Near-Zero Fees** — Only 0.3% per transfer, gas fees under $0.01 on Polygon
- 📈 **Earn 5% APY Yield** — Deposit idle USDC and earn interest with no lock-up period
- 🦊 **MetaMask Login** — No username or password — your wallet is your account
- 🔍 **Transaction History** — View all past transfers with status tracking and CSV export
- 🔒 **Fully Decentralized** — Smart contracts on Polygon, no middlemen or custodians
- 📊 **Live Exchange Rates** — See real-time USDC rates in INR, EUR, NGN, PHP and more
- 🌙 **Dark UI** — Clean, modern interface built with Tailwind CSS

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.20 + OpenZeppelin |
| Blockchain Dev | Hardhat + ethers.js v6 |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Wallet | wagmi v2 + viem |
| Backend API | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Blockchain | Polygon (Amoy Testnet / Mainnet) |
| RPC Provider | Alchemy |
| Notifications | SendGrid |

---

## 📋 Prerequisites

Make sure you have these installed before starting:

- **Node.js v18+** — [Download here](https://nodejs.org)
```bash
  node --version   # Should show v18.0.0 or higher
```

- **Git** — [Download here](https://git-scm.com)
```bash
  git --version
```

- **MetaMask** browser extension — [Download here](https://metamask.io)

- **Alchemy account** (free) — [Sign up here](https://alchemy.com)

- **MongoDB Atlas account** (free) — [Sign up here](https://mongodb.com)

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/remitflow-polygon.git
cd remitflow-polygon
```

### 2. Set up environment variables
```bash
# Copy the example env file
cp .env.example .env

# Fill in your values (see Environment Variables section below)
nano .env
```

### 3. Install dependencies for all parts
```bash
# Install Hardhat dependencies
cd hardhat && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..
```

### 4. Compile smart contracts
```bash
cd hardhat
npx hardhat compile
```

### 5. Start local blockchain (Terminal 1)
```bash
cd hardhat
npx hardhat node
```

### 6. Deploy contracts (Terminal 2)
```bash
cd hardhat
npx hardhat run scripts/deploy.js --network localhost
# Copy the printed contract addresses to your .env file
```

### 7. Start the backend (Terminal 3)
```bash
cd backend
npm run dev
# Runs at http://localhost:4000
```

### 8. Start the frontend (Terminal 4)
```bash
cd frontend
npm run dev
# Runs at http://localhost:3000
```

### 9. Open the app
Connect MetaMask → Switch to Hardhat Local (chainId: 31337) → Start testing!

---

## 🔑 Environment Variables

Create a `.env` file in the root of the project with these values:

| Variable | Description | Where to Get |
|----------|-------------|-------------|
| `MONGODB_URI` | MongoDB connection string | [mongodb.com](https://mongodb.com) → Connect → Drivers |
| `POLYGON_RPC_URL` | Polygon mainnet RPC | [alchemy.com](https://alchemy.com) → Create App → Polygon Mainnet |
| `POLYGON_AMOY_RPC_URL` | Polygon Amoy testnet RPC | [alchemy.com](https://alchemy.com) → Create App → Polygon Amoy |
| `PRIVATE_KEY` | Deployer wallet private key | MetaMask → Account Details → Export Private Key |
| `POLYGONSCAN_API_KEY` | For contract verification | [polygonscan.com/apis](https://polygonscan.com/apis) |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed RemitFlow address | Printed after running deploy script |
| `NEXT_PUBLIC_USDC_ADDRESS` | USDC token address | Printed after running deploy script |
| `NEXT_PUBLIC_ALCHEMY_KEY` | Alchemy API key | [alchemy.com](https://alchemy.com) → App → API Key |
| `SENDGRID_API_KEY` | For email notifications (optional) | [sendgrid.com](https://sendgrid.com) |

### Example `.env`
```bash
# ⚠️ NEVER commit this file to git

# Database
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/remitflow

# Blockchain
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
POLYGONSCAN_API_KEY=YOUR_POLYGONSCAN_KEY

# Frontend (NEXT_PUBLIC_ prefix required for Next.js)
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT
NEXT_PUBLIC_USDC_ADDRESS=0xYOUR_USDC_ADDRESS
NEXT_PUBLIC_ALCHEMY_KEY=YOUR_ALCHEMY_KEY
```

---

## 📁 Project Structure
```remitflow-polygon/

│

├── 📁 hardhat/                    # Smart contract development

│   ├── contracts/

│   │   ├── RemitFlow.sol          # Main contract (send + yield)

│   │   ├── interfaces/

│   │   │   └── IRemitFlow.sol     # Contract interface

│   │   └── mocks/

│   │       └── MockUSDC.sol       # Fake USDC for testing

│   ├── scripts/

│   │   └── deploy.js              # Deployment script

│   ├── test/

│   │   └── RemitFlow.test.js      # Contract test suite

│   └── hardhat.config.js          # Hardhat configuration

│

├── 📁 frontend/                   # Next.js 14 web application

│   ├── app/

│   │   ├── page.tsx               # Landing page

│   │   ├── layout.tsx             # Root layout + navbar

│   │   ├── auth/page.tsx          # Wallet connect page

│   │   └── dashboard/

│   │       ├── page.tsx           # Main dashboard

│   │       ├── send/page.tsx      # Send USDC page

│   │       ├── history/page.tsx   # Transaction history

│   │       └── yield/page.tsx     # Savings/yield page

│   ├── components/

│   │   ├── WalletConnect.tsx      # MetaMask connect button

│   │   ├── SendForm.tsx           # Send USDC form

│   │   ├── TransactionCard.tsx    # Transaction list item

│   │   └── YieldDisplay.tsx       # Yield dashboard widget

│   ├── hooks/

│   │   ├── useWallet.ts           # Wallet state hook

│   │   ├── useRemitFlow.ts        # Contract interaction hook

│   │   └── useYield.ts            # Yield data hook

│   └── lib/

│       ├── contract.ts            # ABI + contract addresses

│       ├── wagmi.ts               # Wallet configuration

│       └── utils.ts               # Helper functions

│

├── 📁 backend/                    # Node.js Express API

│   ├── api/

│   │   ├── transactions.js        # Transaction endpoints

│   │   ├── rates.js               # Exchange rate endpoints

│   │   └── users.js               # User profile endpoints

│   ├── services/

│   │   ├── polygonService.js      # Blockchain queries

│   │   ├── rateService.js         # Live exchange rates

│   │   └── notificationService.js # Email notifications

│   ├── models/

│   │   ├── Transaction.js         # Transaction DB model

│   │   └── User.js                # User DB model

│   └── server.js                  # Express entry point

│

├── .env                           # Environment variables (never commit!)

├── .gitignore                     # Git ignore rules

└── README.md                      # You are here
```
---

## 🧪 Running Tests

### Run all smart contract tests
```bash
cd hardhat
npx hardhat test
```

### Run tests with gas report
```bash
cd hardhat
npx hardhat test --reporter gas
```

### Run test coverage
```bash
cd hardhat
npx hardhat coverage
```

### Expected output
RemitFlow

Deployment

✓ sets the correct USDC token address

✓ sets the correct owner

✓ sets feePercent to 30 basis points

sendRemittance
  ✓ transfers correct net amount to recipient
  ✓ sends correct fee to feeCollector
  ✓ emits RemittanceSent event
  ✓ reverts if amount is 0
  ✓ reverts if recipient is zero address
  ✓ reverts if sender has insufficient balance

calculateFee
  ✓ returns 0.3% of amount

Yield
  ✓ depositYield updates yieldBalance
  ✓ emits YieldDeposited event
  ✓ calculateYield returns > 0 after time passes
  ✓ withdrawYield transfers principal + yield back
  ✓ reverts if withdraw more than deposited

Admin
  ✓ owner can update feePercent
  ✓ non-owner cannot update feePercent
  ✓ owner can update feeCollector

  ---

## 🌐 Deployment

### Deploy to Polygon Amoy Testnet (Free)
```bash
# Get free test MATIC at https://faucet.polygon.technology
cd hardhat
npx hardhat run scripts/deploy.js --network amoy
```

### Deploy to Polygon Mainnet
```bash
cd hardhat
npx hardhat run scripts/deploy.js --network polygon
```

### Deploy frontend to Vercel
```bash
cd frontend
npx vercel --prod
```

---
---

<div align="center">
  <p>Built with ❤️ on Polygon</p>
  <p>
    <a href="https://polygon.technology">Polygon</a> •
    <a href="https://nextjs.org">Next.js</a> •
    <a href="https://hardhat.org">Hardhat</a> •
    <a href="https://wagmi.sh">wagmi</a>
  </p>
</div>