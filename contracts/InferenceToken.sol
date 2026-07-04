// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title InferenceToken
 * @dev A simple, customized implementation of the ERC-20 token standard.
 * This represents our project's native currency ($INF) used to reward machine learning model nodes.
 */
contract InferenceToken {
    // Public state variables representing token metadata.
    // "public" automatically generates getter functions for these variables.
    string public name = "Inference Token";
    string public symbol = "INF";
    uint8 public decimals = 18; // 18 decimals is standard (similar to Wei for Ether)
    uint256 public totalSupply;

    // The address of the owner/admin who can mint new tokens.
    // In our system, the ModelRegistry contract will be the owner.
    address public owner;

    // A mapping (hash table) that maps wallet addresses to their token balance.
    mapping(address => uint256) public balanceOf;

    // A nested mapping that tracks how many tokens a third party (spender) is allowed
    // to spend on behalf of a wallet owner. (Used for delegated transfers).
    mapping(address => mapping(address => uint256)) public allowance;

    // Events allow external applications (like our Next.js frontend) to listen 
    // to specific changes on-chain in real-time.
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Constructor runs exactly once when the contract is deployed.
    constructor() {
        owner = msg.sender; // Set the deployer as the initial owner
    }

    // A modifier restricts access to certain functions. 
    // The "_;" is a placeholder where the function body gets injected.
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    /**
     * @dev Transfers tokens from the caller's account to the target address.
     */
    function transfer(address to, uint256 value) public returns (bool success) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        
        emit Transfer(msg.sender, to, value);
        return true;
    }

    /**
     * @dev Approves a third-party address to spend tokens on the caller's behalf.
     */
    function approve(address spender, uint256 value) public returns (bool success) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /**
     * @dev Transfers tokens from one account to another using an allowance.
     */
    function transferFrom(address from, address to, uint256 value) public returns (bool success) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Allowance exceeded");

        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;

        emit Transfer(from, to, value);
        return true;
    }

    /**
     * @dev Mints (creates) new tokens and assigns them to an account.
     * Restricted to the owner of this contract (the ModelRegistry contract).
     */
    function mint(address to, uint256 amount) public onlyOwner {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
