Fine LP Swap — AMM Liquidity Pool & Token Swap Interface (Sepolia)

A lightweight DeFi swap interface for interacting with a custom AMM liquidity pool deployed on Ethereum Sepolia Testnet.
Users can:

Swap tokens through your custom AMM

Add/remove liquidity

View pool reserves and price impact

Execute real on-chain transactions using MetaMask

🚀 Live Demo:
https://fine-lp-swap.vercel.app/

🔗 Smart Contracts (Verified on Routescan):

AMM / Liquidity Pool Contract: 0xe051C1eA47b246c79f3bac4e58E459cF2Aa20692

Token Contract: 0x0FB987BEE67FD839cb1158B0712d5e4Be483dd2E

🌐 Project Overview

This application provides a simple UI for interacting with the custom AMM powering your DeFi ecosystem.
It allows users to:

Provide liquidity

Withdraw liquidity

Swap between tokens

View expected output, slippage, and reserves

It is built with Next.js + TypeScript, and connects to Ethereum via Wagmi + Ethers.

🎯 Core Features
🔄 Token Swaps

Swap between Token A ↔ Token B

Automated calculation of output amount

Slippage + minimum received protection

Wallet-connected on-chain execution

💧 Liquidity Management

Add liquidity (deposit both tokens)

Remove liquidity

Receive LP shares

View pool share and reserves

📊 AMM Mechanics

Constant product formula:

x * y = k


Price curve updates dynamically

Real-time reserve fetching

🧱 Architecture
Frontend (Next.js / TS)
│
├─ Wallet connection (wagmi)
├─ Reads AMM state (reserves, LP balance)
├─ Executes swap and liquidity transactions
└─ Performs AMM math client-side for previews

Smart Contracts (Solidity)
│
└─ AMM Liquidity Pool
      - addLiquidity()
      - removeLiquidity()
      - swapExactTokens()
      - getReserves()

📂 Repository Structure
app/
  ├─ swap page UI
  ├─ liquidity page UI
public/
  ├─ assets, icons
lib/          (recommended to add)
  ├─ contract ABIs
  ├─ blockchain utilities

🔧 Getting Started
1. Install dependencies
npm install

2. Create .env.local
NEXT_PUBLIC_RPC_URL="https://sepolia.infura.io/v3/ec868129390f4ee3b4c27d2a93ffb796"
NEXT_PUBLIC_TOKEN_ADDRESS="0x0FB987BEE67FD839cb1158B0712d5e4Be483dd2E"
NEXT_PUBLIC_SWAP_ADDRESS="0xe051C1eA47b246c79f3bac4e58E459cF2Aa20692"

3. Start the dev server
npm run dev


Then open:
http://localhost:3000/

📈 How Swaps Work (Simplified)

Your AMM uses the constant product formula:

x * y = k


Where:

x = reserve of Token A

y = reserve of Token B

k = constant value

When the user swaps:

UI reads current reserves

Calculates output token amount

Shows minimum received (slippage protection)

Sends transaction via wallet

Contract updates reserves and emits events

📦 Tech Stack

Next.js 14

React

TypeScript

TailwindCSS

Ethers.js

Wagmi

Vercel Deployment

🚀 Deployment

Your project is deployed automatically on Vercel:

git push origin main


Vercel rebuilds the app and publishes instantly.

🗺️ Roadmap (recommended future upgrades)

Add chart for price impact vs trade size

Show LP token balances visually

Pool analytics page (TVL, volume)

Dark mode

Add notifications for transactions

🤝 Contributing

Contributions are welcome. Open an issue for bugs or feature ideas.

📜 License

MIT
