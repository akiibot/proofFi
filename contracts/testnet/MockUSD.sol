// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev COMPETITION TESTNET FIXTURE ONLY. NOT AUDITED. DO NOT USE REAL FUNDS.
 * MockUSD stable-value synthetic token + vault holding user deposit receipts.
 * On-chain vault doesn't enforce ProofFi's financial constitution: signing layer is trusted.
 * Price risk is simulated off-chain; vault shares do not have market-price exposure.
 */
contract MockUSD {
    string public constant name = "ProofFi Demo USD";
    string public constant symbol = "pfUSD";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public immutable issuer;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() { issuer = msg.sender; }
    function mint(address to, uint256 amount) external {
        require(msg.sender == issuer, "issuer only");
        require(to != address(0), "zero address");
        totalSupply += amount; balanceOf[to] += amount;
        emit Transfer(address(0),to,amount);
    }
    function approve(address spender,uint256 amount) external returns(bool) {
        allowance[msg.sender][spender]=amount;
        emit Approval(msg.sender,spender,amount); return true;
    }
    function transfer(address to,uint256 amount) external returns(bool) {
        _move(msg.sender,to,amount); return true;
    }
    function transferFrom(address from,address to,uint256 amount) external returns(bool) {
        uint256 permitted=allowance[from][msg.sender];
        require(permitted>=amount,"insufficient allowance");
        allowance[from][msg.sender]=permitted-amount;
        emit Approval(from,msg.sender,allowance[from][msg.sender]);
        _move(from,to,amount); return true;
    }
    function _move(address from,address to,uint256 amount) internal {
        require(to!=address(0),"zero address");
        uint256 current=balanceOf[from];require(current>=amount,"insufficient balance");
        balanceOf[from]=current-amount;balanceOf[to]+=amount;
        emit Transfer(from,to,amount);
    }
}
