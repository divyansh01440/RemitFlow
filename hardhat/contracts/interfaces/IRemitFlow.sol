// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IRemitFlow — Interface for the RemitFlow remittance contract
/// @notice This file defines the "blueprint" for the RemitFlow smart contract.
///         Think of it like a menu — it lists what the contract CAN do,
///         but the actual cooking happens in RemitFlow.sol
/// @dev All functions here must be implemented in RemitFlow.sol

interface IRemitFlow {

    // ============================================================
    // 📢  EVENTS
    // These are like "receipts" — emitted every time something
    // important happens on the blockchain. Anyone can listen to them.
    // ============================================================

    /// @notice Fired when someone successfully sends USDC to another person
    /// @param sender      The wallet address of the person who sent money
    /// @param recipient   The wallet address of the person who received money
    /// @param amount      How much USDC was sent (in raw units, 6 decimals)
    /// @param fee         How much fee was charged (in raw units, 6 decimals)
    /// @param transferId  A unique ID for this transfer (like a receipt number)
    event RemittanceSent(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 fee,
        bytes32 transferId
    );

    /// @notice Fired when the recipient's side of a transfer is confirmed
    /// @param recipient   The wallet address of the person who received money
    /// @param amount      How much USDC they received (after fee deduction)
    /// @param transferId  The unique ID linking this to the original send
    event RemittanceReceived(
        address indexed recipient,
        uint256 amount,
        bytes32 transferId
    );

    /// @notice Fired when a user deposits USDC into the yield/savings pool
    /// @param user    The wallet address of the person who deposited
    /// @param amount  How much USDC they deposited (in raw units, 6 decimals)
    event YieldDeposited(
        address indexed user,
        uint256 amount
    );

    /// @notice Fired when a user withdraws their USDC + earned yield
    /// @param user         The wallet address of the person withdrawing
    /// @param amount       The original amount they deposited (principal)
    /// @param yieldEarned  The extra USDC they earned as yield/interest
    event YieldWithdrawn(
        address indexed user,
        uint256 amount,
        uint256 yieldEarned
    );

    /// @notice Fired when the contract owner changes the transaction fee
    /// @param newFeePercent  The new fee in basis points (e.g. 30 = 0.3%)
    event FeeUpdated(
        uint256 newFeePercent
    );


    // ============================================================
    // ⚙️  FUNCTIONS
    // These are the actions users can perform on the contract.
    // ============================================================

    /// @notice Sends USDC from the caller's wallet to the recipient's wallet
    /// @dev    Caller must have approved this contract to spend their USDC first.
    ///         The fee is automatically deducted and sent to the fee collector.
    ///         Think of it like a wire transfer — you send 100 USDC,
    ///         recipient gets 99.70 USDC, and 0.30 USDC goes to RemitFlow as fee.
    /// @param recipient  The wallet address of the person you want to send money to
    /// @param amount     How much USDC to send (in raw units — e.g. 1 USDC = 1000000)
    /// @return transferId  A unique bytes32 ID for this transfer (save it to track status)
    function sendRemittance(
        address recipient,
        uint256 amount
    ) external returns (bytes32 transferId);

    /// @notice Calculates how much fee will be charged for a given amount
    /// @dev    Fee is calculated as: amount * feePercent / 10000
    ///         Example: 100 USDC with 30 basis points = 0.30 USDC fee
    ///         Call this BEFORE sending to show the user what fee they'll pay.
    /// @param amount  The USDC amount you want to check the fee for
    /// @return        The fee amount in raw USDC units (6 decimals)
    function calculateFee(
        uint256 amount
    ) external view returns (uint256);

    /// @notice Deposits USDC into the yield pool to start earning 5% APY interest
    /// @dev    Caller must approve this contract to spend their USDC first.
    ///         The USDC is held by the contract and earns yield over time.
    ///         Users can withdraw at any time — there is no lock-up period.
    /// @param amount  How much USDC to deposit (in raw units, minimum > 0)
    function depositYield(
        uint256 amount
    ) external;

    /// @notice Withdraws USDC from the yield pool along with any earned interest
    /// @dev    Calculates yield earned since deposit time, adds it to withdrawal.
    ///         Yield formula: principal * 5% * (seconds elapsed / seconds in a year)
    ///         Reverts if user tries to withdraw more than their deposited balance.
    /// @param amount  How much of your deposited USDC you want to take back
    function withdrawYield(
        uint256 amount
    ) external;

    /// @notice Returns how much USDC a user has deposited in the yield pool
    /// @dev    This is the principal only — does NOT include pending yield.
    ///         To get the full value including yield, use calculateYield() and add it.
    /// @param user  The wallet address you want to check the balance for
    /// @return      The deposited USDC amount in raw units (6 decimals)
    function getUserBalance(
        address user
    ) external view returns (uint256);

    /// @notice Calculates how much yield/interest a user has earned so far
    /// @dev    This is a view function — it does NOT change any state or cost gas.
    ///         Uses simple interest: principal * APY_RATE * timeElapsed / (BASIS_POINTS * SECONDS_PER_YEAR)
    ///         Returns 0 if user has no deposit or deposited less than 1 second ago.
    /// @param user  The wallet address to calculate pending yield for
    /// @return      The pending yield amount in raw USDC units (6 decimals)
    function calculateYield(
        address user
    ) external view returns (uint256);

    /// @notice Checks the current status of a transfer using its unique ID
    /// @dev    Use the transferId returned from sendRemittance() to look up status.
    ///         Returns a number: 0 = Pending, 1 = Completed, 2 = Refunded
    ///         You can show these statuses in the frontend as labels.
    /// @param transferId  The unique bytes32 ID of the transfer to look up
    /// @return            Status code: 0 (Pending), 1 (Completed), 2 (Refunded)
    function getTransferStatus(
        bytes32 transferId
    ) external view returns (uint8);
}