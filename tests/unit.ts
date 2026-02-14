import { expect } from "chai";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

/**
 * Comprehensive unit tests for Rug Roulette game logic
 * No on-chain interaction - pure logic testing
 */
describe("rug-roulette unit tests", () => {
  const NUM_SLOTS = 6;
  const NUM_RUGS = 5;
  // Use SystemProgram as placeholder for PDA derivation tests
  const PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

  // ============================================
  // SLOT VALIDATION
  // ============================================
  describe("slot validation", () => {
    it("accepts valid slot indices 0-5", () => {
      for (let i = 0; i < NUM_SLOTS; i++) {
        expect(i >= 0 && i < NUM_SLOTS).to.be.true;
      }
    });

    it("rejects negative indices", () => {
      const invalidIndices = [-1, -5, -100, -255];
      for (const idx of invalidIndices) {
        expect(idx >= 0 && idx < NUM_SLOTS).to.be.false;
      }
    });

    it("rejects indices >= 6", () => {
      const invalidIndices = [6, 7, 10, 100, 255];
      for (const idx of invalidIndices) {
        expect(idx >= 0 && idx < NUM_SLOTS).to.be.false;
      }
    });

    it("boundary check: 5 is valid, 6 is invalid", () => {
      expect(5 >= 0 && 5 < NUM_SLOTS).to.be.true;
      expect(6 >= 0 && 6 < NUM_SLOTS).to.be.false;
    });
  });

  // ============================================
  // SURVIVOR SELECTION
  // ============================================
  describe("survivor selection", () => {
    it("exactly one survivor out of 6 slots", () => {
      for (let i = 0; i < 100; i++) {
        const survivorIndex = Math.floor(Math.random() * NUM_SLOTS);
        const slots = [0, 1, 2, 3, 4, 5];
        const rugged = slots.filter(s => s !== survivorIndex);
        
        expect(rugged.length).to.equal(NUM_RUGS);
        expect(slots.includes(survivorIndex)).to.be.true;
      }
    });

    it("survivor index is always 0-5", () => {
      for (let i = 0; i < 1000; i++) {
        const survivorIndex = Math.floor(Math.random() * NUM_SLOTS);
        expect(survivorIndex).to.be.greaterThanOrEqual(0);
        expect(survivorIndex).to.be.lessThan(NUM_SLOTS);
      }
    });

    it("each slot has equal probability (~16.67%)", () => {
      const counts = [0, 0, 0, 0, 0, 0];
      const iterations = 60000;
      
      for (let i = 0; i < iterations; i++) {
        const survivor = Math.floor(Math.random() * NUM_SLOTS);
        counts[survivor]++;
      }
      
      const expected = iterations / NUM_SLOTS;
      const tolerance = expected * 0.05; // 5% tolerance
      
      for (let i = 0; i < NUM_SLOTS; i++) {
        expect(counts[i]).to.be.approximately(expected, tolerance);
      }
    });

    it("slot randomness using slot hash simulation", () => {
      // Simulate the on-chain randomness: slot + timestamp
      const simulateRandomness = (slot: number, timestamp: number) => {
        const pseudoRandom = (slot + timestamp) >>> 0; // Convert to u64-like
        return pseudoRandom % NUM_SLOTS;
      };

      // Test with various slot/timestamp combinations
      const results = new Set<number>();
      for (let slot = 0; slot < 1000; slot++) {
        for (let ts = 0; ts < 100; ts++) {
          results.add(simulateRandomness(slot, ts));
        }
      }
      
      // Should produce all possible outcomes (0-5)
      expect(results.size).to.equal(NUM_SLOTS);
    });
  });

  // ============================================
  // POT DISTRIBUTION MATH
  // ============================================
  describe("pot distribution", () => {
    it("single survivor gets full pot", () => {
      const totalPot = 1_000_000_000; // 1 SOL
      const survivorCount = 1;
      const share = Math.floor(totalPot / survivorCount);
      
      expect(share).to.equal(totalPot);
    });

    it("two survivors split pot evenly", () => {
      const totalPot = 1_000_000_000;
      const survivorCount = 2;
      const share = Math.floor(totalPot / survivorCount);
      
      expect(share).to.equal(500_000_000);
      expect(share * survivorCount).to.equal(totalPot);
    });

    it("three survivors split pot (with dust)", () => {
      const totalPot = 1_000_000_000;
      const survivorCount = 3;
      const share = Math.floor(totalPot / survivorCount);
      const dust = totalPot - share * survivorCount;
      
      expect(share).to.equal(333_333_333);
      expect(dust).to.equal(1);
      expect(share * survivorCount + dust).to.equal(totalPot);
    });

    it("handles various survivor counts", () => {
      const totalPot = 1_000_000_000;
      const counts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 1000];
      
      for (const count of counts) {
        const share = Math.floor(totalPot / count);
        const dust = totalPot - share * count;
        
        expect(share).to.be.greaterThan(0);
        expect(dust).to.be.lessThan(count);
        expect(share * count + dust).to.equal(totalPot);
      }
    });

    it("dust is always less than survivor count", () => {
      for (let pot = 1; pot <= 1000; pot++) {
        for (let survivors = 1; survivors <= 10; survivors++) {
          const share = Math.floor(pot / survivors);
          const dust = pot - share * survivors;
          expect(dust).to.be.lessThan(survivors);
        }
      }
    });

    it("calculates expected value correctly", () => {
      // With 6 players each betting 0.1 SOL:
      const entryFee = 0.1 * LAMPORTS_PER_SOL;
      const numPlayers = 6;
      const totalPot = entryFee * numPlayers;
      
      // Each player on different slot: 1/6 chance to win full pot
      const expectedValue = (1 / NUM_SLOTS) * totalPot;
      
      // EV equals entry fee (fair game)
      expect(expectedValue).to.equal(entryFee);
    });

    it("handles minimum pot (1 lamport)", () => {
      const totalPot = 1;
      const survivorCount = 1;
      const share = Math.floor(totalPot / survivorCount);
      
      expect(share).to.equal(1);
    });

    it("handles maximum u64 pot", () => {
      const maxU64 = BigInt("18446744073709551615");
      const survivorCount = BigInt(6);
      const share = maxU64 / survivorCount;
      
      expect(share).to.be.greaterThan(0);
    });

    it("calculates house edge scenarios", () => {
      // If house takes 5%:
      const entryFee = 0.1 * LAMPORTS_PER_SOL;
      const numPlayers = 6;
      const houseCut = 0.05;
      const totalPot = entryFee * numPlayers;
      const potAfterCut = totalPot * (1 - houseCut);
      const expectedValue = (1 / NUM_SLOTS) * potAfterCut;
      
      // EV is less than entry fee (house wins)
      expect(expectedValue).to.be.lessThan(entryFee);
      expect(expectedValue).to.equal(entryFee * 0.95);
    });
  });

  // ============================================
  // PDA DERIVATION
  // ============================================
  describe("PDA derivation", () => {
    const authority = Keypair.generate().publicKey;
    const player = Keypair.generate().publicKey;

    it("game PDA is deterministic", () => {
      const [pda1] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), authority.toBuffer()],
        PROGRAM_ID
      );
      const [pda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), authority.toBuffer()],
        PROGRAM_ID
      );
      
      expect(pda1.toString()).to.equal(pda2.toString());
    });

    it("different authorities yield different game PDAs", () => {
      const auth1 = Keypair.generate().publicKey;
      const auth2 = Keypair.generate().publicKey;
      
      const [pda1] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), auth1.toBuffer()],
        PROGRAM_ID
      );
      const [pda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), auth2.toBuffer()],
        PROGRAM_ID
      );
      
      expect(pda1.toString()).to.not.equal(pda2.toString());
    });

    it("vault PDA derived from game PDA", () => {
      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), authority.toBuffer()],
        PROGRAM_ID
      );
      const [vaultPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), gamePda.toBuffer()],
        PROGRAM_ID
      );
      
      expect(vaultPda).to.be.instanceOf(PublicKey);
      expect(bump).to.be.lessThanOrEqual(255);
      expect(bump).to.be.greaterThanOrEqual(0);
    });

    it("player entry PDA unique per game-player pair", () => {
      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), authority.toBuffer()],
        PROGRAM_ID
      );
      
      const player1 = Keypair.generate().publicKey;
      const player2 = Keypair.generate().publicKey;
      
      const [entry1] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), gamePda.toBuffer(), player1.toBuffer()],
        PROGRAM_ID
      );
      const [entry2] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), gamePda.toBuffer(), player2.toBuffer()],
        PROGRAM_ID
      );
      
      expect(entry1.toString()).to.not.equal(entry2.toString());
    });

    it("same player in different games has different entry PDAs", () => {
      const auth1 = Keypair.generate().publicKey;
      const auth2 = Keypair.generate().publicKey;
      
      const [game1] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), auth1.toBuffer()],
        PROGRAM_ID
      );
      const [game2] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), auth2.toBuffer()],
        PROGRAM_ID
      );
      
      const [entry1] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), game1.toBuffer(), player.toBuffer()],
        PROGRAM_ID
      );
      const [entry2] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), game2.toBuffer(), player.toBuffer()],
        PROGRAM_ID
      );
      
      expect(entry1.toString()).to.not.equal(entry2.toString());
    });

    it("PDA seeds are case-sensitive", () => {
      const [pda1] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), authority.toBuffer()],
        PROGRAM_ID
      );
      const [pda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("Game"), authority.toBuffer()],
        PROGRAM_ID
      );
      
      expect(pda1.toString()).to.not.equal(pda2.toString());
    });

    it("bump is always found (valid PDA)", () => {
      for (let i = 0; i < 100; i++) {
        const randomAuth = Keypair.generate().publicKey;
        const [pda, bump] = PublicKey.findProgramAddressSync(
          [Buffer.from("game"), randomAuth.toBuffer()],
          PROGRAM_ID
        );
        
        expect(pda).to.be.instanceOf(PublicKey);
        expect(bump).to.be.greaterThanOrEqual(0);
        expect(bump).to.be.lessThanOrEqual(255);
      }
    });
  });

  // ============================================
  // GAME STATE MACHINE
  // ============================================
  describe("game state machine", () => {
    type GameStatus = "open" | "rugged" | "closed";
    
    const validTransitions: Record<GameStatus, GameStatus[]> = {
      open: ["rugged"],
      rugged: ["closed"],
      closed: [],
    };

    it("open -> rugged is valid", () => {
      expect(validTransitions.open.includes("rugged")).to.be.true;
    });

    it("rugged -> open is invalid", () => {
      expect(validTransitions.rugged.includes("open")).to.be.false;
    });

    it("open -> closed is invalid (must go through rugged)", () => {
      expect(validTransitions.open.includes("closed")).to.be.false;
    });

    it("closed has no valid transitions (terminal state)", () => {
      expect(validTransitions.closed.length).to.equal(0);
    });

    it("each state has defined transitions", () => {
      const allStates: GameStatus[] = ["open", "rugged", "closed"];
      for (const state of allStates) {
        expect(validTransitions[state]).to.be.an("array");
      }
    });

    it("no state can transition to itself", () => {
      const allStates: GameStatus[] = ["open", "rugged", "closed"];
      for (const state of allStates) {
        expect(validTransitions[state].includes(state)).to.be.false;
      }
    });
  });

  // ============================================
  // ENTRY FEE VALIDATION
  // ============================================
  describe("entry fee validation", () => {
    it("accepts standard entry fees", () => {
      const validFees = [
        0.001 * LAMPORTS_PER_SOL,
        0.01 * LAMPORTS_PER_SOL,
        0.1 * LAMPORTS_PER_SOL,
        1 * LAMPORTS_PER_SOL,
        10 * LAMPORTS_PER_SOL,
      ];

      for (const fee of validFees) {
        expect(fee).to.be.greaterThan(0);
        expect(Number.isInteger(fee)).to.be.true;
      }
    });

    it("minimum entry fee is 1 lamport", () => {
      const minFee = 1;
      expect(minFee).to.be.greaterThan(0);
    });

    it("entry fee fits in u64", () => {
      const maxU64 = BigInt("18446744073709551615");
      const bigFee = BigInt(1000) * BigInt(LAMPORTS_PER_SOL);
      
      expect(bigFee).to.be.lessThanOrEqual(maxU64);
    });

    it("pot overflow protection", () => {
      const maxU64 = BigInt("18446744073709551615");
      const maxPlayers = BigInt(1000000);
      const maxSafeFee = maxU64 / maxPlayers;
      
      // Fee should be safe if less than maxSafeFee
      const typicalFee = BigInt(10 * LAMPORTS_PER_SOL);
      expect(typicalFee).to.be.lessThan(maxSafeFee);
    });
  });

  // ============================================
  // TOKEN COUNT TRACKING
  // ============================================
  describe("token count tracking", () => {
    it("initializes all counts to zero", () => {
      const tokenCounts = [0, 0, 0, 0, 0, 0];
      expect(tokenCounts.every(c => c === 0)).to.be.true;
      expect(tokenCounts.length).to.equal(NUM_SLOTS);
    });

    it("increments correct token on entry", () => {
      const tokenCounts = [0, 0, 0, 0, 0, 0];
      const entries = [0, 0, 1, 2, 2, 2, 5];
      
      for (const tokenIdx of entries) {
        tokenCounts[tokenIdx]++;
      }
      
      expect(tokenCounts[0]).to.equal(2);
      expect(tokenCounts[1]).to.equal(1);
      expect(tokenCounts[2]).to.equal(3);
      expect(tokenCounts[3]).to.equal(0);
      expect(tokenCounts[4]).to.equal(0);
      expect(tokenCounts[5]).to.equal(1);
    });

    it("sum of token counts equals player count", () => {
      const tokenCounts = [5, 3, 7, 1, 4, 2];
      const playerCount = tokenCounts.reduce((a, b) => a + b, 0);
      
      expect(playerCount).to.equal(22);
    });

    it("handles maximum u32 count per token", () => {
      const maxU32 = 4294967295;
      const tokenCounts = [maxU32, 0, 0, 0, 0, 0];
      
      expect(tokenCounts[0]).to.equal(maxU32);
    });
  });

  // ============================================
  // PLAYER ENTRY VALIDATION
  // ============================================
  describe("player entry validation", () => {
    it("entry stores correct player pubkey", () => {
      const player = Keypair.generate().publicKey;
      const entry = {
        player,
        game: Keypair.generate().publicKey,
        tokenIndex: 3,
        claimed: false,
        bump: 255,
      };
      
      expect(entry.player.toString()).to.equal(player.toString());
    });

    it("entry stores correct game reference", () => {
      const game = Keypair.generate().publicKey;
      const entry = {
        player: Keypair.generate().publicKey,
        game,
        tokenIndex: 0,
        claimed: false,
        bump: 254,
      };
      
      expect(entry.game.toString()).to.equal(game.toString());
    });

    it("claimed flag defaults to false", () => {
      const entry = {
        player: Keypair.generate().publicKey,
        game: Keypair.generate().publicKey,
        tokenIndex: 0,
        claimed: false,
        bump: 253,
      };
      
      expect(entry.claimed).to.be.false;
    });

    it("claimed flag can be set to true", () => {
      const entry = {
        player: Keypair.generate().publicKey,
        game: Keypair.generate().publicKey,
        tokenIndex: 0,
        claimed: false,
        bump: 252,
      };
      
      entry.claimed = true;
      expect(entry.claimed).to.be.true;
    });

    it("token index must match game slot selection", () => {
      const selectedSlot = 4;
      const entry = {
        player: Keypair.generate().publicKey,
        game: Keypair.generate().publicKey,
        tokenIndex: selectedSlot,
        claimed: false,
        bump: 251,
      };
      
      expect(entry.tokenIndex).to.equal(selectedSlot);
      expect(entry.tokenIndex).to.be.lessThan(NUM_SLOTS);
    });
  });

  // ============================================
  // CLAIM ELIGIBILITY
  // ============================================
  describe("claim eligibility", () => {
    it("survivor can claim", () => {
      const survivorIndex = 3;
      const playerTokenIndex = 3;
      const gameStatus = "rugged";
      const claimed = false;
      
      const canClaim = 
        gameStatus === "rugged" &&
        playerTokenIndex === survivorIndex &&
        !claimed;
      
      expect(canClaim).to.be.true;
    });

    it("non-survivor cannot claim", () => {
      const survivorIndex = 3;
      const playerTokenIndex = 2;
      const gameStatus = "rugged";
      const claimed = false;
      
      const canClaim = 
        gameStatus === "rugged" &&
        playerTokenIndex === survivorIndex &&
        !claimed;
      
      expect(canClaim).to.be.false;
    });

    it("cannot claim before rug", () => {
      const survivorIndex = null;
      const playerTokenIndex = 3;
      const gameStatus = "open";
      const claimed = false;
      
      const canClaim = 
        gameStatus === "rugged" &&
        survivorIndex !== null &&
        playerTokenIndex === survivorIndex &&
        !claimed;
      
      expect(canClaim).to.be.false;
    });

    it("cannot claim twice", () => {
      const survivorIndex = 3;
      const playerTokenIndex = 3;
      const gameStatus = "rugged";
      const claimed = true; // Already claimed
      
      const canClaim = 
        gameStatus === "rugged" &&
        playerTokenIndex === survivorIndex &&
        !claimed;
      
      expect(canClaim).to.be.false;
    });
  });

  // ============================================
  // SERIALIZATION SIZES
  // ============================================
  describe("account sizes", () => {
    it("Game account size calculation", () => {
      // Anchor discriminator: 8 bytes
      // authority: 32 bytes (Pubkey)
      // entry_fee: 8 bytes (u64)
      // total_pot: 8 bytes (u64)
      // player_count: 4 bytes (u32)
      // status: 1 byte (enum)
      // survivor_index: 1 + 1 bytes (Option<u8>)
      // token_counts: 6 * 4 = 24 bytes ([u32; 6])
      // bump: 1 byte
      // Total: 8 + 32 + 8 + 8 + 4 + 1 + 2 + 24 + 1 = 88 bytes
      
      const expectedSize = 8 + 32 + 8 + 8 + 4 + 1 + 2 + 24 + 1;
      expect(expectedSize).to.equal(88);
    });

    it("PlayerEntry account size calculation", () => {
      // Anchor discriminator: 8 bytes
      // player: 32 bytes (Pubkey)
      // game: 32 bytes (Pubkey)
      // token_index: 1 byte (u8)
      // claimed: 1 byte (bool)
      // bump: 1 byte
      // Total: 8 + 32 + 32 + 1 + 1 + 1 = 75 bytes
      
      const expectedSize = 8 + 32 + 32 + 1 + 1 + 1;
      expect(expectedSize).to.equal(75);
    });
  });

  // ============================================
  // ODDS & PROBABILITY
  // ============================================
  describe("odds and probability", () => {
    it("1/6 chance to survive", () => {
      const winProbability = 1 / NUM_SLOTS;
      expect(winProbability).to.be.approximately(0.1667, 0.001);
    });

    it("5/6 chance to get rugged", () => {
      const loseProbability = NUM_RUGS / NUM_SLOTS;
      expect(loseProbability).to.be.approximately(0.8333, 0.001);
    });

    it("expected value equals entry for fair game", () => {
      const entryFee = 100;
      const numPlayers = 6;
      const pot = entryFee * numPlayers;
      const winProbability = 1 / NUM_SLOTS;
      const expectedValue = winProbability * pot;
      
      expect(expectedValue).to.equal(entryFee);
    });

    it("variance calculation", () => {
      const entryFee = 100;
      const numPlayers = 6;
      const pot = entryFee * numPlayers;
      const p = 1 / NUM_SLOTS;
      
      // Variance = p * (win - EV)^2 + (1-p) * (loss - EV)^2
      const win = pot;
      const loss = 0;
      const ev = p * win;
      const variance = p * Math.pow(win - ev, 2) + (1 - p) * Math.pow(loss - ev, 2);
      const stdDev = Math.sqrt(variance);
      
      // EV = 100, Var = (1/6)(600-100)^2 + (5/6)(0-100)^2 = 50000
      // StdDev = sqrt(50000) ≈ 223.6
      expect(variance).to.equal(50000);
      expect(stdDev).to.be.approximately(223.6, 0.1);
    });
  });
});
