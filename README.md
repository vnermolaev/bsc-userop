# Start a BSC node

* Clone BSC:
git clone git@github.com:bnb-chain/bsc.git 

* Go to BSC folder
    * `git checkout eip4338-api-aa-london`
    * `make geth`
    * `mkdir tempdatadir `
    * Put `genesis.json` file in the tempdatadir folder 
    * `./build/bin/geth --datadir tempdatadir init tempdatadir/genesis.json`
    * `./build/bin/geth --datadir tempdatadir  console --http --http.corsdomain https://remix.ethereum.org --allow-insecure-unlock --http.api personal,eth,net,web3,debug --http.vhosts '*,localhost,host.docker.internal'  --http.addr "0.0.0.0" --rpc.allow-unprotected-txs --networkid 1337 --miner.etherbase 0x9fb29aac15b9a4b7f17c3385939b007540f4d791 --vmdebug`
* Start the miner in one go at the _first_ start 
`personal.importRawKey("9b28f36fbd67381120752d6172ecdcf10e06ab2d9a1367aac00cdcd6ac7855d3", "123456"); personal.unlockAccount("0x9fb29aac15b9a4b7f17c3385939b007540f4d791", "123456", 0); miner.start();`
* For any other time `personal.unlockAccount("0x9fb29aac15b9a4b7f17c3385939b007540f4d791", "123456", 0); miner.start();`


# Set up a bundler

* Clone the forked stackup-bundler which has the changes to make it compatible with london & berlin enabled BSC.
`git clone git@github.com:emailtovamos/stackup-bundler-bsc-aa.git`

* `cd stackup-bundler-bsc-aa`

* `git checkout bsc-AA`

* (If not already done) In `internal/config/values.go` change 
`Viper.SetDefault("erc4337_bundler_port", 4337)`
to
`Viper.SetDefault("erc4337_bundler_port", 3000)`
to make the bundler expose its API on port 3000

* `make install-dev`

* `make generate-environment`
This will generate the `.env` file. Add the following in this:
    ```
    ERC4337_BUNDLER_ETH_CLIENT_URL=http://127.0.0.1:8545
    ERC4337_BUNDLER_PRIVATE_KEY=ddcd272732bfe889da92201da3527cb0faa4f3be06f5baa9e9269b700dfa2c2c
    ```
* `make fetch-wallet` (Parses private key in .env file and prints public key and address)

* `make dev-private-mode`
(Run bundler in private mode, it refreshes as you change any code)
    * you may need to install [Air](https://github.com/cosmtrek/air).
    * you may need to change a build target in `Makefile`:
    
    OLD: 
    ```
    dev-private-mode:
    air -c .air.private-mode.toml
    ```

    NEW
    ```
    dev-private-mode:
    $$(go env GOPATH)/bin/air -c .air.private-mode.toml
    ```
* If the above doesn’t work for some reason, simply do:
`go run main.go start --mode=private`

# Send some user operations

* Clone 


