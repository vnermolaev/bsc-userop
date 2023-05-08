import { ENTRY_POINT_ADDRESS, BLOCKCHAIN_URL, BUNDLER_URL, BUDNLER_ACCOUNT, HARDHAT_ACCOUNT } from "./consts"
import { ethers } from "hardhat"
import { delay, log } from "./utils"
import { DeterministicDeployer } from "@account-abstraction/sdk"
import { EntryPoint__factory, SimpleAccountFactory__factory, SimpleAccount__factory, UserOperationStruct } from "@account-abstraction/contracts"
import * as ERC4337Utils from "./ERC4337Utils"

async function main() {
    const blockchain = new ethers.providers.JsonRpcBatchProvider(BLOCKCHAIN_URL)
    log(["Connected to", [blockchain.connection.url]])

    // Create deterministically a wallet for a user on which behalf userOps will be sent.
    const owner = new ethers.Wallet('0x'.padEnd(66, '7'))
    const ownerAddress = await owner.getAddress()
    log(["Owner (user op sender)", [
        "address", [ownerAddress],
        "Private key", [owner.privateKey],
        "Public key", [owner.publicKey]
    ]
    ])

    // Deploy an account factory (AF).
    // AF will deploy account smart contracts.
    const accountFactoryDeployer = new DeterministicDeployer(blockchain)
    let accountFactoryAddress = DeterministicDeployer.getAddress(new SimpleAccountFactory__factory(), 0, [ENTRY_POINT_ADDRESS])

    if (!await accountFactoryDeployer.isContractDeployed(accountFactoryAddress)) {
        accountFactoryAddress = await accountFactoryDeployer.deterministicDeploy(new SimpleAccountFactory__factory(), 0, [ENTRY_POINT_ADDRESS])
        log(["SimpleAccountFactory__factory has been deployed at", [accountFactoryAddress]])
    } else {
        log(["SimpleAccountFactory__factory is ALREADY deployed at", [accountFactoryAddress]])
    }

    // Connect to the account factory.
    const accountFactory = SimpleAccountFactory__factory.connect(accountFactoryAddress, blockchain)
    const initData = accountFactory.interface.encodeFunctionData(
        'createAccount',
        [ownerAddress, ethers.BigNumber.from(0)]
    )
    const initCode = ethers.utils.hexConcat([
        accountFactoryAddress,
        initData
    ])

    // Estimate gas to create a new account.
    const initGas = await blockchain.estimateGas({
        to: accountFactoryAddress,
        data: initData
    })

    // Calculate what address a newly deployed account will have.
    const entryPoint = EntryPoint__factory.connect(ENTRY_POINT_ADDRESS, blockchain).connect(ethers.constants.AddressZero)
    const getAccountAddress = async () => {
        // An uber hacky way to calculate an address to be created
        // by attempting to execute the initCode, expecting it to fail
        // and catching/parsing the error message.
        try {
            await entryPoint.callStatic.getSenderAddress(initCode)
        } catch (e: any) {
            return e.errorArgs.sender as string
        }
        throw new Error("Failed to identify a sender that should be created if the respective initCode will be invoked")
    }

    let accountAddress = ethers.constants.AddressZero
    do {
        try {
            accountAddress = await getAccountAddress()
        } catch (e: any) {
            const error = e.message as string
            log(["Error", [error.substring(0, Math.min(20, error.length))]])
            accountAddress = ethers.constants.AddressZero
        }

        await delay(5000)
    } while (accountAddress == ethers.constants.AddressZero)

    log(["SimpleAccountFactory__factory `createAccount` will be called with",
        ["initCode", [initCode]],
        ["Estimated gas", [initGas.toString()]],
        ["Created _account_ address will be", [accountAddress]]
    ])

    // Fund future accound address if required.
    const fundingAccount = blockchain.getSigner()
    const balance = await blockchain.getBalance(accountAddress);
    const requiredBalance = ethers.utils.parseEther("1")

    if (balance.lt(requiredBalance)) {
        const funds = requiredBalance.sub(balance)
        const fundTx = await fundingAccount.sendTransaction({ to: accountAddress, value: funds })
        const receipt = await fundTx.wait()
        log([
            `Balance "${accountAddress}"`,
            [balance.toString()],
            "Funded to 1 ether",
            [receipt?.transactionHash]
        ])
    } else {
        log([`Balance "${accountAddress}"`, [balance.toString(), "Balance is sufficient"]])
    }

    // Provide data required to call `execute` on an account smart contract.
    const accountContract = SimpleAccount__factory.connect(accountAddress, blockchain)
    const callData = accountContract.interface.encodeFunctionData(
        'execute',
        [accountAddress, ethers.BigNumber.from(0), "0xaffed0e0"]
    )

    // Estimate gas required to call `execute` on an account smart contract.
    const callGasLimit = await blockchain.estimateGas({
        from: ENTRY_POINT_ADDRESS,
        to: accountAddress,
        data: callData
    })
    log(["SimpleAccount__factory `execute` will be called with",
        ["callData", [callData]],
        ["Estimated gas", [callGasLimit.toString()]]
    ])

    // // Hard-code verification gas limit.
    const verificationGasLimit = ethers.BigNumber.from(100000).add(initGas)
    const preVerificationGas = ethers.utils.parseEther("0.1")

    // // Calculate fees.
    const feeData = await blockchain.getFeeData()
    const maxFeePerGas = feeData.maxFeePerGas ?? ethers.utils.parseEther("0.1")
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? ethers.utils.parseEther("0.1")

    // Construct a user operation.

    // Derive nonce and initCode, the latter must be empty if the account contract has already been deployed.
    const { nonce, actualInitCode } = await (async () => {
        if (await accountContract.provider.getCode(accountAddress) == "0x") {
            // Account contract has not yet been deployed.
            return {
                nonce: ethers.BigNumber.from(0),
                actualInitCode: initCode
            }
        } else {
            // Account has been deployed and thus should not be deployed again.
            return {
                nonce: await accountContract.nonce(),
                actualInitCode: "0x"
            }
        }
    })()

    const partialUserOp: ERC4337Utils.NotPromise<UserOperationStruct> = {
        sender: accountAddress,
        nonce,
        initCode: actualInitCode,
        callData,
        callGasLimit,
        verificationGasLimit,
        preVerificationGas: 45040,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndData: "0x",
        signature: ""
    };

    const userOpHash = ERC4337Utils.getUserOpHash(partialUserOp, ENTRY_POINT_ADDRESS, 1337)

    const signature = await owner.signMessage(ethers.utils.arrayify(userOpHash))
    log(["Signing",
        ["Signer", [owner.address]],
        ["User operation hash", [userOpHash]],
        ["Signature", [signature]]
    ])

    const userOp = Object.assign(partialUserOp, { signature })
    log(["User operation", [JSON.stringify(userOp, null, 2)]])

    // Set up a connection with the bundler.
    const bundler = new ethers.providers.JsonRpcProvider(BUNDLER_URL)

    // Minimal test to verify that the bundler is online.
    const chainId = await bundler.send('eth_chainId', [])
    log(["Bundler bundles for", ["chain id", [chainId]]])

    const hexUserOp = ERC4337Utils.deepHexlify(userOp)
    const response = await bundler.send('eth_sendUserOperation', [hexUserOp, ENTRY_POINT_ADDRESS])
    log(["UserOp has been processed in a batch id", [JSON.stringify(response)]])
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});