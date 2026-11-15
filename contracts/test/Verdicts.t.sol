// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VerdictRegistry} from "../src/VerdictRegistry.sol";
import {DemoExchange} from "../src/DemoExchange.sol";
import {DemoToken} from "../src/DemoToken.sol";

contract VerdictsTest is Test {
    VerdictRegistry registry;
    DemoExchange exchange;
    DemoToken token;

    address agent = makeAddr("agent");
    address clean = makeAddr("clean");
    address attackerHop = makeAddr("attackerHop");
    address stranger = makeAddr("stranger");

    bytes32 constant REPORT = keccak256("report:attackerHop");
    bytes32 constant NOTE = keccak256("ransom-note");

    function setUp() public {
        token = new DemoToken();
        registry = new VerdictRegistry(agent);
        exchange = new DemoExchange(token, registry);

        token.mint(clean, 1_000e18);
        token.mint(attackerHop, 1_000e18);
        vm.prank(clean);
        token.approve(address(exchange), type(uint256).max);
        vm.prank(attackerHop);
        token.approve(address(exchange), type(uint256).max);
    }

    function _flagMalicious(address wallet) internal {
        uint32 behaviors = registry.RAPID_PASS_THROUGH() | registry.NEW_WALLET_CHAIN();
        vm.prank(agent);
        registry.setVerdict(wallet, VerdictRegistry.Verdict.Malicious, behaviors, REPORT, bytes32(0));
    }

    // --- the two plan-required tests ---

    function test_CleanWalletDepositIsCredited() public {
        vm.prank(clean);
        (uint256 id, bool held) = exchange.deposit(100e18);

        assertFalse(held);
        assertEq(exchange.balanceOf(clean), 100e18);
        (,,, DemoExchange.Status status) = exchange.deposits(id);
        assertEq(uint8(status), uint8(DemoExchange.Status.Credited));
    }

    function test_FlaggedWalletDepositIsHeld() public {
        _flagMalicious(attackerHop);

        vm.prank(attackerHop);
        (uint256 id, bool held) = exchange.deposit(100e18);

        assertTrue(held);
        assertEq(exchange.balanceOf(attackerHop), 0, "held funds must not be withdrawable");
        assertEq(token.balanceOf(address(exchange)), 100e18, "funds sit in the exchange");
        (, , VerdictRegistry.Verdict v, DemoExchange.Status status) = exchange.deposits(id);
        assertEq(uint8(v), uint8(VerdictRegistry.Verdict.Malicious));
        assertEq(uint8(status), uint8(DemoExchange.Status.Held));
    }

    // --- hardening ---

    function test_SuspiciousIsAlsoHeld() public {
        uint32 behaviors = registry.RAPID_PASS_THROUGH(); // read before prank: prank applies to the next call only
        vm.prank(agent);
        registry.setVerdict(attackerHop, VerdictRegistry.Verdict.Suspicious, behaviors, REPORT, bytes32(0));
        vm.prank(attackerHop);
        (, bool held) = exchange.deposit(1e18);
        assertTrue(held);
    }

    function test_OnlyAgentCanPostVerdicts() public {
        vm.prank(stranger);
        vm.expectRevert(VerdictRegistry.NotAgent.selector);
        registry.setVerdict(clean, VerdictRegistry.Verdict.Malicious, 0, REPORT, bytes32(0));
    }

    function test_RecordStoresEvidenceAndReport() public {
        uint32 behaviors = registry.RANSOM_NOTE_EVIDENCE();
        vm.prank(agent);
        registry.setVerdict(attackerHop, VerdictRegistry.Verdict.Malicious, behaviors, REPORT, NOTE);

        VerdictRegistry.Record memory r = registry.getRecord(attackerHop);
        assertEq(r.reportHash, REPORT);
        assertEq(r.evidenceHash, NOTE);
        assertEq(r.behaviors, behaviors);
        assertTrue(registry.isRisky(attackerHop));
        assertFalse(registry.isRisky(clean));
    }

    function test_BatchFlagsDownstreamHops() public {
        address[] memory w = new address[](3);
        VerdictRegistry.Verdict[] memory v = new VerdictRegistry.Verdict[](3);
        uint32[] memory b = new uint32[](3);
        bytes32[] memory rh = new bytes32[](3);
        bytes32[] memory eh = new bytes32[](3);
        for (uint256 i; i < 3; ++i) {
            w[i] = makeAddr(string(abi.encodePacked("hop", vm.toString(i))));
            v[i] = VerdictRegistry.Verdict.Suspicious;
            b[i] = registry.TAINTED_BY_FLAGGED();
            rh[i] = REPORT;
        }
        vm.prank(agent);
        registry.setVerdicts(w, v, b, rh, eh);
        for (uint256 i; i < 3; ++i) {
            assertTrue(registry.isRisky(w[i]));
        }
    }

    function test_BatchLengthMismatchReverts() public {
        address[] memory w = new address[](2);
        VerdictRegistry.Verdict[] memory v = new VerdictRegistry.Verdict[](1);
        vm.prank(agent);
        vm.expectRevert(VerdictRegistry.LengthMismatch.selector);
        registry.setVerdicts(w, v, new uint32[](2), new bytes32[](2), new bytes32[](2));
    }

    function test_ReleaseCreditsHeldDeposit() public {
        _flagMalicious(attackerHop);
        vm.prank(attackerHop);
        (uint256 id,) = exchange.deposit(50e18);

        exchange.release(id); // test contract is the exchange owner
        assertEq(exchange.balanceOf(attackerHop), 50e18);

        vm.expectRevert(DemoExchange.NotHeld.selector);
        exchange.release(id);
    }

    function test_OnlyOwnerCanRelease() public {
        _flagMalicious(attackerHop);
        vm.prank(attackerHop);
        (uint256 id,) = exchange.deposit(50e18);

        vm.prank(attackerHop);
        vm.expectRevert();
        exchange.release(id);
    }

    function test_RollbackReturnsHeldFundsToVictim() public {
        address victim = makeAddr("victim");
        _flagMalicious(attackerHop);
        vm.prank(attackerHop);
        (uint256 id,) = exchange.deposit(100e18);

        exchange.rollback(id, victim);

        assertEq(token.balanceOf(victim), 100e18, "victim made whole");
        assertEq(exchange.balanceOf(attackerHop), 0, "attacker credited nothing");
        (,,, DemoExchange.Status status) = exchange.deposits(id);
        assertEq(uint8(status), uint8(DemoExchange.Status.RolledBack));

        // cannot roll back or release twice
        vm.expectRevert(DemoExchange.NotHeld.selector);
        exchange.rollback(id, victim);
        vm.expectRevert(DemoExchange.NotHeld.selector);
        exchange.release(id);
    }

    function test_OnlyOwnerCanRollback() public {
        _flagMalicious(attackerHop);
        vm.prank(attackerHop);
        (uint256 id,) = exchange.deposit(100e18);
        vm.prank(attackerHop);
        vm.expectRevert();
        exchange.rollback(id, attackerHop);
    }

    function test_CannotRollbackACreditedDeposit() public {
        vm.prank(clean);
        (uint256 id,) = exchange.deposit(100e18);
        vm.expectRevert(DemoExchange.NotHeld.selector);
        exchange.rollback(id, clean);
    }

    function test_CleanWalletCanWithdraw() public {
        vm.startPrank(clean);
        exchange.deposit(100e18);
        exchange.withdraw(40e18);
        vm.stopPrank();
        assertEq(exchange.balanceOf(clean), 60e18);
        assertEq(token.balanceOf(clean), 940e18);
    }

    function test_CannotWithdrawMoreThanCredited() public {
        vm.prank(clean);
        vm.expectRevert(DemoExchange.InsufficientBalance.selector);
        exchange.withdraw(1);
    }
}
