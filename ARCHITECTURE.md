# Agrocylo-Global Architecture & Repository Map

This document explains the repository structure, the relationship between the two main applications (root `client/server` vs `agro-production/client/server`), and how the five deployable Soroban contract crates fit into the system.

---

## Overview

Agrocylo-Global is a dual-application Agro-DeFi platform on Stellar/Soroban:

1. **Root `client/` + `server/`** — Original marketplace application (peer-to-peer farmer-consumer trade with escrow)
2. **`agro-production/client/` + `agro-production/server/`** — Campaign-based production crowdfunding (investors fund agricultural campaigns and claim returns)

Both applications use Stellar wallets, on-chain escrow, and WebSocket-based real-time updates. They are **independent** but share some architectural patterns and contract infrastructure.

---

## Application Structure

### 1. Root Marketplace (`client/` + `server/`)

**Status:** Mature marketplace, lower active development priority than `agro-production/`
**Use case:** Peer-to-peer goods trade with immediate payment-on-delivery escrow

#### `client/`
- Next.js 16 (App Router), React 19
- **Wallet:** `@creit-tech/stellar-wallets-kit` (Freighter, Albedo, and other supported wallets)
- **State:** React Context (wallet, cart, orders, profile) + React Query
- **Features:**
  - Product listing and search
  - Order creation and tracking
  - Escrow state transitions (confirm/refund/dispute)
  - Notifications and real-time updates via Socket.io
- **Key files:**
  - `src/app/(root)/market/` — marketplace listing and product detail
  - `src/app/(root)/orders/` — order detail and management
  - `src/components/` — reusable UI components
  - `src/services/` and `src/lib/` — API and contract interaction
  - `src/context/` — global state (wallet, cart, orders, profile)

#### `server/`
- Express.js (TypeScript)
- Prisma ORM with PostgreSQL
- **Services:**
  - Order and product management (REST API)
  - Socket.io server for real-time notifications
  - Event indexing from Stellar ledger (via Soroban RPC)
  - Contract watcher for escrow state changes
- **Key files:**
  - `src/routes/` — REST API endpoints
  - `src/services/contractWatcher.ts` — polls RPC for escrow events
  - `src/services/` — business and integration services
  - `src/controllers/` — request handling

**Contracts used:** `contracts/escrow/` (direct payment escrow)

---

### 2. Campaign Production App (`agro-production/client/` + `agro-production/server/`)

**Status:** Current development focus (Stellar Wave bounty program)
**Use case:** Campaign-based crowdfunding for agricultural production (investors lock funds, farmers execute production, investors claim returns)

#### `agro-production/client/`
- Next.js (App Router)
- **Wallet:** Stellar wallet-kit integration (same wallet stack pattern as marketplace client)
- **State:** React Context + custom hooks
- **Features:**
  - Campaign creation (by farmers)
  - Campaign browsing and details
  - Investment flow (XDR building, transaction signing, indexing polls)
  - Investor dashboards and return claims
  - Real-time campaign status updates
- **Key files:**
  - `src/app/` — campaign routes and UI
  - `src/lib/` — contract/XDR helpers and API integration
  - `src/hooks/` — custom React hooks

#### `agro-production/server/`
- Express.js (TypeScript)
- Prisma ORM with PostgreSQL
- **Services:**
  - Campaign and investment REST API
  - WebSocket/real-time campaign updates
  - Soroban event watcher for production_escrow events
  - Image upload endpoint for campaign photos
- **Key files:**
  - `src/routes/` — REST API routes
  - `src/services/contractWatcher.ts` — indexes production_escrow events
  - `src/services/` — business and integration services

**Contracts used:** 
- `contracts/production_escrow/` — main crowdfunding escrow
- `contracts/registry/` — campaign/farmer registration
- `contracts/investment_basket/` — investor pool management
- `contracts/governance/` — governance features

---

## Smart Contracts (5 Deployable Rust Crates)

All contracts are written in Rust for Soroban (Stellar's smart contract platform).

### Root Escrow Contracts

#### 1. `contracts/escrow/`
- **Purpose:** Direct payment escrow for root marketplace (peer-to-peer trade)
- **Events:**
  - `order.created` — buyer initiates escrow
  - `order.confirmed` — buyer receives goods and releases payment
  - `order.disputed` — buyer/seller dispute
  - `order.refunded` — payment returned to buyer
- **Consumed by:** `server/` (contract watcher), `client/` (order management)

#### Archived prototype: `archive/weather-insurance/`
- **Purpose:** Weather-based parametric insurance for farmers (complementary feature)
- **Status:** Standalone; future integration planned
- **Consumed by:** Not yet integrated into main app flows

### Production Crowdfunding Contracts

#### 3. `contracts/production_escrow/`
- **Purpose:** Campaign-based escrow for crowdfunded agricultural production
- **Key interactions:**
  - `create_campaign()` — farmer initiates campaign (target amount, deadline)
  - `invest()` — investor locks funds in campaign
  - `settle_campaign()` — campaign settles when deadline passes
  - `claim_returns()` — investor claims proportional returns from campaign results
- **Events:**
  - `campaign.created` — campaign initialized
  - `campaign.invested` — investor deposits
  - `campaign.settled` — campaign reached deadline
  - `campaign.claimed` — investor withdrew returns
- **Consumed by:** `agro-production/server/` (watcher), `agro-production/client/` (invest flow)

#### 4. `contracts/registry/`
- **Purpose:** Farmer/investor identity and KYC registration on-chain
- **Key interactions:**
  - `register_farmer()` — on-board farmer with identity
  - `register_investor()` — on-board investor
  - `get_farmer()` — look up farmer details
- **Consumed by:** `agro-production/server/` (campaign creation validation), `agro-production/client/` (farmer onboarding)

#### 5. `contracts/investment_basket/`
- **Purpose:** Manages investor fund pooling and returns distribution
- **Key interactions:**
  - `deposit()` — investor adds funds to pool
  - `distribute()` — distribute returns proportionally to investors
- **Status:** Used by production_escrow for multi-investor campaigns
- **Consumed by:** `production_escrow/` (internally)

#### 6. `contracts/governance/`
- **Purpose:** DAO-style governance for platform decisions (future feature)
- **Status:** Under development; not yet integrated into main flows
- **Planned interactions:**
  - `propose()` — propose platform changes
  - `vote()` — vote on proposals
- **Consumed by:** Planned for future releases

---

## Data Flow

### Root Marketplace Order Flow
```
Client                  Server              Stellar Ledger
  │                       │                      │
  ├─ User creates order ──→ REST POST /orders   │
  │                        ├─ Save to DB         │
  │                        └─ Broadcast WS      ├─ Contract initialized
  │                                             │
  ├─ User signs escrow XDR ──→ POST /orders/:id/confirm
  │  and submits to Stellar   ├─ Submit to ledger ──→ Escrow locked
  │                           └─ Broadcast WS
  │
  ├─ Buyer waits for ────────→ Contract watcher polls RPC
  │  delivery           ├─ Detects escrow confirmation
  │                     ├─ Updates DB + broadcasts WS
  └─ User confirms/refunds ──→ POST /orders/:id/action
     and signs XDR            ├─ Submit to Stellar ──→ Funds released
                              └─ Broadcast WS
```

### Campaign Investment Flow
```
Client                       Server              Stellar Ledger
  │                            │                      │
  ├─ User creates campaign ──→ POST /campaigns       │
  │  (farmer)                   ├─ Save to DB        ├─ production_escrow initialized
  │                             └─ Broadcast WS      │
  │
  ├─ Investor browses campaigns ────→ GET /campaigns │
  │                               ├─ Query DB        │
  │                               └─ Return list     │
  │
  ├─ Investor reviews campaign ──→ GET /campaigns/:id
  │                              └─ Return details
  │
  ├─ contractService.buildInvest() ──→ (local to client)
  │  (builds XDR against mock RPC)
  │
  ├─ User signs invest XDR ──→ POST /campaigns/:id/invest
  │  and submits to Stellar    ├─ Submit to ledger ──→ Funds locked in pool
  │                            └─ Broadcast WS
  │
  │ (campaign lifecycle)
  └─ After deadline, ────────→ Contract watcher detects
     investor claims returns   settlement + auto-broadcasts
                               ├─ POST /campaigns/:id/claim_returns
                               ├─ Submit to ledger ──→ Returns released
                               └─ Broadcast WS
```

---

## Key Architectural Patterns

### Transaction Lifecycle
Both apps follow the same pattern:
1. **XDR Building** — Client builds transaction (sometimes with mock RPC for testing)
2. **Signing** — User signs with Freighter wallet
3. **Submission** — Send to Stellar network
4. **Indexing Polling** — Server polls Soroban RPC for confirmation
5. **DB Update & Broadcast** — Once indexed, update DB and notify WebSocket clients

### Real-time Updates
- WebSocket server broadcasts events from `contract watcher` to connected clients
- Events are keyed by wallet address (e.g., `farmer:0x...`, `investor:0x...`)
- Clients subscribe to wallet-specific channels after authentication

### Error Classification
Both apps use `classifyError()` utility to categorize contract errors:
- **User errors** (e.g., insufficient funds) → 400 Bad Request
- **Contract logic** (e.g., CampaignNotSettled) → 422 Unprocessable Entity
- **Network errors** → 503 Service Unavailable
- **Unexpected errors** → 500 Internal Server Error

---

## Development Focus

### Current (Stellar Wave Program)
- **Production escrow campaigns** (`agro-production/`) — MVP for agricultural crowdfunding
- Critical issues: wallet auth, contract integration, error handling, observability

### Next Phase
- Archived weather-insurance reference (`archive/weather-insurance/`); excluded from active deployment
- Governance features (`contracts/governance/`)
- Root marketplace enhancements

### Lower Priority
- `client/` and `server/` (root marketplace) — mature and maintained, but lower priority than current Stellar Wave production-campaign work

---

## Environment Configuration

Environment variable names differ by app. Use the app `.env.example` files and the authoritative reference:

- [docs/deployment/environment.md](docs/deployment/environment.md)

Common examples (not exhaustive):
- Marketplace client: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOROBAN_RPC_URL`, `NEXT_PUBLIC_NETWORK_PASSPHRASE`, `NEXT_PUBLIC_CONTRACT_ID`
- Production client: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOROBAN_RPC_URL`, `NEXT_PUBLIC_NETWORK_PASSPHRASE`, `NEXT_PUBLIC_PRODUCTION_CONTRACT_ID`
- Marketplace server: `DATABASE_URL`, `RPC_URL`, `CONTRACT_ID`, `RUN_CONTRACT_WATCHER`, `PORT`
- Production server: `DATABASE_URL`, `RPC_URL`, `PRODUCTION_ESCROW_CONTRACT_ID`, `PORT`

---

## Getting Started

### New Contributors

1. **Understand the split:**
   - **For campaign/production features:** Work in `agro-production/`
   - **For marketplace features:** Work in root `client/` and `server/`
   - **For shared contracts:** Check which app(s) consume it

2. **Pick an area:**
   - Backend: `agro-production/server/` (contract watcher, API routes, WebSocket)
   - Frontend: `agro-production/client/` (investment flow, campaign pages)
   - Contracts: `contracts/` (Rust/Soroban)

3. **Run locally:**
   - See `agro-production/README.md` for E2E test setup
   - See `client/README.md` and `server/README.md` in each directory

4. **File issues:**
   - Use GitHub Issues with appropriate labels (`area:frontend`, `area:backend`, `type:bug`, etc.)
   - Reference this document if explaining architectural decisions

---

## Questions?

- **Repo structure:** See this [ARCHITECTURE.md](ARCHITECTURE.md)
- **Frontend setup:** See [docs/FRONTEND_SETUP.md](docs/FRONTEND_SETUP.md)
- **Environment variables:** See [docs/deployment/environment.md](docs/deployment/environment.md)
- **Backend unification:** See [docs/architecture/backend-unification.md](docs/architecture/backend-unification.md)
- **API endpoints:** See [server/docs/API.md](server/docs/API.md) and [client/API.md](client/API.md)
- **Contract interfaces:** See `contracts/` and [contracts/README.md](contracts/README.md)
- **Deployment:** Check CI workflows in `.github/workflows/`
