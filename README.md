# About

Simple faucet for arbitrary ERC-20 tokens.  
The `amount` set in config is decimals agnostic (will be multiplied by 10^decimals).    
Includes only the parts of the ERC-20 ABI which are needed (get decimals, check balance, transfer).  

# Usage

* Run `npm install`
* `cp config.json.example config.json`
* Adapt config.json to your needs
* Run with `npm start`

Now any http client can trigger a token transfer to a given address.  
Example: `curl http://localhost:8678/0x05125d60d2754e4d219cae2f2dcba46f73d415a2`  

If the return http status code is 200, a transfer transaction was broadcast and the request ends.  
In order to check if/when the transaction was executed, a caller needs to observe the chain (or the log). 

Note that the application doesn't check by itself if the faucet account has enough token funds to start/continue operating.  
It will only check once (at startup) if it has a non-zero Ether balance for tx fees.
