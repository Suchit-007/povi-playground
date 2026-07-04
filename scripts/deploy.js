import hre from "hardhat";

/**
 * @dev Deployment script for our local Hardhat environment.
 * It compiles (if needed), deploys the ModelRegistry contract, 
 * and outputs the deployed addresses of both registry and token.
 */
async function main() {
  console.log("Initializing deployment to local blockchain...");

  // getContractFactory resolves the compiled smart contract bytecode
  const ModelRegistry = await hre.ethers.getContractFactory("ModelRegistry");
  
  // deploy() sends a transaction containing the contract bytecode to the network
  const registry = await ModelRegistry.deploy();

  // Wait for the transaction to be mined (confirmed in a block)
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  
  // Call the public getter function "token()" on the registry to find the sub-deployed token address
  const tokenAddress = await registry.token();

  console.log("--------------------------------------------------");
  console.log(`✅ ModelRegistry successfully deployed to: ${registryAddress}`);
  console.log(`✅ InferenceToken ($INF) is at:          ${tokenAddress}`);
  console.log("--------------------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
