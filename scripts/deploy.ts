import { ethers } from "hardhat"
import { delay, log } from "./utils"
import { BLOCKCHAIN_URL, BUDNLER_ACCOUNT, ENTRY_POINT_ADDRESS, ENTRY_POINT_DEPLOYER, HARDHAT_ACCOUNT } from "./consts"
import { DeterministicDeployer } from "@account-abstraction/sdk"
import { EntryPoint__factory } from "@account-abstraction/contracts"

async function main() {
  const blockchain = new ethers.providers.JsonRpcBatchProvider(BLOCKCHAIN_URL)
  log(["Connected to", [blockchain.connection.url]])

  const signer = blockchain.getSigner()

  // Some of these accounts are hard-coded in eth-infinitism (take a hints about its quality :)
  const fundUs = [
    ["Bundler account", BUDNLER_ACCOUNT],
    ["Hardhat account", HARDHAT_ACCOUNT],
    ["Entry point deployer account", ENTRY_POINT_DEPLOYER],
    ["Entry point", ENTRY_POINT_ADDRESS]
  ]

  for (const [name, me] of fundUs) {
    const balance = await blockchain.getBalance(me);
    const requiredBalance = ethers.utils.parseEther("1")

    if (balance.lt(requiredBalance)) {
      const funds = requiredBalance.sub(balance)
      const fundTx = await signer.sendTransaction({ to: me, value: funds })
      const receipt = await fundTx.wait()
      log([
        `Balance "${name}"`,
        [balance.toString()],
        "Funded to 1 ether",
        [receipt?.transactionHash]
      ])
    } else {
      log([`Balance "${name}"`, [balance.toString(), "Balance is sufficient"]])
    }
  }

  const entryPointDeployer = new DeterministicDeployer(blockchain)
  const entryPointAddress = DeterministicDeployer.getAddress(EntryPoint__factory.bytecode)



  // const isDeployed = await entryPointDeployer.isContractDeployed(entryPointAddress)
  // Sometimes isDeployed = false after an initial deployment
  // Sometimes isDeployed = true, but the deployed contract code is "0x"
  // Deploy bluntly until the returned code is not 0x
  let code = await blockchain.getCode(entryPointAddress)

  while (code == "0x") {
    log(["Code", [code.substring(0, Math.min(20, code.length))]])

    try {
      const _tx = await entryPointDeployer.deterministicDeploy(EntryPoint__factory.bytecode)
    } catch (e: any) {
      const error = e.message as string
      log(["Error", [error.substring(0, Math.min(20, error.length))]])
    }

    await delay(5000)
    code = await blockchain.getCode(entryPointAddress)
  }

  log(["EntryPoint is deployed deterministically at", [entryPointAddress]])
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

