// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title VerdictRegistry
/// @notice EDR for money: an onchain verdict per wallet, backed by named behaviors and a report fingerprint.
/// @dev Pilot trust model: one detection agent writes, anyone reads. Staking, independent
///      reporters and appeals are roadmap.
contract VerdictRegistry is Ownable {
    enum Verdict {
        Clean,
        Suspicious,
        Malicious
    }

    /// Behavior bits. Each maps to a published FATF / FinCEN indicator (see README).
    uint32 public constant RAPID_PASS_THROUGH = 1 << 0; // forwards nearly everything received within minutes
    uint32 public constant NEW_WALLET_CHAIN = 1 << 1; // money moves through wallets with no prior history
    uint32 public constant SPLIT_AND_MERGE = 1 << 2; // one amount split across wallets, later recombined
    uint32 public constant MANY_TO_ONE = 1 << 3; // unrelated senders pay similar amounts into one new wallet
    uint32 public constant TAINTED_BY_FLAGGED = 1 << 4; // received funds from a malicious wallet
    uint32 public constant RANSOM_NOTE_EVIDENCE = 1 << 5; // an offchain ransom note names this wallet

    struct Record {
        Verdict verdict;
        uint32 behaviors; // bitmask of the behaviors above
        uint64 updatedAt; // block timestamp of the last verdict
        bytes32 reportHash; // keccak256 of the full threat report
        bytes32 evidenceHash; // keccak256 of attached evidence (e.g. ransom note), 0 if none
    }

    address public agent;
    mapping(address => Record) private records;

    event AgentChanged(address indexed previousAgent, address indexed newAgent);
    event VerdictSet(
        address indexed wallet,
        Verdict verdict,
        uint32 behaviors,
        bytes32 reportHash,
        bytes32 evidenceHash
    );

    error NotAgent();
    error LengthMismatch();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address initialAgent) Ownable(msg.sender) {
        agent = initialAgent;
        emit AgentChanged(address(0), initialAgent);
    }

    function setAgent(address newAgent) external onlyOwner {
        emit AgentChanged(agent, newAgent);
        agent = newAgent;
    }

    /// @notice Post a verdict for one wallet.
    function setVerdict(
        address wallet,
        Verdict verdict,
        uint32 behaviors,
        bytes32 reportHash,
        bytes32 evidenceHash
    ) external onlyAgent {
        _set(wallet, verdict, behaviors, reportHash, evidenceHash);
    }

    /// @notice Post verdicts for many wallets at once, e.g. flagging every downstream hop of a ransom.
    function setVerdicts(
        address[] calldata wallets,
        Verdict[] calldata verdicts,
        uint32[] calldata behaviors,
        bytes32[] calldata reportHashes,
        bytes32[] calldata evidenceHashes
    ) external onlyAgent {
        uint256 n = wallets.length;
        if (
            verdicts.length != n || behaviors.length != n || reportHashes.length != n
                || evidenceHashes.length != n
        ) revert LengthMismatch();
        for (uint256 i; i < n; ++i) {
            _set(wallets[i], verdicts[i], behaviors[i], reportHashes[i], evidenceHashes[i]);
        }
    }

    function getRecord(address wallet) external view returns (Record memory) {
        return records[wallet];
    }

    function verdictOf(address wallet) external view returns (Verdict) {
        return records[wallet].verdict;
    }

    /// @notice The one-line check an exchange or lending contract adds.
    function isRisky(address wallet) external view returns (bool) {
        return records[wallet].verdict != Verdict.Clean;
    }

    function _set(
        address wallet,
        Verdict verdict,
        uint32 behaviors,
        bytes32 reportHash,
        bytes32 evidenceHash
    ) private {
        records[wallet] = Record({
            verdict: verdict,
            behaviors: behaviors,
            // casting to 'uint64' is safe because block timestamps fit in uint64 for ~584 billion years
            // forge-lint: disable-next-line(unsafe-typecast)
            updatedAt: uint64(block.timestamp),
            reportHash: reportHash,
            evidenceHash: evidenceHash
        });
        emit VerdictSet(wallet, verdict, behaviors, reportHash, evidenceHash);
    }
}
