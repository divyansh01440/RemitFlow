// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ============================================================
// ⚠️  FOR TESTING ONLY — DO NOT DEPLOY TO MAINNET
// ⚠️  This is a fake USDC token used only in local and testnet
// ⚠️  Real USDC on Polygon: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
// ============================================================

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC — A fake USDC token for testing RemitFlow
/// @notice This contract pretends to be USDC so we can test
///         sending, receiving, and earning yield without using real money.
///         It behaves exactly like real USDC (6 decimals, ERC20 standard)
///         but anyone can mint unlimited tokens for free.
contract MockUSDC is ERC20 {

    // ============================================================
    // 🏗️  CONSTRUCTOR
    // Runs ONCE when the contract is deployed.
    // Gives 1,000,000 mUSDC to whoever deploys the contract.
    // ============================================================

    /// @notice Deploys the MockUSDC token and mints 1,000,000 tokens to deployer
    /// @dev    1,000,000 tokens with 6 decimals = 1_000_000 * 10^6 = 1_000_000_000_000
    constructor() ERC20("Mock USDC", "mUSDC") {
        // Mint 1,000,000 mUSDC to the deployer wallet
        // 1_000_000 * 10**6 because USDC uses 6 decimal places
        // So "1 USDC" is stored as 1,000,000 in the contract
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }


    // ============================================================
    // 🔢  DECIMALS OVERRIDE
    // Real USDC uses 6 decimal places (not 18 like most tokens).
    // We override this so MockUSDC behaves identically to real USDC.
    // Example: "1.50 USDC" is stored as 1,500,000 internally.
    // ============================================================

    /// @notice Returns the number of decimal places this token uses
    /// @dev    Overrides ERC20 default of 18 decimals to match real USDC (6 decimals)
    /// @return Always returns 6
    function decimals() public pure override returns (uint8) {
        return 6;
    }


    // ============================================================
    // 🪙  MINT FUNCTION
    // In real USDC, only Circle (the company) can mint new tokens.
    // In our mock, ANYONE can mint — this is only safe for testing!
    // Use this in tests to give fake USDC to any test wallet address.
    // ============================================================

    /// @notice Creates new mUSDC tokens and sends them to any address
    /// @dev    ⚠️ No access control — anyone can call this — TESTING ONLY!
    ///         Use this in Hardhat tests to fund test wallets with tokens.
    ///         Example: mint(senderAddress, 500 * 10**6) gives 500 mUSDC
    /// @param to      The wallet address that will receive the minted tokens
    /// @param amount  How many tokens to mint in raw units (remember: 1 USDC = 1_000_000)
    function mint(address to, uint256 amount) public {
        // _mint is inherited from OpenZeppelin's ERC20
        // It increases total supply and adds tokens to the "to" address
        _mint(to, amount);
    }
}