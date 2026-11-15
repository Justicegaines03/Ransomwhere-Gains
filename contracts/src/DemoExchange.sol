// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {VerdictRegistry} from "./VerdictRegistry.sol";

/// @title DemoExchange
/// @notice A stand-in exchange that checks the VerdictRegistry at the moment of deposit.
///         Clean wallets are credited; suspicious or malicious wallets are held, not blocked.
contract DemoExchange is Ownable {
    using SafeERC20 for IERC20;

    enum Status {
        Credited,
        Held,
        Released,
        RolledBack
    }

    struct Deposit {
        address depositor;
        uint256 amount;
        VerdictRegistry.Verdict verdictAtDeposit;
        Status status;
    }

    IERC20 public immutable token;
    VerdictRegistry public immutable registry;

    Deposit[] public deposits;
    mapping(address => uint256) public balanceOf; // credited, withdrawable balance

    event Deposited(uint256 indexed id, address indexed depositor, uint256 amount);
    event DepositHeld(
        uint256 indexed id, address indexed depositor, uint256 amount, VerdictRegistry.Verdict verdict
    );
    event DepositReleased(uint256 indexed id, address indexed depositor, uint256 amount);
    event DepositRolledBack(uint256 indexed id, address indexed depositor, address indexed victim, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    error NotHeld();
    error ZeroAddress();
    error InsufficientBalance();

    constructor(IERC20 token_, VerdictRegistry registry_) Ownable(msg.sender) {
        token = token_;
        registry = registry_;
    }

    /// @return id The deposit id.
    /// @return held True if the deposit was held for review.
    function deposit(uint256 amount) external returns (uint256 id, bool held) {
        token.safeTransferFrom(msg.sender, address(this), amount);

        VerdictRegistry.Verdict v = registry.verdictOf(msg.sender);
        held = v != VerdictRegistry.Verdict.Clean;
        id = deposits.length;
        deposits.push(
            Deposit({
                depositor: msg.sender,
                amount: amount,
                verdictAtDeposit: v,
                status: held ? Status.Held : Status.Credited
            })
        );

        if (held) {
            emit DepositHeld(id, msg.sender, amount, v);
        } else {
            balanceOf[msg.sender] += amount;
            emit Deposited(id, msg.sender, amount);
        }
    }

    /// @notice Compliance review cleared a held deposit; credit it.
    function release(uint256 id) external onlyOwner {
        Deposit storage d = deposits[id];
        if (d.status != Status.Held) revert NotHeld();
        d.status = Status.Released;
        balanceOf[d.depositor] += d.amount;
        emit DepositReleased(id, d.depositor, d.amount);
    }

    /// @notice Rollback: return a held deposit to the wallet that originally paid it (the victim).
    /// @dev Only possible because the funds are still in this contract. The victim is identified
    ///      offchain from the threat report (who paid the ransom wallet); pilot trust model: the owner decides.
    function rollback(uint256 id, address victim) external onlyOwner {
        if (victim == address(0)) revert ZeroAddress();
        Deposit storage d = deposits[id];
        if (d.status != Status.Held) revert NotHeld();
        d.status = Status.RolledBack;
        token.safeTransfer(victim, d.amount);
        emit DepositRolledBack(id, d.depositor, victim, d.amount);
    }

    function withdraw(uint256 amount) external {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        balanceOf[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function depositCount() external view returns (uint256) {
        return deposits.length;
    }
}
