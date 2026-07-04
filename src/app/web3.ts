import { ethers } from "ethers";
import contracts from "./contracts.json";
import ModelRegistryAbi from "../../artifacts/contracts/ModelRegistry.sol/ModelRegistry.json";
import InferenceTokenAbi from "../../artifacts/contracts/InferenceToken.sol/InferenceToken.json";

// Hardhat default private key for Account #0 (pre-funded with 10,000 ETH)
// This is safe to use only in local development networks.
const HARDHAT_DEV_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const HARDHAT_RPC_URL = "http://127.0.0.1:8545";

export interface Model {
  name: string;
  owner: string;
  totalInferences: bigint;
  correctInferences: bigint;
  active: boolean;
}

export interface InferenceLog {
  id: number;
  modelName: string;
  inputData: string;
  outputData: string;
  proofHash: string;
  submitter: string;
  verified: boolean;
  isCorrect: boolean;
}

export class Web3Service {
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private registryContract: ethers.Contract | null = null;
  private tokenContract: ethers.Contract | null = null;
  private useMock = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Connect to the local Hardhat network running on localhost:8545
      this.provider = new ethers.JsonRpcProvider(HARDHAT_RPC_URL);
      
      // Verify connection by checking network
      await this.provider.getNetwork();

      // Set up the signer (Account #0 as the default developer signer)
      this.signer = new ethers.Wallet(HARDHAT_DEV_PRIVATE_KEY, this.provider);

      // Create contract instances
      this.registryContract = new ethers.Contract(
        contracts.ModelRegistry,
        ModelRegistryAbi.abi,
        this.signer
      );

      this.tokenContract = new ethers.Contract(
        contracts.InferenceToken,
        InferenceTokenAbi.abi,
        this.signer
      );
      
      console.log("Connected to local Hardhat blockchain successfully.");
    } catch (e) {
      console.warn("Failed to connect to local Hardhat node. Falling back to frontend mock simulation.", e);
      this.useMock = true;
    }
  }

  public isMocking(): boolean {
    return this.useMock;
  }

  // Get signer address
  public async getAddress(): Promise<string> {
    if (this.useMock || !this.signer) {
      return "0xMockUserAddress71C7656EC7ab88b098defB751B";
    }
    return await this.signer.getAddress();
  }

  // Get $INF Token Balance for a wallet address
  public async getTokenBalance(address: string): Promise<string> {
    if (this.useMock || !this.tokenContract) {
      return "240.00"; // Mock balance for demonstration
    }
    try {
      const balance: bigint = await this.tokenContract.balanceOf(address);
      return ethers.formatUnits(balance, 18);
    } catch (e) {
      console.error("Error reading token balance:", e);
      return "0.00";
    }
  }

  // List all registered model details
  public async getModels(): Promise<Model[]> {
    if (this.useMock || !this.registryContract) {
      return [
        { name: "Sentiment-Analysis-DistilBERT", owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", totalInferences: 12n, correctInferences: 10n, active: true },
        { name: "Spam-Filter-Albert", owner: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", totalInferences: 5n, correctInferences: 4n, active: true }
      ];
    }

    try {
      const count: bigint = await this.registryContract.getModelsCount();
      const modelsList: Model[] = [];
      
      for (let i = 0; i < Number(count); i++) {
        const name: string = await this.registryContract.registeredModelNames(i);
        const data = await this.registryContract.models(name);
        modelsList.push({
          name: data.name,
          owner: data.owner,
          totalInferences: data.totalInferences,
          correctInferences: data.correctInferences,
          active: data.active
        });
      }
      return modelsList;
    } catch (e) {
      console.error("Error reading models list:", e);
      return [];
    }
  }

  // Register a new model name on-chain
  public async registerModel(name: string): Promise<boolean> {
    if (this.useMock || !this.registryContract) {
      console.log("Mock registering model:", name);
      return true;
    }

    try {
      const tx = await this.registryContract.registerModel(name);
      await tx.wait(); // Wait for confirmation block
      return true;
    } catch (e) {
      console.error("Failed to register model on-chain:", e);
      throw e;
    }
  }

  // Log inference predictions on-chain
  public async logInference(
    modelName: string,
    inputData: string,
    outputData: string,
    proofHash: string
  ): Promise<boolean> {
    if (this.useMock || !this.registryContract) {
      console.log("Mock logging inference on-chain:", { modelName, inputData, outputData, proofHash });
      return true;
    }

    try {
      const tx = await this.registryContract.logInference(modelName, inputData, outputData, proofHash);
      await tx.wait();
      return true;
    } catch (e) {
      console.error("Failed to log inference on-chain:", e);
      throw e;
    }
  }

  // Verify an inference transaction and distribute rewards if correct
  public async verifyInference(inferenceId: number, isCorrect: boolean): Promise<boolean> {
    if (this.useMock || !this.registryContract) {
      console.log("Mock verifying inference:", inferenceId, "as correct:", isCorrect);
      return true;
    }

    try {
      const tx = await this.registryContract.verifyInference(inferenceId, isCorrect);
      await tx.wait();
      return true;
    } catch (e) {
      console.error("Failed to verify inference on-chain:", e);
      throw e;
    }
  }

  // Get list of all logged inferences
  public async getInferences(): Promise<InferenceLog[]> {
    if (this.useMock || !this.registryContract) {
      return [
        { id: 0, modelName: "Sentiment-Analysis-DistilBERT", inputData: "I love this project!", outputData: "POSITIVE", proofHash: "857fbc8d626c92d53bfef11db189bc714f3b2cd398c806f84e317254e0f0b801", submitter: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", verified: true, isCorrect: true },
        { id: 1, modelName: "Sentiment-Analysis-DistilBERT", inputData: "The interface is beautiful.", outputData: "POSITIVE", proofHash: "a4f89d18721c0cf5d620ea67b973bf4cc922c825d33c1cf7073dff6d409c6857", submitter: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", verified: true, isCorrect: true },
        { id: 2, modelName: "Spam-Filter-Albert", inputData: "Win a free cruise now! Click here!", outputData: "SPAM", proofHash: "e1a90c73dff6d409c6857857fbc8d626c92d53bfef11db189bc714f3b2cd398c8", submitter: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", verified: false, isCorrect: false }
      ];
    }

    try {
      const count: bigint = await this.registryContract.getInferencesCount();
      const list: InferenceLog[] = [];

      for (let i = 0; i < Number(count); i++) {
        const inf = await this.registryContract.inferences(i);
        list.push({
          id: i,
          modelName: inf.modelName,
          inputData: inf.inputData,
          outputData: inf.outputData,
          proofHash: inf.proofHash,
          submitter: inf.submitter,
          verified: inf.verified,
          isCorrect: inf.isCorrect
        });
      }
      return list;
    } catch (e) {
      console.error("Error reading inferences log:", e);
      return [];
    }
  }
}

// Export a singleton instance
export const web3Service = new Web3Service();
