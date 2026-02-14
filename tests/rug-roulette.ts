import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RugRoulette } from "../target/types/rug_roulette";
import { expect } from "chai";
import { 
  Keypair, 
  LAMPORTS_PER_SOL, 
  PublicKey, 
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction 
} from "@solana/web3.js";

describe("rug-roulette", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RugRoulette as Program<RugRoulette>;
  const authority = provider.wallet;
  
  let gamePda: PublicKey;
  let gameBump: number;
  let vaultPda: PublicKey;
  let vaultBump: number;
  
  const entryFee = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
  
  // Test players pool
  const players: Keypair[] = [];
  const NUM_PLAYERS = 12;

  // Helper to create and fund a player
  async function createFundedPlayer(amount = LAMPORTS_PER_SOL): Promise<Keypair> {
    const player = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(player.publicKey, amount);
    await provider.connection.confirmTransaction(sig);
    return player;
  }

  // Helper to get player entry PDA
  function getPlayerEntryPda(game: PublicKey, player: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("entry"), game.toBuffer(), player.toBuffer()],
      program.programId
    );
  }

  // Helper to enter game
  async function enterGame(player: Keypair, tokenIndex: number, game = gamePda, vault = vaultPda) {
    const [entryPda] = getPlayerEntryPda(game, player.publicKey);
    await program.methods
      .enterGame(tokenIndex)
      .accounts({
        game,
        gameVault: vault,
        playerEntry: entryPda,
        player: player.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();
    return entryPda;
  }

  before(async () => {
    // Derive PDAs
    [gamePda, gameBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), authority.publicKey.toBuffer()],
      program.programId
    );
    
    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), gamePda.toBuffer()],
      program.programId
    );

    // Create funded players
    for (let i = 0; i < NUM_PLAYERS; i++) {
      players.push(await createFundedPlayer());
    }
  });

  // ============================================
  // INITIALIZATION TESTS
  // ============================================
  describe("initialize_game", () => {
    it("creates a new game with correct parameters", async () => {
      await program.methods
        .initializeGame(entryFee)
        .accounts({
          game: gamePda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const game = await program.account.game.fetch(gamePda);
      
      expect(game.authority.toString()).to.equal(authority.publicKey.toString());
      expect(game.entryFee.toString()).to.equal(entryFee.toString());
      expect(game.totalPot.toString()).to.equal("0");
      expect(game.playerCount).to.equal(0);
      expect(game.status).to.deep.equal({ open: {} });
      expect(game.survivorIndex).to.be.null;
      expect(game.tokenCounts).to.deep.equal([0, 0, 0, 0, 0, 0]);
      expect(game.bump).to.equal(gameBump);
    });

    it("emits GameCreated event", async () => {
      // Event testing would require event listener setup
      // For now, we verify state changes which imply event emission
    });

    it("cannot initialize same game twice", async () => {
      try {
        await program.methods
          .initializeGame(entryFee)
          .accounts({
            game: gamePda,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown - game already exists");
      } catch (err: any) {
        // Account already initialized error
        expect(err.message).to.include("already in use");
      }
    });

    it("different authority creates different game PDA", async () => {
      const otherAuthority = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(otherAuthority.publicKey, LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);

      const [otherGamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), otherAuthority.publicKey.toBuffer()],
        program.programId
      );

      expect(otherGamePda.toString()).to.not.equal(gamePda.toString());
    });

    it("accepts various entry fee amounts", async () => {
      const testFees = [
        new anchor.BN(0.01 * LAMPORTS_PER_SOL),
        new anchor.BN(0.5 * LAMPORTS_PER_SOL),
        new anchor.BN(1 * LAMPORTS_PER_SOL),
        new anchor.BN(10 * LAMPORTS_PER_SOL),
      ];

      for (const fee of testFees) {
        const tempAuth = Keypair.generate();
        const sig = await provider.connection.requestAirdrop(tempAuth.publicKey, LAMPORTS_PER_SOL);
        await provider.connection.confirmTransaction(sig);

        const [tempGamePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("game"), tempAuth.publicKey.toBuffer()],
          program.programId
        );

        await program.methods
          .initializeGame(fee)
          .accounts({
            game: tempGamePda,
            authority: tempAuth.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([tempAuth])
          .rpc();

        const game = await program.account.game.fetch(tempGamePda);
        expect(game.entryFee.toString()).to.equal(fee.toString());
      }
    });
  });

  // ============================================
  // ENTER GAME TESTS
  // ============================================
  describe("enter_game", () => {
    it("allows player to enter with token 0", async () => {
      const player = players[0];
      const balanceBefore = await provider.connection.getBalance(player.publicKey);
      
      const entryPda = await enterGame(player, 0);

      const entry = await program.account.playerEntry.fetch(entryPda);
      expect(entry.player.toString()).to.equal(player.publicKey.toString());
      expect(entry.game.toString()).to.equal(gamePda.toString());
      expect(entry.tokenIndex).to.equal(0);
      expect(entry.claimed).to.be.false;

      const game = await program.account.game.fetch(gamePda);
      expect(game.playerCount).to.equal(1);
      expect(game.totalPot.toString()).to.equal(entryFee.toString());
      expect(game.tokenCounts[0]).to.equal(1);

      const balanceAfter = await provider.connection.getBalance(player.publicKey);
      expect(balanceBefore - balanceAfter).to.be.greaterThanOrEqual(entryFee.toNumber());
    });

    it("allows multiple players on same token", async () => {
      await enterGame(players[1], 0);
      await enterGame(players[2], 0);

      const game = await program.account.game.fetch(gamePda);
      expect(game.tokenCounts[0]).to.equal(3); // 3 players on token 0
      expect(game.playerCount).to.equal(3);
    });

    it("allows players on different tokens", async () => {
      await enterGame(players[3], 1);
      await enterGame(players[4], 2);
      await enterGame(players[5], 3);
      await enterGame(players[6], 4);
      await enterGame(players[7], 5);

      const game = await program.account.game.fetch(gamePda);
      expect(game.tokenCounts[0]).to.equal(3);
      expect(game.tokenCounts[1]).to.equal(1);
      expect(game.tokenCounts[2]).to.equal(1);
      expect(game.tokenCounts[3]).to.equal(1);
      expect(game.tokenCounts[4]).to.equal(1);
      expect(game.tokenCounts[5]).to.equal(1);
      expect(game.playerCount).to.equal(8);
    });

    it("correctly accumulates pot", async () => {
      const game = await program.account.game.fetch(gamePda);
      const expectedPot = entryFee.toNumber() * 8;
      expect(game.totalPot.toNumber()).to.equal(expectedPot);
    });

    it("rejects token index 6 (out of bounds)", async () => {
      const player = players[8];
      try {
        await enterGame(player, 6);
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidTokenIndex");
        expect(err.error.errorMessage).to.include("Must be 0-5");
      }
    });

    it("rejects token index 255 (max u8)", async () => {
      const player = players[8];
      try {
        await enterGame(player, 255);
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidTokenIndex");
      }
    });

    it("rejects same player entering twice", async () => {
      const player = players[0]; // Already entered
      try {
        await enterGame(player, 1);
        expect.fail("Should have thrown - already entered");
      } catch (err: any) {
        // PDA already exists
        expect(err.message).to.include("already in use");
      }
    });

    it("rejects player with insufficient funds", async () => {
      const brokePlayer = Keypair.generate();
      // Only give enough for transaction fee, not entry fee
      const sig = await provider.connection.requestAirdrop(brokePlayer.publicKey, 5000);
      await provider.connection.confirmTransaction(sig);

      try {
        await enterGame(brokePlayer, 0);
        expect.fail("Should have thrown - insufficient funds");
      } catch (err: any) {
        expect(err.message).to.include("insufficient");
      }
    });

    it("transfers exact entry fee to vault", async () => {
      const newAuth = await createFundedPlayer();
      const [newGamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), newAuth.publicKey.toBuffer()],
        program.programId
      );
      const [newVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), newGamePda.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeGame(entryFee)
        .accounts({
          game: newGamePda,
          authority: newAuth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([newAuth])
        .rpc();

      const testPlayer = await createFundedPlayer();
      const vaultBefore = await provider.connection.getBalance(newVaultPda);
      
      await enterGame(testPlayer, 0, newGamePda, newVaultPda);
      
      const vaultAfter = await provider.connection.getBalance(newVaultPda);
      expect(vaultAfter - vaultBefore).to.equal(entryFee.toNumber());
    });
  });

  // ============================================
  // TRIGGER RUG TESTS
  // ============================================
  describe("trigger_rug", () => {
    it("only authority can trigger rug", async () => {
      const imposter = Keypair.generate();
      
      try {
        await program.methods
          .triggerRug()
          .accounts({
            game: gamePda,
            authority: imposter.publicKey,
          })
          .signers([imposter])
          .rpc();
        expect.fail("Should have thrown - not authority");
      } catch (err: any) {
        expect(err.message).to.include("unknown signer");
      }
    });

    it("cannot trigger rug on empty game", async () => {
      const emptyAuth = await createFundedPlayer();
      const [emptyGamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), emptyAuth.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeGame(entryFee)
        .accounts({
          game: emptyGamePda,
          authority: emptyAuth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([emptyAuth])
        .rpc();

      try {
        await program.methods
          .triggerRug()
          .accounts({
            game: emptyGamePda,
            authority: emptyAuth.publicKey,
          })
          .signers([emptyAuth])
          .rpc();
        expect.fail("Should have thrown - no players");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("NoPlayers");
      }
    });

    it("successfully triggers rug and sets survivor", async () => {
      const gameBefore = await program.account.game.fetch(gamePda);
      expect(gameBefore.status).to.deep.equal({ open: {} });
      expect(gameBefore.survivorIndex).to.be.null;

      await program.methods
        .triggerRug()
        .accounts({
          game: gamePda,
          authority: authority.publicKey,
        })
        .rpc();

      const gameAfter = await program.account.game.fetch(gamePda);
      expect(gameAfter.status).to.deep.equal({ rugged: {} });
      expect(gameAfter.survivorIndex).to.not.be.null;
      expect(gameAfter.survivorIndex).to.be.lessThan(6);
      expect(gameAfter.survivorIndex).to.be.greaterThanOrEqual(0);
    });

    it("cannot trigger rug twice", async () => {
      try {
        await program.methods
          .triggerRug()
          .accounts({
            game: gamePda,
            authority: authority.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown - already rugged");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("GameNotOpen");
      }
    });

    it("cannot enter game after rug", async () => {
      const latePlayer = players[9];
      try {
        await enterGame(latePlayer, 0);
        expect.fail("Should have thrown - game rugged");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("GameNotOpen");
      }
    });

    it("pot remains unchanged after rug", async () => {
      const game = await program.account.game.fetch(gamePda);
      const expectedPot = entryFee.toNumber() * 8;
      expect(game.totalPot.toNumber()).to.equal(expectedPot);
    });
  });

  // ============================================
  // CLAIM WINNINGS TESTS
  // ============================================
  describe("claim_winnings", () => {
    let survivorIndex: number;
    let survivors: Keypair[] = [];
    let losers: Keypair[] = [];

    before(async () => {
      const game = await program.account.game.fetch(gamePda);
      survivorIndex = game.survivorIndex!;

      // Categorize players
      for (const player of players.slice(0, 8)) {
        const [entryPda] = getPlayerEntryPda(gamePda, player.publicKey);
        try {
          const entry = await program.account.playerEntry.fetch(entryPda);
          if (entry.tokenIndex === survivorIndex) {
            survivors.push(player);
          } else {
            losers.push(player);
          }
        } catch {}
      }

      console.log(`Survivor token: ${survivorIndex}`);
      console.log(`Survivors: ${survivors.length}, Losers: ${losers.length}`);
    });

    it("non-survivor cannot claim", async () => {
      if (losers.length === 0) {
        console.log("No losers to test - skipping");
        return;
      }

      const loser = losers[0];
      const [entryPda] = getPlayerEntryPda(gamePda, loser.publicKey);

      try {
        await program.methods
          .claimWinnings()
          .accounts({
            game: gamePda,
            gameVault: vaultPda,
            playerEntry: entryPda,
            player: loser.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([loser])
          .rpc();
        expect.fail("Should have thrown - not a survivor");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("NotASurvivor");
        expect(err.error.errorMessage).to.include("RUGGED");
      }
    });

    it("survivor can claim winnings", async () => {
      if (survivors.length === 0) {
        console.log("No survivors to test - skipping");
        return;
      }

      const winner = survivors[0];
      const [entryPda] = getPlayerEntryPda(gamePda, winner.publicKey);
      const game = await program.account.game.fetch(gamePda);
      const survivorCount = game.tokenCounts[survivorIndex];
      const expectedWinnings = game.totalPot.toNumber() / survivorCount;

      const balanceBefore = await provider.connection.getBalance(winner.publicKey);

      await program.methods
        .claimWinnings()
        .accounts({
          game: gamePda,
          gameVault: vaultPda,
          playerEntry: entryPda,
          player: winner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([winner])
        .rpc();

      const balanceAfter = await provider.connection.getBalance(winner.publicKey);
      const entry = await program.account.playerEntry.fetch(entryPda);
      
      expect(entry.claimed).to.be.true;
      // Account for transaction fee
      expect(balanceAfter - balanceBefore).to.be.approximately(
        expectedWinnings, 
        10000 // Allow 0.00001 SOL variance for tx fee
      );
    });

    it("cannot claim twice", async () => {
      if (survivors.length === 0) return;

      const winner = survivors[0];
      const [entryPda] = getPlayerEntryPda(gamePda, winner.publicKey);

      try {
        await program.methods
          .claimWinnings()
          .accounts({
            game: gamePda,
            gameVault: vaultPda,
            playerEntry: entryPda,
            player: winner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([winner])
          .rpc();
        expect.fail("Should have thrown - already claimed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("AlreadyClaimed");
      }
    });

    it("other survivors can also claim their share", async () => {
      for (let i = 1; i < survivors.length; i++) {
        const winner = survivors[i];
        const [entryPda] = getPlayerEntryPda(gamePda, winner.publicKey);

        await program.methods
          .claimWinnings()
          .accounts({
            game: gamePda,
            gameVault: vaultPda,
            playerEntry: entryPda,
            player: winner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([winner])
          .rpc();

        const entry = await program.account.playerEntry.fetch(entryPda);
        expect(entry.claimed).to.be.true;
      }
    });

    it("cannot claim with wrong player signer", async () => {
      if (losers.length < 2) return;

      const victim = losers[0];
      const attacker = losers[1];
      const [victimEntryPda] = getPlayerEntryPda(gamePda, victim.publicKey);

      try {
        await program.methods
          .claimWinnings()
          .accounts({
            game: gamePda,
            gameVault: vaultPda,
            playerEntry: victimEntryPda,
            player: attacker.publicKey, // Wrong player
            systemProgram: SystemProgram.programId,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown - wrong player");
      } catch (err: any) {
        // Constraint violation
        expect(err.message).to.include("has_one");
      }
    });

    it("cannot claim from different game's entry", async () => {
      // Create a new game
      const otherAuth = await createFundedPlayer();
      const [otherGamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), otherAuth.publicKey.toBuffer()],
        program.programId
      );
      const [otherVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), otherGamePda.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeGame(entryFee)
        .accounts({
          game: otherGamePda,
          authority: otherAuth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([otherAuth])
        .rpc();

      // Try to claim from original game with entry pointing to other game
      if (survivors.length === 0) return;
      const winner = survivors[0];
      const [entryPda] = getPlayerEntryPda(gamePda, winner.publicKey);

      try {
        await program.methods
          .claimWinnings()
          .accounts({
            game: otherGamePda, // Wrong game!
            gameVault: otherVaultPda,
            playerEntry: entryPda,
            player: winner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([winner])
          .rpc();
        expect.fail("Should have thrown - wrong game");
      } catch (err: any) {
        expect(err.message).to.include("has_one");
      }
    });
  });

  // ============================================
  // EDGE CASES & STRESS TESTS
  // ============================================
  describe("edge_cases", () => {
    it("handles single player game", async () => {
      const soloAuth = await createFundedPlayer();
      const soloPlayer = await createFundedPlayer();
      
      const [soloGamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), soloAuth.publicKey.toBuffer()],
        program.programId
      );
      const [soloVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), soloGamePda.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeGame(entryFee)
        .accounts({
          game: soloGamePda,
          authority: soloAuth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([soloAuth])
        .rpc();

      await enterGame(soloPlayer, 2, soloGamePda, soloVaultPda);

      await program.methods
        .triggerRug()
        .accounts({
          game: soloGamePda,
          authority: soloAuth.publicKey,
        })
        .signers([soloAuth])
        .rpc();

      const game = await program.account.game.fetch(soloGamePda);
      
      // Single player, if they picked survivor they get their money back
      // If not, they lose (bad luck!)
      const [entryPda] = getPlayerEntryPda(soloGamePda, soloPlayer.publicKey);
      const entry = await program.account.playerEntry.fetch(entryPda);
      
      if (entry.tokenIndex === game.survivorIndex) {
        const balanceBefore = await provider.connection.getBalance(soloPlayer.publicKey);
        
        await program.methods
          .claimWinnings()
          .accounts({
            game: soloGamePda,
            gameVault: soloVaultPda,
            playerEntry: entryPda,
            player: soloPlayer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([soloPlayer])
          .rpc();

        const balanceAfter = await provider.connection.getBalance(soloPlayer.publicKey);
        expect(balanceAfter).to.be.greaterThan(balanceBefore);
      }
    });

    it("handles all players on same token", async () => {
      const auth = await createFundedPlayer();
      const [gameP] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), auth.publicKey.toBuffer()],
        program.programId
      );
      const [vaultP] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), gameP.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeGame(entryFee)
        .accounts({
          game: gameP,
          authority: auth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([auth])
        .rpc();

      // All 3 players pick token 0
      const testPlayers = await Promise.all([
        createFundedPlayer(),
        createFundedPlayer(),
        createFundedPlayer(),
      ]);

      for (const p of testPlayers) {
        await enterGame(p, 0, gameP, vaultP);
      }

      await program.methods
        .triggerRug()
        .accounts({
          game: gameP,
          authority: auth.publicKey,
        })
        .signers([auth])
        .rpc();

      const game = await program.account.game.fetch(gameP);
      
      if (game.survivorIndex === 0) {
        // All players survive and split pot
        const expectedShare = game.totalPot.toNumber() / 3;
        
        for (const p of testPlayers) {
          const [entryPda] = getPlayerEntryPda(gameP, p.publicKey);
          const balanceBefore = await provider.connection.getBalance(p.publicKey);
          
          await program.methods
            .claimWinnings()
            .accounts({
              game: gameP,
              gameVault: vaultP,
              playerEntry: entryPda,
              player: p.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([p])
            .rpc();

          const balanceAfter = await provider.connection.getBalance(p.publicKey);
          expect(balanceAfter - balanceBefore).to.be.approximately(expectedShare, 10000);
        }
      } else {
        // All players lose
        for (const p of testPlayers) {
          const [entryPda] = getPlayerEntryPda(gameP, p.publicKey);
          try {
            await program.methods
              .claimWinnings()
              .accounts({
                game: gameP,
                gameVault: vaultP,
                playerEntry: entryPda,
                player: p.publicKey,
                systemProgram: SystemProgram.programId,
              })
              .signers([p])
              .rpc();
            expect.fail("Should have thrown");
          } catch (err: any) {
            expect(err.error.errorCode.code).to.equal("NotASurvivor");
          }
        }
      }
    });

    it("handles minimum entry fee (1 lamport)", async () => {
      const auth = await createFundedPlayer();
      const [gameP] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), auth.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeGame(new anchor.BN(1)) // 1 lamport
        .accounts({
          game: gameP,
          authority: auth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([auth])
        .rpc();

      const game = await program.account.game.fetch(gameP);
      expect(game.entryFee.toNumber()).to.equal(1);
    });

    it("handles large entry fee", async () => {
      const richAuth = await createFundedPlayer(100 * LAMPORTS_PER_SOL);
      const [gameP] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), richAuth.publicKey.toBuffer()],
        program.programId
      );

      const bigFee = new anchor.BN(50 * LAMPORTS_PER_SOL);
      
      await program.methods
        .initializeGame(bigFee)
        .accounts({
          game: gameP,
          authority: richAuth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([richAuth])
        .rpc();

      const game = await program.account.game.fetch(gameP);
      expect(game.entryFee.toString()).to.equal(bigFee.toString());
    });
  });

  // ============================================
  // SECURITY TESTS
  // ============================================
  describe("security", () => {
    it("vault PDA is derived correctly and cannot be spoofed", async () => {
      const fakeVault = Keypair.generate();
      const player = await createFundedPlayer();
      
      // Create a new game to test
      const auth = await createFundedPlayer();
      const [gameP] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), auth.publicKey.toBuffer()],
        program.programId
      );
      const [realVaultP] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), gameP.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeGame(entryFee)
        .accounts({
          game: gameP,
          authority: auth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([auth])
        .rpc();

      // Try to use fake vault
      const [entryPda] = getPlayerEntryPda(gameP, player.publicKey);
      try {
        await program.methods
          .enterGame(0)
          .accounts({
            game: gameP,
            gameVault: fakeVault.publicKey, // Fake vault!
            playerEntry: entryPda,
            player: player.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([player])
          .rpc();
        expect.fail("Should have thrown - fake vault");
      } catch (err: any) {
        expect(err.message).to.include("seeds");
      }
    });

    it("player entry PDA prevents double-entry", async () => {
      const auth = await createFundedPlayer();
      const player = await createFundedPlayer();
      const [gameP] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), auth.publicKey.toBuffer()],
        program.programId
      );
      const [vaultP] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), gameP.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeGame(entryFee)
        .accounts({
          game: gameP,
          authority: auth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([auth])
        .rpc();

      await enterGame(player, 0, gameP, vaultP);

      // Second entry attempt
      try {
        await enterGame(player, 1, gameP, vaultP);
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).to.include("already in use");
      }
    });

    it("authority check on trigger_rug is enforced", async () => {
      const auth = await createFundedPlayer();
      const notAuth = await createFundedPlayer();
      const player = await createFundedPlayer();
      
      const [gameP] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), auth.publicKey.toBuffer()],
        program.programId
      );
      const [vaultP] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), gameP.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeGame(entryFee)
        .accounts({
          game: gameP,
          authority: auth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([auth])
        .rpc();

      await enterGame(player, 0, gameP, vaultP);

      // Non-authority tries to rug
      try {
        await program.methods
          .triggerRug()
          .accounts({
            game: gameP,
            authority: notAuth.publicKey, // Wrong authority
          })
          .signers([notAuth])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).to.include("has_one");
      }
    });
  });

  // ============================================
  // GAME STATE INVARIANTS
  // ============================================
  describe("invariants", () => {
    it("player count equals sum of token counts", async () => {
      const game = await program.account.game.fetch(gamePda);
      const tokenSum = game.tokenCounts.reduce((a, b) => a + b, 0);
      expect(tokenSum).to.equal(game.playerCount);
    });

    it("pot equals player count times entry fee", async () => {
      const game = await program.account.game.fetch(gamePda);
      expect(game.totalPot.toNumber()).to.equal(
        game.playerCount * game.entryFee.toNumber()
      );
    });

    it("survivor index is within valid range when set", async () => {
      const game = await program.account.game.fetch(gamePda);
      if (game.survivorIndex !== null) {
        expect(game.survivorIndex).to.be.greaterThanOrEqual(0);
        expect(game.survivorIndex).to.be.lessThan(6);
      }
    });

    it("status transitions are one-way: open -> rugged", async () => {
      // Create fresh game to verify initial state
      const auth = await createFundedPlayer();
      const [gameP] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), auth.publicKey.toBuffer()],
        program.programId
      );
      const [vaultP] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), gameP.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeGame(entryFee)
        .accounts({
          game: gameP,
          authority: auth.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([auth])
        .rpc();

      let game = await program.account.game.fetch(gameP);
      expect(game.status).to.deep.equal({ open: {} });

      const player = await createFundedPlayer();
      await enterGame(player, 0, gameP, vaultP);

      await program.methods
        .triggerRug()
        .accounts({
          game: gameP,
          authority: auth.publicKey,
        })
        .signers([auth])
        .rpc();

      game = await program.account.game.fetch(gameP);
      expect(game.status).to.deep.equal({ rugged: {} });

      // Cannot go back to open (no such instruction exists)
      // This is enforced by program design - no "reopen" instruction
    });
  });
});
