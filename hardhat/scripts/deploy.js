const hre = require("hardhat");
const ethers = hre.ethers;
const fs = require("fs");
const path = require("path");

// ============================================================
// 🏠  REAL USDC ADDRESS ON POLYGON MAINNET
// This is the official USDC contract deployed by Circle.
// We only use this when deploying to the real Polygon network.
// For all testnets, we deploy our own MockUSDC instead.
// ============================================================
const REAL_USDC_MAINNET = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";


// ============================================================
// 🚀  MAIN DEPLOY FUNCTION
// ============================================================
async function main() {

  // ----------------------------------------------------------
  // STEP 1: Get the deployer wallet
  // "Signers" are wallets that can sign transactions.
  // The first one comes from PRIVATE_KEY in your .env file.
  // ----------------------------------------------------------
  console.log("\n========================================");
  console.log("🚀  RemitFlow Deployment Script Starting");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();

  // ----------------------------------------------------------
  // STEP 2: Log deployer info
  // Always check your deployer address and balance before
  // deploying — you need MATIC to pay for gas fees.
  // ----------------------------------------------------------
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceInMatic = ethers.formatEther(balance);

  console.log("📋  Deployer Info:");
  console.log("    Address :", deployer.address);
  console.log("    Balance :", balanceInMatic, "MATIC");

  // Warn if balance is very low (might not have enough for gas)
  if (parseFloat(balanceInMatic) < 0.1) {
    console.warn("\n⚠️  WARNING: Low MATIC balance!");
    console.warn("   You may not have enough to pay gas fees.");
    console.warn("   Get test MATIC at: https://faucet.polygon.technology\n");
  }

  // ----------------------------------------------------------
  // Get the current network name
  // This tells us if we're on localhost, amoy testnet, or mainnet
  // ----------------------------------------------------------
  const network = await ethers.provider.getNetwork();
  const networkName = hre.network.name;

  console.log("\n🌐  Network Info:");
  console.log("    Name   :", networkName);
  console.log("    ChainId:", network.chainId.toString());


  // ----------------------------------------------------------
  // STEP 3: Decide which USDC to use
  // On mainnet → use real USDC (already deployed by Circle)
  // On testnet → deploy MockUSDC (fake USDC for testing)
  // ----------------------------------------------------------
  let usdcAddress;
  let mockUSDC = null;

  if (networkName === "polygon") {
    // ── Mainnet: use real USDC ──────────────────────────────
    console.log("\n💵  Network is Polygon Mainnet.");
    console.log("    Using real USDC:", REAL_USDC_MAINNET);
    usdcAddress = REAL_USDC_MAINNET;

  } else {
    // ── Testnet / Local: deploy MockUSDC ───────────────────
    console.log("\n🧪  Non-mainnet network detected.");
    console.log("    Deploying MockUSDC (fake USDC for testing)...");

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();

    // Wait for MockUSDC to be mined on the blockchain
    await mockUSDC.waitForDeployment();
    usdcAddress = await mockUSDC.getAddress();

    console.log("    ✅  MockUSDC deployed!");
    console.log("        Address:", usdcAddress);
  }


  // ----------------------------------------------------------
  // STEP 4: Deploy the main RemitFlow contract
  // We pass two arguments to the constructor:
  //   1. usdcAddress — which USDC token to use
  //   2. deployer.address — who receives the fees initially
  // ----------------------------------------------------------
  console.log("\n📦  Deploying RemitFlow contract...");
  console.log("    Constructor args:");
  console.log("      USDC Address  :", usdcAddress);
  console.log("      Fee Collector :", deployer.address);

  const RemitFlow = await ethers.getContractFactory("RemitFlow");
  const remitFlow = await RemitFlow.deploy(usdcAddress, deployer.address);

  console.log("    ⏳  Waiting for deployment transaction to be mined...");


  // ----------------------------------------------------------
  // STEP 5: Wait for confirmations
  // More confirmations = more secure (other nodes have confirmed it)
  // On mainnet we wait for 5 blocks, on testnet/local just 1.
  // ----------------------------------------------------------
  const confirmations = networkName === "polygon" ? 5 : 1;
  console.log(`    ⏳  Waiting for ${confirmations} block confirmation(s)...`);

  await remitFlow.waitForDeployment();
  const remitFlowAddress = await remitFlow.getAddress();

  // Get the deployment transaction to wait for confirmations
  const deployTx = remitFlow.deploymentTransaction();
  if (deployTx) {
    await deployTx.wait(confirmations);
  }

  console.log("    ✅  RemitFlow deployed!");
  console.log("        Address:", remitFlowAddress);


  // ----------------------------------------------------------
  // STEP 6: Log a clear summary of all deployed addresses
  // ----------------------------------------------------------
  console.log("\n========================================");
  console.log("✅  DEPLOYMENT COMPLETE — Summary");
  console.log("========================================");
  console.log("Network      :", networkName);
  console.log("RemitFlow    :", remitFlowAddress);
  console.log("USDC Used    :", usdcAddress);
  if (mockUSDC) {
    console.log("MockUSDC     :", usdcAddress, "(test token)");
  }
  console.log("Deployer     :", deployer.address);
  console.log("Timestamp    :", new Date().toISOString());
  console.log("========================================\n");


  // ----------------------------------------------------------
  // STEP 7: Save deployed addresses to a JSON file
  // This file is read by the frontend to know which contract
  // address to connect to. It's auto-generated — don't edit it.
  // ----------------------------------------------------------
  const deployedAddresses = {
    contractAddress: remitFlowAddress,
    usdcAddress:     usdcAddress,
    network:         networkName,
    chainId:         network.chainId.toString(),
    deployer:        deployer.address,
    deployedAt:      new Date().toISOString(),
    // If MockUSDC was deployed, save it separately too
    ...(mockUSDC && { mockUsdcAddress: usdcAddress }),
  };

  // Build the path to the frontend lib folder
  const outputPath = path.join(__dirname, "../../frontend/lib/deployedAddresses.json");

  // Make sure the directory exists before writing
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log("📁  Created directory:", outputDir);
  }

  // Write the JSON file (pretty-printed with 2-space indent)
  fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));
  console.log("💾  Deployment addresses saved to:");
  console.log("    ", outputPath);
  console.log("\n📋  File contents:");
  console.log(JSON.stringify(deployedAddresses, null, 2));


  // ----------------------------------------------------------
  // STEP 8: Verify contracts on Polygonscan
  // This makes your contract source code public and readable
  // on https://amoy.polygonscan.com or https://polygonscan.com
  // Skip this step on localhost (no block explorer for local node)
  // ----------------------------------------------------------
  if (networkName !== "localhost" && networkName !== "hardhat") {

    console.log("\n🔍  Verifying contracts on Polygonscan...");
    console.log("    (Waiting 20 seconds for Polygonscan to index the contract)");

    // Wait a bit — Polygonscan needs time to pick up the new contract
    // before we can verify it. 20 seconds is usually enough.
    await new Promise(resolve => setTimeout(resolve, 20000));

    // ── Verify MockUSDC (if deployed) ──────────────────────
    if (mockUSDC) {
      try {
        console.log("\n    Verifying MockUSDC...");
        await hre.run("verify:verify", {
          address:              usdcAddress,
          constructorArguments: [],  // MockUSDC constructor takes no arguments
        });
        console.log("    ✅  MockUSDC verified on Polygonscan!");
      } catch (error) {
        // "Already verified" is not actually an error — ignore it
        if (error.message.includes("Already Verified") ||
            error.message.includes("already verified")) {
          console.log("    ℹ️   MockUSDC already verified — skipping.");
        } else {
          console.error("    ❌  MockUSDC verification failed:", error.message);
          console.log("    💡  You can verify manually later:");
          console.log(`        npx hardhat verify --network ${networkName} ${usdcAddress}`);
        }
      }
    }

    // ── Verify RemitFlow ───────────────────────────────────
    try {
      console.log("\n    Verifying RemitFlow...");
      await hre.run("verify:verify", {
        address:              remitFlowAddress,
        constructorArguments: [usdcAddress, deployer.address],
        // ↑ Must match EXACTLY what was passed to the constructor
      });
      console.log("    ✅  RemitFlow verified on Polygonscan!");
      console.log(`    🔗  View at: https://${networkName === "polygon" ? "" : "amoy."}polygonscan.com/address/${remitFlowAddress}`);

    } catch (error) {
      if (error.message.includes("Already Verified") ||
          error.message.includes("already verified")) {
        console.log("    ℹ️   RemitFlow already verified — skipping.");
      } else {
        console.error("    ❌  RemitFlow verification failed:", error.message);
        console.log("    💡  You can verify manually later with:");
        console.log(`        npx hardhat verify --network ${networkName} ${remitFlowAddress} "${usdcAddress}" "${deployer.address}"`);
      }
    }

  } else {
    console.log("ℹ️   Skipping Polygonscan verification (not needed on local network).");
  }


  // ----------------------------------------------------------
  // 🎉  FINAL INSTRUCTIONS
  // Tell the developer what to do next after deployment.
  // ----------------------------------------------------------
  console.log("\n========================================");
  console.log("🎉  NEXT STEPS");
  console.log("========================================");
  console.log("1. Copy the contract address above");
  console.log("2. Open your .env file in the project root");
  console.log(`3. Set: NEXT_PUBLIC_CONTRACT_ADDRESS=${remitFlowAddress}`);
  if (mockUSDC) {
    console.log(`4. Set: NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}`);
  }
  console.log("5. Restart your frontend: cd frontend && npm run dev");
  console.log("========================================\n");
}


// ============================================================
// ▶️  RUN THE SCRIPT
// This pattern lets us use async/await at the top level.
// If main() throws any error, it's caught here and logged.
// process.exit(1) tells the terminal the script failed.
// ============================================================
main()
  .then(() => {
    console.log("✅  Deploy script finished successfully.\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌  DEPLOYMENT FAILED:");
    console.error("    Error:", error.message);
    console.error("\n💡  Common fixes:");
    console.error("    • Check your PRIVATE_KEY in .env");
    console.error("    • Check your RPC URL in .env (Alchemy key correct?)");
    console.error("    • Make sure you have enough MATIC for gas");
    console.error("    • Run 'npx hardhat compile' first to check for errors");
    console.error("    • For Amoy testnet, get free MATIC: https://faucet.polygon.technology");
    process.exit(1);
  });