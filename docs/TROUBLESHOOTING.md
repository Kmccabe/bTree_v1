# Troubleshooting Guide

This guide covers common issues you may encounter while developing, deploying, or using the Trust Game application.

## 🔧 Development Issues

### Local Development Setup

**Issue: `/api/*` endpoints return 404**
```bash
# Problem: Serverless functions not running
# Solution: Start vercel dev server
cd frontend
npx vercel dev
```

**Issue: `npm run dev` fails to start**
```bash
# Check for port conflicts
netstat -an | grep :5173
# Kill conflicting process or use different port
npm run dev -- --port 5174
```

**Issue: Environment variables not loading**
```bash
# Verify .env.local exists and has correct format
cat frontend/.env.local

# Required variables:
TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud
TESTNET_ALGOD_TOKEN=
VITE_NETWORK=TESTNET
```

### Build and Deployment Issues

**Issue: TypeScript compilation errors**
```bash
# Run type checking
cd frontend
npm run typecheck

# Common fixes:
# - Update @types packages
# - Check for missing imports
# - Verify component prop types
```

**Issue: Vercel deployment fails**
```json
# Check deployment logs in Vercel dashboard
# Common causes:
# - Missing environment variables
# - Build command incorrect
# - Output directory mismatch

# Verify vercel.json settings:
{
  "functions": {
    "frontend/api/**/*.ts": {
      "maxDuration": 10
    }
  }
}
```

---

## 💰 Wallet Connection Issues

### Pera Wallet Problems

**Issue: Wallet not connecting**
1. **Check network mode**: Ensure Pera is set to TestNet
2. **Clear browser cache**: Clear site data and reconnect
3. **Update Pera**: Use latest version of Pera Wallet
4. **Check popup blocker**: Allow popups for the application

**Issue: "Wrong network" error**
```javascript
// Verify environment variable
VITE_NETWORK=TESTNET

// Check wallet network in browser console
console.log(wallet.activeNetwork)
```

**Issue: Transactions failing with insufficient funds**
```bash
# Get TestNet ALGO from dispenser
# https://testnet.algoexplorer.io/dispenser

# Check balance
curl "https://testnet-api.algonode.cloud/v2/accounts/YOUR_ADDRESS"
```

### Transaction Signing Issues

**Issue: "Transaction rejected by wallet"**
- **Fee too low**: Use suggested params from `/api/params`
- **Invalid group**: Ensure transaction group structure is correct
- **Network mismatch**: Verify genesis ID matches TestNet

**Issue: Wallet popup doesn't appear**
- Disable popup blockers
- Check if wallet extension is installed and unlocked
- Try refreshing the page and reconnecting

---

## 🎮 Game Logic Issues

### Smart Contract Deployment

**Issue: Contract deployment fails**
```bash
# Common causes:
# 1. Insufficient ALGO for creation fee (~0.1 ALGO minimum)
# 2. Invalid TEAL compilation
# 3. Network connectivity issues

# Debug steps:
# 1. Check account balance
# 2. Verify TEAL compiles via /api/compile
# 3. Check browser console for errors
```

**Issue: "App not found" error**
```bash
# Verify app ID is correct
curl "https://testnet-api.algonode.cloud/v2/applications/APP_ID"

# Check if app was deleted
# Apps must be created fresh if deleted
```

### Algorand assert failures (logic eval)

Errors like `logic eval error: assert failed pc=331` indicate a TEAL assertion failed. Common causes and checks:

1) Wrong phase for operation
```bash
curl -s 'http://localhost:3000/api/pair?id=APP_ID' | jq '.globals.phase'
# Expect: 1 for Invest (S1), 2 for Return (S2)
```

2) Amount not a multiple of UNIT
```bash
curl -s 'http://localhost:3000/api/pair?id=APP_ID' | jq '.globals.UNIT'
# Ensure s and r satisfy (value % UNIT == 0)
```

3) Underfunded app account
```bash
# For Return, app must have at least t + E2, where t = m × s
curl -s 'http://localhost:3000/api/account?addr=APP_ADDRESS'
# Compare amount vs required; include min-balance slack.
```

4) Sender / accounts ordering
- Invest must be sent by S1; Return by S2 with `accounts[1] = S1`.
- Verify local state and addresses via:
```bash
curl -s 'http://localhost:3000/api/local?addr=S1_ADDR&id=APP_ID' | jq .
curl -s 'http://localhost:3000/api/local?addr=S2_ADDR&id=APP_ID' | jq .
```

### Investment Phase Issues

**Issue: Investment transaction rejected**
```javascript
// Common causes and solutions:

// 1. Amount not multiple of UNIT
const s = 150000; // Must be multiple of UNIT (e.g., 100000)

// 2. Amount exceeds E1 endowment  
const s = 1000000; // Must be ≤ E1

// 3. Wrong phase
// Ensure phase = 1 (Investment phase)

// 4. Participant not opted in
// Check local state exists for sender

// 5. Sender is not S1
// Verify sender matches registered S1 address
```

**Issue: "Insufficient app funding" on investment**
```bash
# App needs funding for refund: E1 - s
# Fund app address with sufficient ALGO before investment

# Check app balance:
curl "https://testnet-api.algonode.cloud/v2/accounts/APP_ADDRESS"

# Fund via any wallet or dispenser
```

### Return Phase Issues

**Issue: Return transaction rejected**
```javascript
// Common causes:

// 1. Amount not multiple of UNIT
const r = 75000; // Must be multiple of UNIT

// 2. Amount exceeds available t
const r = 500000; // Must be ≤ t (where t = m × s)

// 3. Insufficient app funding for payouts
// App needs: t + E2 total for both payouts

// 4. Wrong phase or sender
// Phase must be 2, sender must be S2
```

**Issue: "Balance too low for return" error**
```bash
# App needs funding for both payouts: r to S1, (t-r+E2) to S2
# Total required: t + E2

# Example: if t=300000, E2=50000, app needs 350000 µALGO minimum
# Fund the app address before return transaction
```

### Phase Transition Issues

**Issue: Phase doesn't advance automatically**
- Phase 0→1: Manual admin action required
- Phase 1→2: Automatic after successful investment
- Phase 2→3: Automatic after successful return

**Issue: "Wrong phase for operation"**
```javascript
// Check current phase:
// Phase 0: Registration only
// Phase 1: Investment allowed
// Phase 2: Return allowed  
// Phase 3: Game complete, only sweep/export allowed
```

---

## 🌐 Network and API Issues

### Algorand Node Issues

**Issue: "Network request failed"**
```bash
# Check node status
curl "https://testnet-api.algonode.cloud/health"

# Try alternative nodes:
# https://testnet-api.4160.nodely.io
# https://academy-algod.dev.aws.algodev.network
```

**Issue: "Invalid genesis hash"**
```bash
# Ensure using TestNet genesis
# TestNet genesis: SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
# MainNet genesis: wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=
```

### Indexer Issues

**Issue: Transaction history not loading**
```bash
# Check indexer status
curl "https://testnet-idx.algonode.cloud/health"

"#" Indexer may lag behind node by several rounds
"#" Retry with backoff (200ms → 500ms → 1s → 2s) up to ~2 minutes
```

**Issue: "Application not found in indexer"**
- Indexer updates can lag 1–2 minutes behind node
- New apps may not appear immediately
- Use direct node queries for real-time data; add a retry loop in the UI

---

## 📊 Data Export Issues

### CSV Export Problems

**Issue: Export returns empty data**
- Verify game has completed at least Phase 1
- Check application ID is correct
- Ensure transactions have been confirmed

**Issue: "Invalid app ID for export"**
```bash
# Verify app exists and has transaction history
curl "https://testnet-idx.algonode.cloud/v2/applications/APP_ID/transactions"
```

### Data Integrity Issues

**Issue: Digest verification fails**
- Export may be incomplete if game still running
- Ensure all phases completed before final export
- Check on-chain finalize digest matches computed digest

---

## 🔒 Security and Permissions

### Access Control Issues

**Issue: "Creator only operation"**
- Phase changes, sweep, and delete require creator signature
- Verify wallet connected is the app creator
- Check transaction sender matches creator address

**Issue: "Participant not registered"**
- Both S1 and S2 must opt-in before game actions
- Check local state exists for participant addresses
- Verify opt-in transactions were confirmed

---

## 🛠️ Debugging Tools

### Browser Developer Tools
```javascript
// Check wallet connection
console.log(wallet.accounts)

// Monitor API calls
// Open Network tab, filter for '/api/'

// Check application state  
console.log(gameState)
```

### Algorand Explorer
- **LoRA TestNet**: https://lora.algokit.io/testnet
- **AlgoExplorer TestNet**: https://testnet.algoexplorer.io
- Use to verify transactions, check account states, view contract details

### Command Line Testing
```bash
# Test API endpoints directly
curl "http://localhost:3000/api/health"
curl "http://localhost:3000/api/params"

# Check account via node
curl "https://testnet-api.algonode.cloud/v2/accounts/ADDRESS"
```

---

## 📞 Getting Help

### Information to Collect
When reporting issues, include:
1. **Environment**: Local dev, staging, or production
2. **Browser**: Chrome, Firefox, Safari, etc.
3. **Wallet**: Pera version and network setting
4. **Transaction ID**: If transaction-related
5. **Console errors**: Browser console output
6. **App ID**: If game-specific issue

### Debug Commands
```bash
# Environment check
node --version
npm --version

# Dependencies check  
npm list --depth=0

# Build test
npm run build

# Type check
npm run typecheck
```

### Common Patterns
- **Always check network first**: TestNet vs MainNet
- **Verify funding**: Apps and accounts need sufficient ALGO
- **Check phase consistency**: Operations must match current phase
- **Wait for confirmation**: Don't assume immediate success

### Recovery Steps
1. **Clear browser cache** and reconnect wallet
2. **Restart development servers** (vercel dev, npm run dev)
3. **Check environment variables** are properly set
4. **Verify network connectivity** to Algorand nodes
5. **Test with fresh wallet** to isolate account-specific issues

---

For additional help, check:
- [API Reference](API_REFERENCE.md) for endpoint details
- [Game Rules](../frontend/docs/trust-game-design.md) for business logic
- [Testing Guide](../tests/manual/SMOKE.md) for step-by-step validation

---

## WalletConnect/Pera specific pitfalls

- Mobile Pera with WalletConnect can silently drop sessions if the phone sleeps. Reconnect from the app UI.
- Ensure only one tab/site has an active WalletConnect session to avoid race conditions.
- Minimum balance: keep ≥ 0.1 ALGO on all accounts (and ≥ 0.1 ALGO on the app account after sweeps).
