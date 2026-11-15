// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VerdictRegistry} from "../src/VerdictRegistry.sol";
import {DemoExchange} from "../src/DemoExchange.sol";
import {DemoToken} from "../src/DemoToken.sol";

/// Usage (from contracts/):
///   source .env
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --private-key $PRIVATE_KEY --broadcast
/// The deployer is also the pilot's detection agent and the exchange owner.
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;

        DemoToken token = new DemoToken();
        VerdictRegistry registry = new VerdictRegistry(deployer);
        DemoExchange exchange = new DemoExchange(token, registry);
        token.mint(deployer, 1_000_000e18);

        vm.stopBroadcast();

        console.log("DemoToken      ", address(token));
        console.log("VerdictRegistry", address(registry));
        console.log("DemoExchange   ", address(exchange));
        console.log("Agent/owner    ", deployer);
    }
}
