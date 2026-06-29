// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IRemitFlow.sol";

/// @title RemitFlow — Cross-border USDC remittance contract on Polygon
/// @notice This is the main contract. It lets users:
///         1. Send USDC to anyone in the world instantly with a 0.3% fee
///         2. Deposit idle USDC to earn 5% APY yield
///         3. Withdraw their savings + earned interest anytime
/// @dev    Uses OpenZeppelin's SafeERC20 to safely handle USDC transfers.
///         ReentrancyGuard prevents "reentrancy attacks" (a common hack).
///         Ownable lets the deployer manage fees and emergency functions.
contract RemitFlow is IRemitFlow, Ownable, ReentrancyGuard {

    // Tell Solidity to use SafeERC20 functions on all IERC20 tokens
    // This means we call token.safeTransfer() instead of token.transfer()
    // SafeERC20 automatically checks the transfer succeeded and reverts if not
    using SafeERC20 for IERC20;


    // ============================================================
    // 📦  STATE VARIABLES
    // These are stored permanently on the blockchain.
    // ============================================================

    /// @notice The USDC token contract this remittance app uses
    /// @dev    Set once in constructor, never changes after deployment
    IERC20 public usdcToken;

    /// @notice The fee charged per transfer, in basis points
    /// @dev    30 basis points = 0.30% fee
    ///         Formula: fee = amount * feePercent / 10000
    ///         Example: 100 USDC * 30 / 10000 = 0.30 USDC fee
    ///         Owner can change this but never above 100 (max 1%)
    uint256 public feePercent = 30;

    /// @notice The wallet address that receives all collected fees
    /// @dev    Owner can update this via updateFeeCollector()
    address public feeCollector;

    /// @notice Annual yield rate for savings deposits, in basis points
    /// @dev    500 basis points = 5% APY. Constant — never changes.
    uint256 private constant APY_RATE = 500;

    /// @notice Used to convert basis points to percentages
    /// @dev    Divide by BASIS_POINTS to turn basis points into a decimal.
    ///         Example: 30 / 10000 = 0.003 = 0.3%
    uint256 private constant BASIS_POINTS = 10000;

    /// @notice Number of seconds in one year (used to calculate yield per second)
    /// @dev    365 days * 24 hours * 60 minutes * 60 seconds = 31,536,000
    uint256 private constant SECONDS_PER_YEAR = 31536000;

    /// @notice Tracks how much USDC each user has deposited for yield
    /// @dev    mapping: wallet address → deposited USDC amount (raw, 6 decimals)
    mapping(address => uint256) public yieldBalance;

    /// @notice Tracks when each user last deposited (or compounded) yield
    /// @dev    mapping: wallet address → Unix timestamp of last deposit/compound
    ///         Used to calculate how long their money has been earning interest
    mapping(address => uint256) public yieldTimestamp;

    /// @notice Stores the full record of every transfer ever made
    /// @dev    mapping: transferId (bytes32 hash) → TransferRecord struct
    mapping(bytes32 => TransferRecord) public transfers;


    // ============================================================
    // 🗃️  STRUCT
    // A struct is like a "row in a table" — groups related data together.
    // ============================================================

    /// @notice Stores all details about a single remittance transfer
    /// @dev    Saved to the transfers mapping using the transferId as key
    struct TransferRecord {
        address sender;     // Who sent the money
        address recipient;  // Who received the money
        uint256 amount;     // How much was sent (before fee deduction)
        uint256 fee;        // How much fee was charged
        uint256 timestamp;  // When the transfer happened (Unix timestamp)
        uint8 status;       // 0 = Pending, 1 = Completed, 2 = Refunded
    }


    // ============================================================
    // 🏗️  CONSTRUCTOR
    // Runs once when the contract is deployed to the blockchain.
    // ============================================================

    /// @notice Sets up the RemitFlow contract with USDC token and fee collector
    /// @dev    Ownable(msg.sender) makes the deployer the contract owner.
    ///         Owner can later update fees, fee collector, and do emergency withdrawals.
    /// @param _usdcToken     Address of the USDC token contract on Polygon
    ///                       Testnet (Amoy): use your deployed MockUSDC address
    ///                       Mainnet: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
    /// @param _feeCollector  Address that will receive all transaction fees
    ///                       Usually set to the deployer wallet initially
    constructor(
        address _usdcToken,
        address _feeCollector
    ) Ownable(msg.sender) {
        // Make sure neither address is the zero address (0x000...000)
        // Sending to zero address = burning tokens forever — we don't want that
        require(_usdcToken != address(0),    "RemitFlow: USDC address cannot be zero");
        require(_feeCollector != address(0), "RemitFlow: Fee collector cannot be zero");

        usdcToken    = IERC20(_usdcToken);
        feeCollector = _feeCollector;
    }


    // ============================================================
    // 💸  CORE FUNCTION 1: SEND REMITTANCE
    // ============================================================

    /// @notice Sends USDC from the caller to a recipient, deducting a small fee
    /// @dev    Flow:
    ///         1. Validate inputs (no zero address, no zero amount)
    ///         2. Calculate the fee
    ///         3. Pull full amount from sender into this contract
    ///         4. Push (amount - fee) to recipient
    ///         5. Push fee to feeCollector
    ///         6. Save transfer record to mapping
    ///         7. Emit events
    ///         IMPORTANT: Caller must call USDC.approve(remitflowAddress, amount) first!
    /// @param recipient  The wallet address receiving the USDC
    /// @param amount     Total USDC to send in raw units (1 USDC = 1,000,000)
    /// @return transferId  Unique bytes32 ID for this transfer — save this to track status
    function sendRemittance(
        address recipient,
        uint256 amount
    ) external override nonReentrant returns (bytes32 transferId) {

        // ── Validations ──────────────────────────────────────────
        require(recipient != address(0), "RemitFlow: Recipient cannot be zero address");
        require(recipient != msg.sender, "RemitFlow: Cannot send to yourself");
        require(amount > 0,              "RemitFlow: Amount must be greater than zero");

        // ── Calculate fee and net amount ─────────────────────────
        uint256 fee       = calculateFee(amount);
        uint256 netAmount = amount - fee;

        // Make sure net amount is still positive after fee deduction
        require(netAmount > 0, "RemitFlow: Amount too small after fee deduction");

        // ── Generate unique transfer ID ───────────────────────────
        // keccak256 creates a unique 32-byte hash from the inputs
        // Using block.timestamp + msg.sender means the same person
        // can send the same amount twice and get different IDs
        transferId = keccak256(
            abi.encodePacked(msg.sender, recipient, amount, block.timestamp)
        );

        // Make sure this transferId doesn't already exist (extremely unlikely but safe)
        require(
            transfers[transferId].sender == address(0),
            "RemitFlow: Transfer ID collision, try again"
        );

        // ── Transfer USDC ─────────────────────────────────────────
        // Pull total amount FROM sender INTO this contract first
        // (sender must have approved this contract beforehand)
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        // Push net amount (minus fee) from this contract TO recipient
        usdcToken.safeTransfer(recipient, netAmount);

        // Push fee from this contract TO fee collector wallet
        usdcToken.safeTransfer(feeCollector, fee);

        // ── Save transfer record ──────────────────────────────────
        transfers[transferId] = TransferRecord({
            sender:    msg.sender,
            recipient: recipient,
            amount:    amount,
            fee:       fee,
            timestamp: block.timestamp,
            status:    1  // Mark as Completed immediately (on-chain transfers are instant)
        });

        // ── Emit events ───────────────────────────────────────────
        // Frontend listens to these events to show transaction history
        emit RemittanceSent(msg.sender, recipient, amount, fee, transferId);
        emit RemittanceReceived(recipient, netAmount, transferId);
    }


    // ============================================================
    // 🧮  CORE FUNCTION 2: CALCULATE FEE
    // ============================================================

    /// @notice Returns the fee that will be charged for a given USDC amount
    /// @dev    Fee formula: amount * feePercent / 10000
    ///         With default 30 basis points:
    ///         100 USDC → fee = 100 * 30 / 10000 = 0.30 USDC
    ///         500 USDC → fee = 500 * 30 / 10000 = 1.50 USDC
    ///         Call this on the frontend to show users the fee before they confirm.
    /// @param amount  The USDC amount to calculate fee for (raw units)
    /// @return        The fee amount in raw USDC units (6 decimals)
    function calculateFee(
        uint256 amount
    ) public view override returns (uint256) {
        return (amount * feePercent) / BASIS_POINTS;
    }


    // ============================================================
    // 🏦  CORE FUNCTION 3: DEPOSIT YIELD
    // ============================================================

    /// @notice Deposits USDC into the yield pool to start earning 5% APY
    /// @dev    If the user already has a deposit:
    ///           → Auto-compounds: pending yield is added to their principal first
    ///           → Then the new deposit amount is added on top
    ///         This means yield starts earning interest on itself (compound interest).
    ///         IMPORTANT: Caller must call USDC.approve(remitflowAddress, amount) first!
    /// @param amount  How much USDC to deposit (raw units, must be > 0)
    function depositYield(
        uint256 amount
    ) external override nonReentrant {
        require(amount > 0, "RemitFlow: Deposit amount must be greater than zero");

        // ── Auto-compound existing yield ──────────────────────────
        // If user already has money deposited, calculate what they've earned so far
        // and add it to their principal before adding the new deposit.
        // This is called "compounding" — earning interest on your interest.
        if (yieldBalance[msg.sender] > 0) {
            uint256 pendingYield = calculateYield(msg.sender);
            if (pendingYield > 0) {
                // Add the earned yield to their principal balance
                yieldBalance[msg.sender] += pendingYield;
            }
        }

        // ── Update state BEFORE transferring tokens ───────────────
        // (Security best practice: always update state before external calls)
        yieldBalance[msg.sender]   += amount;
        yieldTimestamp[msg.sender]  = block.timestamp;

        // ── Pull USDC from user into this contract ────────────────
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        // ── Emit event ────────────────────────────────────────────
        emit YieldDeposited(msg.sender, amount);
    }


    // ============================================================
    // 💰  CORE FUNCTION 4: WITHDRAW YIELD
    // ============================================================

    /// @notice Withdraws USDC from the yield pool, including any earned interest
    /// @dev    Flow:
    ///         1. Check user has enough balance
    ///         2. Calculate yield earned since last deposit/compound
    ///         3. Deduct requested amount from principal
    ///         4. Reset timestamp (yield starts fresh from now)
    ///         5. Transfer principal + yield to user
    ///         If user withdraws their full balance, their yield state is fully reset.
    /// @param amount  How much of the deposited principal to withdraw (raw units)
    function withdrawYield(
        uint256 amount
    ) external override nonReentrant {
        require(amount > 0,                              "RemitFlow: Withdraw amount must be greater than zero");
        require(yieldBalance[msg.sender] >= amount,      "RemitFlow: Insufficient yield balance");

        // ── Calculate yield earned so far ─────────────────────────
        // This is the interest earned on the FULL balance, before deducting withdrawal
        uint256 yieldEarned = calculateYield(msg.sender);

        // ── Total payout = requested amount + all yield earned ────
        uint256 totalPayout = amount + yieldEarned;

        // ── Update state BEFORE transferring ─────────────────────
        yieldBalance[msg.sender]  -= amount;
        yieldTimestamp[msg.sender] = block.timestamp; // Reset timer so remaining balance starts fresh

        // If user withdrew everything, clean up their storage slot
        if (yieldBalance[msg.sender] == 0) {
            yieldTimestamp[msg.sender] = 0;
        }

        // ── Transfer USDC + yield to the user ────────────────────
        usdcToken.safeTransfer(msg.sender, totalPayout);

        // ── Emit event ────────────────────────────────────────────
        emit YieldWithdrawn(msg.sender, amount, yieldEarned);
    }


    // ============================================================
    // 📊  CORE FUNCTION 5: CALCULATE YIELD (VIEW)
    // ============================================================

    /// @notice Calculates how much yield/interest a user has earned so far
    /// @dev    Uses simple interest formula (not compound between calls):
    ///         yield = principal * APY_RATE * timeElapsed / (BASIS_POINTS * SECONDS_PER_YEAR)
    ///
    ///         Example with 1000 USDC deposited for 30 days:
    ///         timeElapsed = 30 * 24 * 60 * 60 = 2,592,000 seconds
    ///         yield = 1,000,000,000 * 500 * 2,592,000 / (10,000 * 31,536,000)
    ///               = ~4,109,589 raw units = ~4.11 USDC earned
    ///
    ///         This is a VIEW function — free to call, no gas cost, changes nothing.
    /// @param user  The wallet address to calculate pending yield for
    /// @return      Yield earned in raw USDC units (6 decimals). Returns 0 if no deposit.
    function calculateYield(
        address user
    ) public view override returns (uint256) {
        // If user has no deposit or timestamp not set, yield is 0
        if (yieldBalance[user] == 0 || yieldTimestamp[user] == 0) {
            return 0;
        }

        // How many seconds have passed since they last deposited/compounded
        uint256 timeElapsed = block.timestamp - yieldTimestamp[user];

        // Simple interest formula:
        // interest = principal × rate × time
        // Where rate = APY_RATE / BASIS_POINTS = 500 / 10000 = 0.05 (5%)
        // And time = timeElapsed / SECONDS_PER_YEAR (fraction of a year)
        return (yieldBalance[user] * APY_RATE * timeElapsed) / (BASIS_POINTS * SECONDS_PER_YEAR);
    }


    // ============================================================
    // 👁️  CORE FUNCTION 6: GET USER BALANCE (VIEW)
    // ============================================================

    /// @notice Returns how much USDC a user has deposited in the yield pool
    /// @dev    Returns principal only — does NOT include pending yield.
    ///         To get total value: getUserBalance(user) + calculateYield(user)
    /// @param user  The wallet address to check
    /// @return      Deposited USDC amount in raw units (6 decimals)
    function getUserBalance(
        address user
    ) external view override returns (uint256) {
        return yieldBalance[user];
    }


    // ============================================================
    // 🔍  CORE FUNCTION 7: GET TRANSFER STATUS (VIEW)
    // ============================================================

    /// @notice Returns the current status of a transfer
    /// @dev    Look up transfers using the transferId from sendRemittance().
    ///         Returns 0 if transferId doesn't exist (never created).
    /// @param transferId  The bytes32 ID returned from sendRemittance()
    /// @return            0 = Pending, 1 = Completed, 2 = Refunded
    function getTransferStatus(
        bytes32 transferId
    ) external view override returns (uint8) {
        return transfers[transferId].status;
    }


    // ============================================================
    // 🔐  ADMIN FUNCTIONS (Owner Only)
    // Only the wallet that deployed this contract can call these.
    // ============================================================

    /// @notice Updates the transaction fee percentage
    /// @dev    Fee is in basis points. Max allowed is 100 (= 1%).
    ///         Cannot set fee higher than 1% — protects users from excessive fees.
    ///         Example values: 10 = 0.1%, 30 = 0.3%, 50 = 0.5%, 100 = 1%
    /// @param newFee  New fee in basis points (must be between 0 and 100)
    function updateFee(uint256 newFee) external onlyOwner {
        require(newFee <= 100, "RemitFlow: Fee cannot exceed 1% (100 basis points)");
        feePercent = newFee;
        emit FeeUpdated(newFee);
    }

    /// @notice Updates the wallet address that receives collected fees
    /// @dev    Use this if you want fees sent to a different wallet or multisig.
    ///         Cannot be set to zero address.
    /// @param newCollector  The new wallet address to receive fees
    function updateFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "RemitFlow: Fee collector cannot be zero address");
        feeCollector = newCollector;
    }

    /// @notice Emergency function to withdraw ALL USDC from the contract to owner
    /// @dev    ⚠️  USE WITH EXTREME CAUTION — only for genuine emergencies
    ///         (e.g. contract exploit discovered, need to protect user funds)
    ///         Withdraws the entire USDC balance of this contract to the owner wallet.
    ///         This includes both yield pool funds AND any funds in transit.
    ///         After calling this, the contract should be paused/deprecated.
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 contractBalance = usdcToken.balanceOf(address(this));
        require(contractBalance > 0, "RemitFlow: No USDC balance to withdraw");

        usdcToken.safeTransfer(owner(), contractBalance);
    }
}