// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title DemoToken
/// @notice The stand-in stablecoin the staged ransom is paid in. Testnet only.
contract DemoToken is ERC20, Ownable {
    constructor() ERC20("Demo USD", "dUSD") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
