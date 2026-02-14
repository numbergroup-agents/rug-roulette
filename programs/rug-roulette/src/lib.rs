use anchor_lang::prelude::*;

declare_id!("RUGRou1ette1111111111111111111111111111111");

pub const NUM_TOKENS: usize = 6;
pub const NUM_RUGS: usize = 5;

#[program]
pub mod rug_roulette {
    use super::*;

    /// Initialize a new game round
    pub fn initialize_game(ctx: Context<InitializeGame>, entry_fee: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.authority = ctx.accounts.authority.key();
        game.entry_fee = entry_fee;
        game.total_pot = 0;
        game.player_count = 0;
        game.status = GameStatus::Open;
        game.survivor_index = None;
        game.token_counts = [0u32; NUM_TOKENS];
        game.bump = ctx.bumps.game;
        
        emit!(GameCreated {
            game: game.key(),
            authority: game.authority,
            entry_fee,
        });
        
        Ok(())
    }

    /// Player enters the game by picking a token (0-5)
    pub fn enter_game(ctx: Context<EnterGame>, token_index: u8) -> Result<()> {
        require!(token_index < NUM_TOKENS as u8, RugRouletteError::InvalidTokenIndex);
        
        let game = &mut ctx.accounts.game;
        require!(game.status == GameStatus::Open, RugRouletteError::GameNotOpen);
        
        // Transfer entry fee to game vault
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.game_vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, game.entry_fee)?;
        
        // Record player entry
        let entry = &mut ctx.accounts.player_entry;
        entry.player = ctx.accounts.player.key();
        entry.game = game.key();
        entry.token_index = token_index;
        entry.claimed = false;
        entry.bump = ctx.bumps.player_entry;
        
        game.total_pot += game.entry_fee;
        game.player_count += 1;
        game.token_counts[token_index as usize] += 1;
        
        emit!(PlayerEntered {
            game: game.key(),
            player: ctx.accounts.player.key(),
            token_index,
            total_pot: game.total_pot,
        });
        
        Ok(())
    }

    /// Authority triggers the rug - determines survivor randomly
    pub fn trigger_rug(ctx: Context<TriggerRug>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.status == GameStatus::Open, RugRouletteError::GameNotOpen);
        require!(game.player_count > 0, RugRouletteError::NoPlayers);
        
        // Simple randomness from slot hash (NOT secure for production - use VRF)
        let clock = Clock::get()?;
        let pseudo_random = clock.slot.wrapping_add(clock.unix_timestamp as u64);
        let survivor_index = (pseudo_random % NUM_TOKENS as u64) as u8;
        
        game.survivor_index = Some(survivor_index);
        game.status = GameStatus::Rugged;
        
        emit!(RugPulled {
            game: game.key(),
            survivor_index,
            total_pot: game.total_pot,
            survivor_count: game.token_counts[survivor_index as usize],
        });
        
        Ok(())
    }

    /// Survivor claims their share of the pot
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let game = &ctx.accounts.game;
        let entry = &mut ctx.accounts.player_entry;
        
        require!(game.status == GameStatus::Rugged, RugRouletteError::GameNotRugged);
        require!(!entry.claimed, RugRouletteError::AlreadyClaimed);
        
        let survivor_index = game.survivor_index.ok_or(RugRouletteError::NoSurvivor)?;
        require!(entry.token_index == survivor_index, RugRouletteError::NotASurvivor);
        
        let survivor_count = game.token_counts[survivor_index as usize];
        require!(survivor_count > 0, RugRouletteError::NoSurvivors);
        
        let winnings = game.total_pot / survivor_count as u64;
        
        // Transfer winnings from vault to player
        **ctx.accounts.game_vault.try_borrow_mut_lamports()? -= winnings;
        **ctx.accounts.player.try_borrow_mut_lamports()? += winnings;
        
        entry.claimed = true;
        
        emit!(WinningsClaimed {
            game: game.key(),
            player: ctx.accounts.player.key(),
            amount: winnings,
        });
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeGame<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Game::INIT_SPACE,
        seeds = [b"game", authority.key().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EnterGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    /// CHECK: Game vault PDA
    #[account(
        mut,
        seeds = [b"vault", game.key().as_ref()],
        bump
    )]
    pub game_vault: AccountInfo<'info>,
    
    #[account(
        init,
        payer = player,
        space = 8 + PlayerEntry::INIT_SPACE,
        seeds = [b"entry", game.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub player_entry: Account<'info, PlayerEntry>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TriggerRug<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub game: Account<'info, Game>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    /// CHECK: Game vault PDA
    #[account(
        mut,
        seeds = [b"vault", game.key().as_ref()],
        bump
    )]
    pub game_vault: AccountInfo<'info>,
    
    #[account(
        mut,
        has_one = player,
        has_one = game
    )]
    pub player_entry: Account<'info, PlayerEntry>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Game {
    pub authority: Pubkey,
    pub entry_fee: u64,
    pub total_pot: u64,
    pub player_count: u32,
    pub status: GameStatus,
    pub survivor_index: Option<u8>,
    #[max_len(6)]
    pub token_counts: [u32; NUM_TOKENS],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PlayerEntry {
    pub player: Pubkey,
    pub game: Pubkey,
    pub token_index: u8,
    pub claimed: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum GameStatus {
    Open,
    Rugged,
    Closed,
}

#[error_code]
pub enum RugRouletteError {
    #[msg("Invalid token index. Must be 0-5.")]
    InvalidTokenIndex,
    #[msg("Game is not open for entries.")]
    GameNotOpen,
    #[msg("Game has not been rugged yet.")]
    GameNotRugged,
    #[msg("No players in the game.")]
    NoPlayers,
    #[msg("No survivor has been determined.")]
    NoSurvivor,
    #[msg("You are not a survivor. RUGGED!")]
    NotASurvivor,
    #[msg("Winnings already claimed.")]
    AlreadyClaimed,
    #[msg("No survivors for this token.")]
    NoSurvivors,
}

#[event]
pub struct GameCreated {
    pub game: Pubkey,
    pub authority: Pubkey,
    pub entry_fee: u64,
}

#[event]
pub struct PlayerEntered {
    pub game: Pubkey,
    pub player: Pubkey,
    pub token_index: u8,
    pub total_pot: u64,
}

#[event]
pub struct RugPulled {
    pub game: Pubkey,
    pub survivor_index: u8,
    pub total_pot: u64,
    pub survivor_count: u32,
}

#[event]
pub struct WinningsClaimed {
    pub game: Pubkey,
    pub player: Pubkey,
    pub amount: u64,
}
