import { SimpleAccountFactory__factory, SimpleAccount__factory, UserOperationStruct } from "@account-abstraction/contracts"
import { ParamType } from "@ethersproject/abi"
import { ethers } from "hardhat"

// Logging functionality to output well-formatted tree-like structures
export type StringTree = Array<StringTree | string>

export function log(tree: StringTree) {
    function concat(tree: StringTree, prefix = ""): string {
        return tree.map(element => {
            if (typeof element == "string") {
                return element
                    .split("\n")
                    .map(line => `${prefix}${line}`)
                    .join("\n")
            } else {
                return concat(element, `${prefix}  `)
            }
        }).join("\n")
    }

    console.log(concat(tree, "") + "\n")
}

export async function delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}
