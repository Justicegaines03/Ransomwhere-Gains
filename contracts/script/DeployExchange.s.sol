// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VerdictRegistry} from "../src/VerdictRegistry.sol";
import {DemoExchange} from "../src/DemoExchange.sol";

/// Redeploys only the exchange (adds rollback) against the existing token and registry.
///   forge script script/DeployExchange.s.sol --rpc-url monad_testnet --private-key $WALLET2_PRIVATE_KEY --broadcast
contract DeployExchange is Script {
    function run() external {
        vm.startBroadcast();
        DemoExchange exchange = new DemoExchange(
            IERC20(0x4c5a52AB5bb8589fE576c940fD23F07Bb1D97B5D), VerdictRegistry(0x3525Bd36afB988f8cFeBB95e2C15Af1ee202F8c9)
        );
        vm.stopBroadcast();
        console.log("DemoExchange", address(exchange));
    }
}
