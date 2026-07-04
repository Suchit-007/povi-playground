// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Import our token contract so we can instantiate it and interact with it.
import "./InferenceToken.sol";

/**
 * @title ModelRegistry
 * @dev Tracks machine learning models, logs their prediction metadata (inferences),
 * and verifies their correctness to distribute token rewards.
 */
contract ModelRegistry {
    // The administrator of this registry (deployer).
    address public owner;

    // The deployed instance of our InferenceToken contract.
    InferenceToken public token;

    // Structs are custom data structures that group related variables.
    struct Model {
        string name;               // Readable name of the AI model
        address owner;             // Wallet address of the model creator
        uint256 totalInferences;   // Total times this model submitted a prediction
        uint256 correctInferences; // Total times predictions were verified as correct
        bool active;               // If the model is active
    }

    struct Inference {
        string modelName;          // Name of the model that ran inference
        string inputData;          // The input string sent to the model (e.g. text sentence)
        string outputData;         // The prediction output (e.g. "Positive" / "Negative")
        string proofHash;          // SHA-256 hash of (input + output) to prove it wasn't tampered
        address submitter;         // Wallet address of the node that submitted it
        bool verified;             // True if a validator checked this prediction
        bool isCorrect;            // True if the validator deemed it correct
    }

    // Mappings
    // Map model names to their Model struct records
    mapping(string => Model) public models;
    
    // Array of names to let us iterate and list registered models in the UI
    string[] public registeredModelNames;

    // Dynamic array containing every inference logged in the registry
    Inference[] public inferences;

    // Events
    event ModelRegistered(string name, address indexed owner);
    event InferenceLogged(uint256 indexed inferenceId, string modelName, address indexed submitter, string proofHash);
    event InferenceVerified(uint256 indexed inferenceId, bool isCorrect, uint256 rewardAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner/validator can call this");
        _;
    }

    constructor() {
        owner = msg.sender;
        
        // "new" deploys a fresh instance of InferenceToken.
        // Since ModelRegistry deploys it, ModelRegistry is the owner of InferenceToken.
        token = new InferenceToken();
    }

    /**
     * @dev Registers a new machine learning model.
     * Anyone can register a model name if it hasn't been taken yet.
     */
    function registerModel(string memory name) public {
        require(bytes(name).length > 0, "Model name cannot be empty");
        require(models[name].owner == address(0), "Model already registered");

        models[name] = Model({
            name: name,
            owner: msg.sender,
            totalInferences: 0,
            correctInferences: 0,
            active: true
        });

        registeredModelNames.push(name);
        emit ModelRegistered(name, msg.sender);
    }

    /**
     * @dev Logs a prediction made by an AI model.
     * The node provides the model name, input, output, and a cryptographic proof hash.
     */
    function logInference(
        string memory modelName,
        string memory inputData,
        string memory outputData,
        string memory proofHash
    ) public {
        require(models[modelName].active, "Model is not active or registered");

        inferences.push(Inference({
            modelName: modelName,
            inputData: inputData,
            outputData: outputData,
            proofHash: proofHash,
            submitter: msg.sender,
            verified: false,
            isCorrect: false
        }));

        uint256 inferenceId = inferences.length - 1;
        models[modelName].totalInferences += 1;

        emit InferenceLogged(inferenceId, modelName, msg.sender, proofHash);
    }

    /**
     * @dev Verifies a logged prediction.
     * If the prediction is correct, mints 10 $INF tokens to the submitter as a reward.
     * Restricted to the registry owner/validator.
     */
    function verifyInference(uint256 inferenceId, bool isCorrect) public onlyOwner {
        require(inferenceId < inferences.length, "Invalid inference ID");
        Inference storage inf = inferences[inferenceId];
        
        // require() checks a condition and rolls back the transaction if it fails,
        // saving gas and preventing double-validation or double-rewards.
        require(!inf.verified, "Inference already verified");

        inf.verified = true;
        inf.isCorrect = isCorrect;

        if (isCorrect) {
            models[inf.modelName].correctInferences += 1;
            
            // Mint 10 tokens. Since tokens have 18 decimals, 10 tokens is: 10 * 10^18.
            uint256 rewardAmount = 10 * (10 ** uint256(token.decimals()));
            token.mint(inf.submitter, rewardAmount);
            
            emit InferenceVerified(inferenceId, true, rewardAmount);
        } else {
            emit InferenceVerified(inferenceId, false, 0);
        }
    }

    // Helper functions to get lists and counts for UI readability.
    function getModelsCount() public view returns (uint256) {
        return registeredModelNames.length;
    }

    function getInferencesCount() public view returns (uint256) {
        return inferences.length;
    }
}
