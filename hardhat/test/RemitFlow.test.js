const { expect }       = require("chai");
const { ethers }       = require("hardhat");
const { time }         = require("@nomicfoundation/hardhat-network-helpers");

// ============================================================
// 🧪  REMITFLOW TEST SUITE
// These tests check that every function in RemitFlow.sol
// works correctly before we deploy to a real blockchain.
//
// Run with: npx hardhat test
// Run with coverage: npx hardhat coverage
// ============================================================

describe("RemitFlow", function () {

  // ----------------------------------------------------------
  // 📦  SHARED VARIABLES
  // Declared here so all test suites can access them.
  // ----------------------------------------------------------
  let remitFlow;      // The main RemitFlow contract instance
  let mockUSDC;       // The fake USDC token contract instance
  let owner;          // The deployer / contract owner wallet
  let sender;         // Test wallet that sends remittances
  let recipient;      // Test wallet that receives remittances
  let other;          // Random wallet (for access control tests)

  // ----------------------------------------------------------
  // 💰  TEST AMOUNTS (all in raw USDC units with 6 decimals)
  // 1 USDC = 1_000_000 (6 decimal places, like real USDC)
  // We use BigInt (n suffix) for all on-chain number comparisons
  // ----------------------------------------------------------
  const ONE_USDC         = 1_000_000n;           // 1 USDC
  const TEN_THOUSAND_USDC = 10_000n * ONE_USDC;  // 10,000 USDC (sender's starting balance)
  const SEND_AMOUNT      = 1_000n * ONE_USDC;    // 1,000 USDC (used in most send tests)
  const FEE_PERCENT      = 30n;                   // 0.30% (30 basis points)
  const BASIS_POINTS     = 10_000n;               // Used for fee calculations

  // Helper: calculate expected fee for any amount
  // Mirrors the contract's calculateFee() logic exactly
  const expectedFee = (amount) => (amount * FEE_PERCENT) / BASIS_POINTS;


  // ============================================================
  // 🏗️  BEFORE ALL — Deploy contracts once before all tests
  // "before" runs ONCE before the entire test file.
  // We deploy here instead of beforeEach to save time.
  // ============================================================
  before(async function () {
    // Get test wallets provided by Hardhat (funded with fake ETH)
    [owner, sender, recipient, other] = await ethers.getSigners();

    console.log("\n  📋  Test Wallets:");
    console.log("      Owner    :", owner.address);
    console.log("      Sender   :", sender.address);
    console.log("      Recipient:", recipient.address);
    console.log("      Other    :", other.address);

    // Deploy MockUSDC — our fake USDC token for testing
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    console.log("\n  ✅  MockUSDC deployed:", await mockUSDC.getAddress());

    // Deploy RemitFlow with:
    //   arg1: MockUSDC address (the token it will use)
    //   arg2: owner address (who receives fees)
    const RemitFlow = await ethers.getContractFactory("RemitFlow");
    remitFlow = await RemitFlow.deploy(
      await mockUSDC.getAddress(),
      owner.address
    );
    await remitFlow.waitForDeployment();
    console.log("  ✅  RemitFlow deployed:", await remitFlow.getAddress());
  });


  // ============================================================
  // 🔄  BEFORE EACH — Reset sender's balance before every test
  // "beforeEach" runs before EVERY individual it() test.
  // This ensures each test starts with a clean state:
  //   - Sender has exactly 10,000 USDC
  //   - RemitFlow is approved to spend sender's USDC
  // ============================================================
  beforeEach(async function () {
    // Check sender's current balance and burn it back to 0
    // so every test starts with exactly 10,000 USDC
    const currentBalance = await mockUSDC.balanceOf(sender.address);
    if (currentBalance > 0n) {
      // Transfer existing balance away to reset to zero
      // (We send it to owner — doesn't matter where, just need to clear it)
      await mockUSDC.connect(sender).transfer(owner.address, currentBalance);
    }

    // Mint exactly 10,000 USDC to the sender for this test
    await mockUSDC.mint(sender.address, TEN_THOUSAND_USDC);

    // Approve RemitFlow to spend sender's USDC
    // We approve a very large amount so we don't have to re-approve each test
    // MaxUint256 = approve "unlimited" spending (common pattern in DeFi)
    await mockUSDC
      .connect(sender)
      .approve(await remitFlow.getAddress(), ethers.MaxUint256);
  });


  // ============================================================
  // 🏷️  TEST SUITE 1: DEPLOYMENT
  // Checks that the contract was set up correctly when deployed.
  // ============================================================
  describe("Deployment", function () {

    it("sets the correct USDC token address", async function () {
      // The usdcToken stored in the contract should match MockUSDC's address
      expect(await remitFlow.usdcToken())
        .to.equal(await mockUSDC.getAddress());
    });

    it("sets the correct owner", async function () {
      // The owner() function (from Ownable) should return the deployer's address
      expect(await remitFlow.owner())
        .to.equal(owner.address);
    });

    it("sets feePercent to 30 basis points (0.30%)", async function () {
      // Default fee should be 30 basis points = 0.30%
      expect(await remitFlow.feePercent())
        .to.equal(30n);
    });

    it("sets the correct feeCollector address", async function () {
      // feeCollector should be the owner address passed to constructor
      expect(await remitFlow.feeCollector())
        .to.equal(owner.address);
    });
  });


  // ============================================================
  // 💸  TEST SUITE 2: SEND REMITTANCE
  // Tests the core function: sending USDC from one user to another.
  // ============================================================
  describe("sendRemittance", function () {

    it("transfers the correct net amount to the recipient", async function () {
      // Calculate expected amounts
      const fee       = expectedFee(SEND_AMOUNT);   // 0.30% of 1000 USDC = 3 USDC
      const netAmount = SEND_AMOUNT - fee;            // 1000 - 3 = 997 USDC

      // Record recipient's balance BEFORE the transfer
      const balanceBefore = await mockUSDC.balanceOf(recipient.address);

      // Execute the transfer
      await remitFlow
        .connect(sender)
        .sendRemittance(recipient.address, SEND_AMOUNT);

      // Record recipient's balance AFTER the transfer
      const balanceAfter = await mockUSDC.balanceOf(recipient.address);

      // Recipient should have received exactly (amount - fee)
      expect(balanceAfter - balanceBefore).to.equal(netAmount);
    });

    it("sends the correct fee to the feeCollector", async function () {
      const fee = expectedFee(SEND_AMOUNT); // 3 USDC fee on 1000 USDC

      // Record feeCollector's balance BEFORE
      const feeCollectorBefore = await mockUSDC.balanceOf(owner.address);

      await remitFlow
        .connect(sender)
        .sendRemittance(recipient.address, SEND_AMOUNT);

      // Record feeCollector's balance AFTER
      const feeCollectorAfter = await mockUSDC.balanceOf(owner.address);

      // Fee collector should have received exactly the fee amount
      expect(feeCollectorAfter - feeCollectorBefore).to.equal(fee);
    });

    it("deducts the full amount from the sender's wallet", async function () {
      const senderBefore = await mockUSDC.balanceOf(sender.address);

      await remitFlow
        .connect(sender)
        .sendRemittance(recipient.address, SEND_AMOUNT);

      const senderAfter = await mockUSDC.balanceOf(sender.address);

      // Sender should have lost the full SEND_AMOUNT (fee comes out of this)
      expect(senderBefore - senderAfter).to.equal(SEND_AMOUNT);
    });

    it("emits a RemittanceSent event with correct arguments", async function () {
      const fee       = expectedFee(SEND_AMOUNT);
      const netAmount = SEND_AMOUNT - fee;

      // Chai's emit matcher checks that the event was emitted
      // We check: event name + all arguments match
      const tx = await remitFlow
        .connect(sender)
        .sendRemittance(recipient.address, SEND_AMOUNT);

      const receipt = await tx.wait();

      // Find the RemittanceSent event in the receipt logs
      const event = receipt.logs.find(
        log => {
          try {
            const parsed = remitFlow.interface.parseLog(log);
            return parsed.name === "RemittanceSent";
          } catch { return false; }
        }
      );

      expect(event).to.not.be.undefined;

      const parsed = remitFlow.interface.parseLog(event);
      expect(parsed.args.sender).to.equal(sender.address);
      expect(parsed.args.recipient).to.equal(recipient.address);
      expect(parsed.args.amount).to.equal(SEND_AMOUNT);
      expect(parsed.args.fee).to.equal(fee);
      // transferId should be a non-zero bytes32 hash
      expect(parsed.args.transferId).to.not.equal(ethers.ZeroHash);
    });

    it("emits a RemittanceReceived event", async function () {
      const fee       = expectedFee(SEND_AMOUNT);
      const netAmount = SEND_AMOUNT - fee;

      const tx = await remitFlow
        .connect(sender)
        .sendRemittance(recipient.address, SEND_AMOUNT);

      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return remitFlow.interface.parseLog(log).name === "RemittanceReceived";
        } catch { return false; }
      });

      expect(event).to.not.be.undefined;
      const parsed = remitFlow.interface.parseLog(event);
      expect(parsed.args.recipient).to.equal(recipient.address);
      expect(parsed.args.amount).to.equal(netAmount);
    });

    it("reverts if amount is 0", async function () {
      // Sending 0 USDC makes no sense — contract should reject it
      await expect(
        remitFlow.connect(sender).sendRemittance(recipient.address, 0n)
      ).to.be.revertedWith("RemitFlow: Amount must be greater than zero");
    });

    it("reverts if recipient is the zero address", async function () {
      // Sending to 0x000...000 would burn the tokens — reject it
      await expect(
        remitFlow.connect(sender).sendRemittance(ethers.ZeroAddress, SEND_AMOUNT)
      ).to.be.revertedWith("RemitFlow: Recipient cannot be zero address");
    });

    it("reverts if sender tries to send to themselves", async function () {
      await expect(
        remitFlow.connect(sender).sendRemittance(sender.address, SEND_AMOUNT)
      ).to.be.revertedWith("RemitFlow: Cannot send to yourself");
    });

    it("reverts if sender has insufficient USDC balance", async function () {
      // Try to send MORE than the sender's balance (10,000 USDC)
      const tooMuch = TEN_THOUSAND_USDC + ONE_USDC; // 10,001 USDC

      // ERC20 will revert because the transfer exceeds balance
      // The revert comes from SafeERC20/ERC20 internals
      await expect(
        remitFlow.connect(sender).sendRemittance(recipient.address, tooMuch)
      ).to.be.reverted;
    });

    it("saves the transfer record with correct status", async function () {
      const tx = await remitFlow
        .connect(sender)
        .sendRemittance(recipient.address, SEND_AMOUNT);

      const receipt = await tx.wait();

      // Extract transferId from the emitted event
      const event = receipt.logs.find(log => {
        try {
          return remitFlow.interface.parseLog(log).name === "RemittanceSent";
        } catch { return false; }
      });
      const parsed     = remitFlow.interface.parseLog(event);
      const transferId = parsed.args.transferId;

      // Look up the transfer record in the mapping
      const record = await remitFlow.transfers(transferId);

      expect(record.sender).to.equal(sender.address);
      expect(record.recipient).to.equal(recipient.address);
      expect(record.amount).to.equal(SEND_AMOUNT);
      expect(record.status).to.equal(1n); // 1 = Completed
    });
  });


  // ============================================================
  // 🧮  TEST SUITE 3: CALCULATE FEE
  // Tests the fee calculation helper function.
  // ============================================================
  describe("calculateFee", function () {

    it("returns 0.3% of the amount (1000 USDC → 3 USDC fee)", async function () {
      const amount      = 1_000n * ONE_USDC; // 1,000 USDC
      const expectedFeeAmt = 3n * ONE_USDC;  // 3 USDC = 0.3% of 1000

      expect(await remitFlow.calculateFee(amount))
        .to.equal(expectedFeeAmt);
    });

    it("returns correct fee for 100 USDC (should be 0.30 USDC)", async function () {
      const amount         = 100n * ONE_USDC;  // 100 USDC
      const expectedFeeAmt = 300_000n;          // 0.30 USDC (300,000 raw units)

      expect(await remitFlow.calculateFee(amount))
        .to.equal(expectedFeeAmt);
    });

    it("returns 0 fee for very small amounts (dust amounts)", async function () {
      // 1 raw unit (0.000001 USDC) → fee rounds down to 0
      // Integer division: 1 * 30 / 10000 = 0
      expect(await remitFlow.calculateFee(1n))
        .to.equal(0n);
    });

    it("returns correct fee for large amount (1,000,000 USDC)", async function () {
      const amount         = 1_000_000n * ONE_USDC; // 1 million USDC
      const expectedFeeAmt = 3_000n * ONE_USDC;      // 3,000 USDC fee

      expect(await remitFlow.calculateFee(amount))
        .to.equal(expectedFeeAmt);
    });
  });


  // ============================================================
  // 🏦  TEST SUITE 4: YIELD (DEPOSIT & WITHDRAW)
  // Tests the savings/yield pool feature.
  // ============================================================
  describe("Yield", function () {

    const DEPOSIT_AMOUNT = 1_000n * ONE_USDC; // 1,000 USDC for yield tests

    it("depositYield updates the user's yieldBalance correctly", async function () {
      // Balance should be 0 before deposit
      expect(await remitFlow.getUserBalance(sender.address))
        .to.equal(0n);

      await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);

      // Balance should now equal the deposited amount
      expect(await remitFlow.getUserBalance(sender.address))
        .to.equal(DEPOSIT_AMOUNT);
    });

    it("emits a YieldDeposited event with correct arguments", async function () {
      const tx      = await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return remitFlow.interface.parseLog(log).name === "YieldDeposited";
        } catch { return false; }
      });

      expect(event).to.not.be.undefined;
      const parsed = remitFlow.interface.parseLog(event);
      expect(parsed.args.user).to.equal(sender.address);
      expect(parsed.args.amount).to.equal(DEPOSIT_AMOUNT);
    });

    it("pulls USDC from the user's wallet on deposit", async function () {
      const balanceBefore = await mockUSDC.balanceOf(sender.address);

      await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);

      const balanceAfter = await mockUSDC.balanceOf(sender.address);

      // Sender's USDC balance should have decreased by the deposit amount
      expect(balanceBefore - balanceAfter).to.equal(DEPOSIT_AMOUNT);
    });

    it("calculateYield returns 0 immediately after deposit", async function () {
      await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);

      // Right after deposit, no time has passed, so yield should be 0
      // (or extremely close to 0 due to 1-2 second block time)
      const yield_ = await remitFlow.calculateYield(sender.address);
      expect(yield_).to.be.lessThanOrEqual(ONE_USDC); // Less than 1 USDC
    });

    it("calculateYield returns > 0 after 30 days pass", async function () {
      await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);

      // Fast-forward time by 30 days using Hardhat's time manipulation
      // This doesn't affect real time — only the blockchain's timestamp
      const THIRTY_DAYS = 30 * 24 * 60 * 60; // 30 days in seconds
      await time.increase(THIRTY_DAYS);

      const yieldEarned = await remitFlow.calculateYield(sender.address);

      // After 30 days at 5% APY on 1000 USDC:
      // yield = 1000 * 0.05 * (30/365) ≈ 4.11 USDC
      // In raw units ≈ 4,109,589 (just checking it's > 0)
      expect(yieldEarned).to.be.greaterThan(0n);

      console.log(`\n      💰  Yield after 30 days: ${ethers.formatUnits(yieldEarned, 6)} USDC`);
    });

    it("calculateYield returns approximately correct 5% APY after 1 year", async function () {
      await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);

      // Fast-forward exactly 1 year
      const ONE_YEAR = 365 * 24 * 60 * 60;
      await time.increase(ONE_YEAR);

      const yieldEarned = await remitFlow.calculateYield(sender.address);

      // After 1 year at 5% APY on 1000 USDC → should earn ~50 USDC
      const expectedYield = 50n * ONE_USDC; // 50 USDC
      const tolerance     = 1n * ONE_USDC;  // Allow ±1 USDC for rounding

      expect(yieldEarned).to.be.gte(expectedYield - tolerance);
      expect(yieldEarned).to.be.lte(expectedYield + tolerance);

      console.log(`\n      💰  Yield after 1 year: ${ethers.formatUnits(yieldEarned, 6)} USDC (expected ~50 USDC)`);
    });

    it("withdrawYield transfers principal + yield back to the user", async function () {
      await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);

      // Fast-forward 90 days
      const NINETY_DAYS = 90 * 24 * 60 * 60;
      await time.increase(NINETY_DAYS);

      // Calculate expected yield before withdrawing
      const expectedYield = await remitFlow.calculateYield(sender.address);

      // Record USDC balance before withdrawal
      const balanceBefore = await mockUSDC.balanceOf(sender.address);

      // Withdraw the full deposited amount
      await remitFlow.connect(sender).withdrawYield(DEPOSIT_AMOUNT);

      const balanceAfter = await mockUSDC.balanceOf(sender.address);
      const received     = balanceAfter - balanceBefore;

      // Should have received at least principal (yield calc can vary by 1 block)
      expect(received).to.be.gte(DEPOSIT_AMOUNT);
      // Should have received principal + some yield
      expect(received).to.be.gte(DEPOSIT_AMOUNT + expectedYield - ONE_USDC);

      console.log(`\n      💰  Received: ${ethers.formatUnits(received, 6)} USDC`);
      console.log(`      💰  Principal: ${ethers.formatUnits(DEPOSIT_AMOUNT, 6)} USDC`);
      console.log(`      💰  Yield:     ${ethers.formatUnits(received - DEPOSIT_AMOUNT, 6)} USDC`);
    });

    it("emits a YieldWithdrawn event with correct arguments", async function () {
      await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);
      await time.increase(30 * 24 * 60 * 60); // 30 days

      const tx      = await remitFlow.connect(sender).withdrawYield(DEPOSIT_AMOUNT);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return remitFlow.interface.parseLog(log).name === "YieldWithdrawn";
        } catch { return false; }
      });

      expect(event).to.not.be.undefined;
      const parsed = remitFlow.interface.parseLog(event);
      expect(parsed.args.user).to.equal(sender.address);
      expect(parsed.args.amount).to.equal(DEPOSIT_AMOUNT);
      expect(parsed.args.yieldEarned).to.be.greaterThan(0n);
    });

    it("resets yieldBalance to 0 after full withdrawal", async function () {
      await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);
      await remitFlow.connect(sender).withdrawYield(DEPOSIT_AMOUNT);

      expect(await remitFlow.getUserBalance(sender.address))
        .to.equal(0n);
    });

    it("reverts if user tries to withdraw more than their deposited balance", async function () {
      await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);

      const tooMuch = DEPOSIT_AMOUNT + ONE_USDC; // 1 USDC more than deposited

      await expect(
        remitFlow.connect(sender).withdrawYield(tooMuch)
      ).to.be.revertedWith("RemitFlow: Insufficient yield balance");
    });

    it("reverts if user has no deposit and tries to withdraw", async function () {
      // other wallet has never deposited anything
      await expect(
        remitFlow.connect(other).withdrawYield(ONE_USDC)
      ).to.be.revertedWith("RemitFlow: Insufficient yield balance");
    });

    it("reverts if deposit amount is 0", async function () {
      await expect(
        remitFlow.connect(sender).depositYield(0n)
      ).to.be.revertedWith("RemitFlow: Deposit amount must be greater than zero");
    });

    it("auto-compounds yield on second deposit", async function () {
      // First deposit
      await remitFlow.connect(sender).depositYield(DEPOSIT_AMOUNT);

      // Wait 180 days
      await time.increase(180 * 24 * 60 * 60);

      // Get yield earned before second deposit
      const yieldBefore = await remitFlow.calculateYield(sender.address);
      expect(yieldBefore).to.be.greaterThan(0n);

      // Make a second deposit — this should auto-compound the pending yield
      await remitFlow.connect(sender).depositYield(ONE_USDC);

      // After second deposit, the balance should be:
      // original deposit + auto-compounded yield + new deposit
      const newBalance = await remitFlow.getUserBalance(sender.address);
      expect(newBalance).to.be.gte(DEPOSIT_AMOUNT + yieldBefore + ONE_USDC - ONE_USDC);
    });
  });


  // ============================================================
  // 🔐  TEST SUITE 5: ADMIN FUNCTIONS
  // Tests that only the owner can call admin functions.
  // ============================================================
  describe("Admin", function () {

    it("owner can update feePercent", async function () {
      const newFee = 50n; // Change from 30 to 50 basis points (0.5%)

      await remitFlow.connect(owner).updateFee(newFee);

      expect(await remitFlow.feePercent()).to.equal(newFee);

      // Reset back to 30 for other tests
      await remitFlow.connect(owner).updateFee(30n);
    });

    it("updateFee emits FeeUpdated event", async function () {
      const tx      = await remitFlow.connect(owner).updateFee(50n);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return remitFlow.interface.parseLog(log).name === "FeeUpdated";
        } catch { return false; }
      });

      expect(event).to.not.be.undefined;
      const parsed = remitFlow.interface.parseLog(event);
      expect(parsed.args.newFeePercent).to.equal(50n);

      // Reset
      await remitFlow.connect(owner).updateFee(30n);
    });

    it("non-owner cannot update feePercent", async function () {
      // OpenZeppelin's Ownable uses this specific error message
      await expect(
        remitFlow.connect(other).updateFee(50n)
      ).to.be.revertedWithCustomError(remitFlow, "OwnableUnauthorizedAccount")
       .withArgs(other.address);
    });

    it("reverts if fee is set above 100 basis points (max 1%)", async function () {
      await expect(
        remitFlow.connect(owner).updateFee(101n)
      ).to.be.revertedWith("RemitFlow: Fee cannot exceed 1% (100 basis points)");
    });

    it("owner can set fee to exactly 100 basis points (max allowed)", async function () {
      await expect(
        remitFlow.connect(owner).updateFee(100n)
      ).to.not.be.reverted;

      expect(await remitFlow.feePercent()).to.equal(100n);

      // Reset
      await remitFlow.connect(owner).updateFee(30n);
    });

    it("owner can update feeCollector to a new address", async function () {
      await remitFlow.connect(owner).updateFeeCollector(other.address);

      expect(await remitFlow.feeCollector()).to.equal(other.address);

      // Reset back to owner
      await remitFlow.connect(owner).updateFeeCollector(owner.address);
    });

    it("non-owner cannot update feeCollector", async function () {
      await expect(
        remitFlow.connect(other).updateFeeCollector(other.address)
      ).to.be.revertedWithCustomError(remitFlow, "OwnableUnauthorizedAccount")
       .withArgs(other.address);
    });

    it("reverts if feeCollector is set to zero address", async function () {
      await expect(
        remitFlow.connect(owner).updateFeeCollector(ethers.ZeroAddress)
      ).to.be.revertedWith("RemitFlow: Fee collector cannot be zero address");
    });

    it("owner can emergency withdraw all USDC from the contract", async function () {
      // First: put some USDC into the contract via a yield deposit
      const depositAmount = 500n * ONE_USDC;
      await remitFlow.connect(sender).depositYield(depositAmount);

      // Verify contract has the USDC
      const contractBalance = await mockUSDC.balanceOf(await remitFlow.getAddress());
      expect(contractBalance).to.be.gte(depositAmount);

      // Record owner balance before
      const ownerBefore = await mockUSDC.balanceOf(owner.address);

      // Emergency withdraw
      await remitFlow.connect(owner).emergencyWithdraw();

      // Contract should now have 0 USDC
      expect(
        await mockUSDC.balanceOf(await remitFlow.getAddress())
      ).to.equal(0n);

      // Owner should have received the USDC
      const ownerAfter = await mockUSDC.balanceOf(owner.address);
      expect(ownerAfter).to.be.gte(ownerBefore + depositAmount);
    });

    it("non-owner cannot call emergencyWithdraw", async function () {
      await expect(
        remitFlow.connect(other).emergencyWithdraw()
      ).to.be.revertedWithCustomError(remitFlow, "OwnableUnauthorizedAccount")
       .withArgs(other.address);
    });
  });
});