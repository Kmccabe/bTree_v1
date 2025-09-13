# bTree v1 — Trust Game on Algorand TestNet

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Algorand](https://img.shields.io/badge/Algorand-000000?logo=algorand&logoColor=white)](https://algorand.com/)

A production-ready, research-oriented Trust Game implementation on Algorand TestNet. This application enables behavioral economics experiments using real cryptocurrency transactions with Pera Wallet integration and serverless infrastructure.

## 🎯 What is the Trust Game?

The Trust Game is a classic behavioral economics experiment studying trust and reciprocity between two participants:
- **S1 (Investor)** receives an endowment and decides how much to invest
- **S2 (Trustee)** receives the multiplied investment and decides how much to return
- Both participants make real financial decisions with actual payouts

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite
- **Blockchain**: Algorand TestNet with TEAL smart contracts  
- **Wallet**: Pera Wallet integration via `@txnlab/use-wallet`
- **Hosting**: Vercel with serverless functions
- **API**: Proxy routes for secure Algod/Indexer access

## 📋 Prerequisites

- Node.js 16+ and npm
- [Pera Wallet](https://perawallet.app/) configured for TestNet
- TestNet ALGO for transaction fees
- Vercel account (for deployment)

## 🚀 Quick Start

### Local Development

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/Kmccabe/bTree_v1.git
   cd bTree_v1
   cd frontend && npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local`:
   ```bash
   TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud
   TESTNET_ALGOD_TOKEN=
   VITE_NETWORK=TESTNET
   ```

3. **Start development servers**
   ```bash
   # Terminal 1: Serverless functions (port 3000)
   npx vercel dev
   
   # Terminal 2: React app (port 5173) 
   npm run dev
   ```

4. **Access application**
   - Open http://localhost:5173
   - Connect Pera Wallet (ensure TestNet mode)
   - Use Admin panel to deploy and manage games

### Production Deployment

Deploy to Vercel with these settings:
- **Root Directory**: `frontend/`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `TESTNET_ALGOD_URL`: Your Algod endpoint
  - `TESTNET_ALGOD_TOKEN`: Your Algod token (if required)

## 🎮 Game Flow

### Phase 0: Registration
- Both participants (S1 and S2) connect wallets and opt into the smart contract
- Admin can verify participant registration

### Phase 1: Investment
- S1 receives endowment `E1` and chooses investment amount `s` (where `s ≤ E1`)
- Smart contract refunds `E1 - s` to S1 immediately
- Investment is multiplied: `t = m × s` available for S2

### Phase 2: Return Decision  
- S2 sees the multiplied amount `t` and chooses how much `r` to return (where `0 ≤ r ≤ t`)
- Payouts distributed: `r` to S1, `t - r + E2` to S2
- Game concludes automatically

### Phase 3: Completion
- Admin can export data and clean up the smart contract
- All transactions are recorded on-chain for transparency

## 📁 Project Structure

```
bTree_v1/
├── frontend/                 # Main React application
│   ├── api/                 # Vercel serverless functions
│   │   ├── compile.ts       # TEAL compilation
│   │   ├── submit.ts        # Transaction submission
│   │   ├── pair.ts          # Game state queries
│   │   └── ...              # Other API endpoints
│   ├── src/
│   │   ├── components/      # React UI components
│   │   ├── chain/           # Algorand utilities
│   │   ├── teal/            # Smart contract code
│   │   ├── state/           # State management
│   │   └── types/           # TypeScript definitions
│   ├── docs/                # Detailed documentation
│   └── public/              # Static assets
├── contracts/               # PyTeal development & testing
├── tests/                   # Testing procedures
├── docs/                    # Project documentation
│   ├── DATA_EXPORT.md       # Data export formats
│   └── INTEGRITY.md         # Security considerations
└── infra/                   # Infrastructure configuration
```

## 🔧 API Endpoints

The serverless API provides secure access to Algorand:

| Endpoint | Purpose | Parameters |
|----------|---------|------------|
| `/api/params` | Get transaction parameters | - |
| `/api/submit` | Submit signed transactions | `txns` (base64 encoded) |
| `/api/pair?id={appId}` | Get game state | `id` (App ID) |
| `/api/account?addr={address}` | Get account info | `addr` (Address) |
| `/api/compile` | Compile TEAL code | `teal` (source code) |
| `/api/history?id={appId}` | Get transaction history | `id` (App ID) |
| `/api/export?appId={appId}` | Export game data as CSV | `appId` (App ID) |

## 🧪 Testing

### Manual Testing
Run the complete smoke test:
```bash
# Follow the step-by-step guide
cat tests/manual/SMOKE.md
```

### Smart Contract Testing
```bash
cd contracts
python -m pytest test_*.py -v
```

## 📊 Data Export

Games can be exported to CSV format containing:
- Participant addresses and IDs
- Game parameters (endowment, multiplier)
- Investment and return decisions
- Transaction IDs and block heights
- Timestamps and payouts

## 🛠️ Development

### Smart Contract Development
- TEAL contracts: `frontend/src/teal/*.teal`
- PyTeal scaffolds: `contracts/trust_game_app.py`
- Testing: `contracts/test_*.py`

### Frontend Development
```bash
cd frontend
npm run dev      # Development server
npm run build    # Production build  
npm run preview  # Preview build
```

### Code Quality
```bash
npm run lint     # ESLint
npm run typecheck # TypeScript checking
```

## 🐛 Troubleshooting

### Common Issues

**Wallet Connection**
- Ensure Pera Wallet is set to TestNet
- Check `VITE_NETWORK=TESTNET` in environment

**API Errors**
- Verify `npx vercel dev` is running for local development
- Check Algod URL and token configuration

**Transaction Failures**
- Ensure sufficient TestNet ALGO for fees
- Verify investment amounts are multiples of UNIT
- Check smart contract funding levels

**Network Issues**
- Wait a few rounds for transaction confirmation
- Use "Load globals/Read pair state" to refresh data

## 🔗 Resources

- **Algorand Developer Docs**: https://developer.algorand.org/
- **LoRA TestNet Explorer**: https://lora.algokit.io/testnet
- **Pera Wallet**: https://perawallet.app/
- **Vercel Documentation**: https://vercel.com/docs

## 📚 Documentation

- **Frontend Details**: [`frontend/README.md`](frontend/README.md)
- **Game Design**: [`frontend/docs/trust-game-design.md`](frontend/docs/trust-game-design.md)  
- **Variants & Treatments**: [`frontend/docs/trust-game-variants.md`](frontend/docs/trust-game-variants.md)
- **Data Export Guide**: [`docs/DATA_EXPORT.md`](docs/DATA_EXPORT.md)
- **Security & Integrity**: [`docs/INTEGRITY.md`](docs/INTEGRITY.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

ISC License - see [LICENSE](LICENSE) file for details.

## 🔒 Security

- No private keys or secrets stored in client code
- All Algod access via serverless proxy functions  
- Smart contracts enforce game rules and validate transactions
- Real financial transactions - use TestNet for development

---

**⚠️ Disclaimer**: This is experimental software for research purposes. Always test thoroughly on TestNet before any mainnet usage.

