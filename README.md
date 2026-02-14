# 🎰 Rug Roulette

**6 Slots. 5 Rugs. 1 Survivor. Pure SOL.**

Russian roulette but make it DeFi.

## How It Works

1. Connect your Solana wallet
2. Bet 0.1 SOL on one of 6 colored slots
3. Watch 5 slots get rugged one by one 💀
4. If yours survives, you win the entire pot 🎉

Simple odds: 1/6 chance to win ~6x your bet.

## Project Structure

```
rug-roulette/
├── app/                    # Next.js frontend
├── components/             # React components
├── lib/                    # Frontend game logic
├── programs/
│   └── rug-roulette/       # Anchor program
│       └── src/lib.rs      # Smart contract
├── tests/
│   ├── rug-roulette.ts     # Anchor integration tests
│   └── unit.ts             # Unit tests
├── Anchor.toml             # Anchor config
└── Cargo.toml              # Rust workspace
```

## Smart Contract

Pure SOL betting - no tokens involved.

- **initialize_game** - Create a new round with entry fee (in SOL)
- **enter_game** - Player picks a slot (0-5) and pays SOL entry
- **trigger_rug** - Authority triggers the rug, random survivor is chosen
- **claim_winnings** - Survivors split the SOL pot

### Accounts

- `Game` - Stores round state, SOL pot, player counts per slot
- `PlayerEntry` - Individual player's pick and claim status

## Running the Frontend

```bash
cd rug-roulette
npm install
npm run dev  # Runs on port 3003
```

## Running Tests

### Anchor Integration Tests

```bash
# Start local validator
solana-test-validator

# Build and test
anchor build
anchor test
```

### Unit Tests

```bash
npm run test:unit
```

## Security Notes

⚠️ **NOT FOR PRODUCTION** - The randomness uses slot hash which is predictable. For production, integrate with:
- Switchboard VRF
- Chainlink VRF
- Or commit-reveal scheme

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, Solana Wallet Adapter
- **Smart Contract**: Anchor 0.29, Rust
- **Testing**: Mocha, Chai, ts-mocha

---

*Not financial advice. This is a casino, ser.*
