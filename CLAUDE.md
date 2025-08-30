# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a Trust Game Experiment App built on Algorand blockchain with the following structure:
- **contracts/**: Algorand Python (algopy/PyTeal) smart contract implementations
- **frontend/**: React + Vite + TypeScript app with Pera wallet integration for TestNet
- **scripts/**: Data exporter and verification utilities
- **tests/**: Python unit and scenario tests using pytest
- **infra/**: AlgoKit and CI configuration notes

The app supports both LocalNet (for SDK/testing) and TestNet (for Pera wallet flows). The frontend deploys to Vercel with serverless functions for data export.

## Development Commands

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev      # Start development server
npm run build    # Build for production (TypeScript compile + Vite build)
npm run preview  # Preview production build
```

### Python/Contracts
```bash
# Install Python dependencies
pip install -r requirements-dev.txt

# Run tests
pytest                           # Run all tests
pytest tests/test_specific.py    # Run specific test file
```

### Algorand LocalNet
```bash
# Requires Docker + AlgoKit
algokit localnet start   # Start local Algorand network
algokit localnet stop    # Stop local network
```

### Vercel Deployment
```bash
cd frontend
vercel dev      # Run Vercel development server (enables /api proxy)
vercel deploy   # Deploy to Vercel
```

## Network Configuration

- **LocalNet**: Used for SDK tests and automated CI
- **TestNet**: Primary network for Pera wallet integration
- **Pera Setup**: Enable Developer Mode → TestNet, fund account from dispenser

## Environment Setup

Frontend requires `.env.local` with TestNet endpoints:
- `TESTNET_ALGOD_URL`
- `TESTNET_ALGOD_TOKEN` 
- `VITE_NETWORK=TESTNET` (client-side)

## Smart Contract Architecture

The main contract (`contracts/trust_game_app.py`) implements:
- Subject registration with uniqueness enforcement
- Experimenter-only pairing functionality
- Commit/reveal scheme for choices
- Settlement with payoff calculations
- Event logging for data export
- Final digest computation for verification

## Development Workflow

This project follows a time-boxed development schedule (see CHECKLIST.md) with daily milestones from Aug 29 to Sept 9. Key phases:
1. Contract scaffolding and deployment
2. Registration and pairing implementation  
3. Commit/reveal mechanism
4. Settlement and payments
5. CSV export functionality
6. Digest verification
7. End-to-end UX testing
8. Final testing and documentation

## Testing Strategy

- Python tests use pytest framework
- Frontend builds require TypeScript compilation to pass
- CI pipeline runs LocalNet for automated contract testing
- Manual testing on TestNet with Pera wallets before deployment