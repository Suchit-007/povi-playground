# 🔬 Proof of Verifiable Inference (PoVI)

[![License: MIT](https://img.shields.io/badge/License-MIT-34d399.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A trustless protocol for verifying client-side machine learning inference on decentralized ledgers without executing neural networks inside gas-constrained EVM environments.

---

## Overview

PoVI addresses a fundamental challenge in decentralized AI: **How can we cryptographically verify that a client-side model produced a specific prediction without running expensive neural network computations on-chain?**

This repository provides a complete sandbox environment demonstrating a practical solution — combining off-chain inference computation with on-chain verification and incentive mechanisms.

---

## Architecture

The protocol distributes computational responsibilities across two domains:

- **Off-Chain**: Model inference and cryptographic proof generation execute client-side using DistilBERT or heuristic-based classifiers
- **On-Chain**: A lightweight registry contract stores inference proofs, manages validator consensus, and distributes ERC-20 token rewards

```mermaid
graph TD
    classDef default fill:#151b23,stroke:#30363d,stroke-width:1px,color:#c9d1d9;
    classDef highlight fill:#1f2937,stroke:#00f5ff,stroke-width:1.5px,color:#f0f6fc;
    classDef success fill:#143224,stroke:#34d399,stroke-width:1.5px,color:#f0f6fc;
    classDef failure fill:#3c181e,stroke:#f87171,stroke-width:1.5px,color:#f0f6fc;

    A["1. Input text parameters"] --> B["2. Run Local ML Inference<br>(DistilBERT / Heuristics)"]:::highlight
    B --> C["3. Generate Cryptographic Proof<br>(SHA-256 Signature of Output)"]
    C --> D["4. Log to Smart Contract<br>(ModelRegistry Ledger)"]:::highlight
    D --> E{"5. Validator Audit"}
    E -- Approved --> F["6. Mint $INF Reward Tokens"]:::success
    E -- Rejected --> G["6. Close Log (No Rewards)"]:::failure
```

---

## Repository Structure

```
.
├── src/app/                    # Next.js frontend application
│   ├── page.tsx                # Dashboard, telemetry, leaderboard, and validation interfaces
│   ├── globals.css             # Custom styling with ambient effects and glassmorphic components
│   └── web3.ts                 # Ethers.js integration for blockchain connectivity
├── contracts/                  # Solidity smart contracts
│   ├── ModelRegistry.sol       # Inference proof logging and validator approval management
│   └── InferenceToken.sol      # ERC-20 token ($INF) for validator rewards
└── scripts/
    └── deploy.js               # Contract compilation and deployment automation
```

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later recommended)

### Installation & Setup

**1. Install dependencies**
```bash
npm install
```

**2. Launch local blockchain node**
```bash
npx hardhat node
```
Runs on `http://127.0.0.1:8545` with pre-funded accounts.

**3. Deploy smart contracts**
```bash
npx hardhat run scripts/deploy.js --network localhost
```
Contract addresses and ABIs are automatically written to `src/app/contracts.json`.

**4. Start the development server**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

---

## License

This project is distributed under a dual-license model:

### MIT License
You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software for any purpose, subject to the conditions of the MIT License.

### Contributor Covenant
- **Transparency**: Commercial deployments built on this protocol must maintain publicly accessible validation metrics.
- **Reciprocity**: Improvements to verification efficiency or proof generation security should be contributed back via Pull Request when feasible.

---

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request.
