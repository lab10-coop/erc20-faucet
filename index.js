var http = require('http');
var url = require('url');
var Web3 = require('web3');
var BN = Web3.utils.BN;

// globals
const config = require('./config');
const minimal_abi = require('./minimal_abi');
let web3, contract, decimals;

// wrapping the init stuff into an async function in order to have await available
async function start() {
  if(! ((parseInt(config.amount) && config.amount > 0))) {
    console.error('ERR: no valid amount configured (only positive integers allowed)');
    process.exit(1);
  }

  web3 = new Web3(new Web3.providers.HttpProvider(config.network.rpc));

  const faucetEthBalance = await web3.eth.getBalance(config.account.address);
  if(faucetEthBalance === 0) {
    console.error(`ERR: Faucet account ${config.account.address} has no funds for tx fees.`);
    process.exit(1);
  }

  contract = new web3.eth.Contract(minimal_abi, config.tokenAddress, { from: config.account.address });
  console.log(`contract initialized at ${config.tokenAddress}`);

  try {
    decimals = await contract.methods.decimals().call();
    console.log(`token has ${decimals} decimals`);
  } catch(e) {
    console.log(`ERR: there seems to be no ERC-20 compatible contract at address ${config.tokenAddress} on this network`);
    process.exit(1);
  }

  http.createServer(handleRequest).listen(config.network.listenPort, config.network.listenInterface);
  console.log(`http server listening at interface ${config.network.listenInterface} port ${config.network.listenPort}`);
}

function handleRequest(req, res) {
  var pathname = url.parse(req.url).pathname;
  console.log(`request for ${pathname}`);

  res.setHeader('Access-Control-Allow-Origin', '*');

  // check if it's a path we care about
  var splitPath = url.parse(req.url).path.split('/');
  if(splitPath[1].startsWith('0x')) {
    var userAddr = splitPath[1];
    if(! web3.utils.isAddress(userAddr)) {
      res.writeHead(401, {'Content-Type': 'text/plain'});
      res.end(`not a valid address: ${userAddr}\n`);
      return;
    }

    console.log(`processing for ${userAddr}`);
    refuelAccount(userAddr, (err, txHash) => {
      // this is an ugly workaround needed because web3 may throw an error after giving us a txHash
      if(res.finished) return;

      if(err) {
        res.writeHead(500, {'Content-Type': 'text/plain'});
        res.end(`${err}\n`);
      }
      if(txHash) {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end(`txHash: ${txHash}\n`);
      }
    });
  } else {
    res.writeHead(401, {'Content-Type': 'text/plain'});
    res.end('Illegal request. Check if the address starts with 0x');
  }
}

// sends some tokens to the given account <userAddr>, invokes the given callback with the resulting transaction hash
async function refuelAccount(userAddr, callback) {
  console.log(`sending ${config.amount} tokens to ${userAddr}...`);

  const txObj = {
    from: config.account.address,
    to: config.tokenAddress,
    data: contract.methods.transfer(userAddr, new BN(config.amount).mul(new BN(10).pow(new BN(decimals))).toString()).encodeABI(),
    gas: config.gas,
    gasPrice: config.gasPrice
  };
  const signedTxObj = await web3.eth.accounts.signTransaction(txObj, config.account.privateKey);

  web3.eth.sendSignedTransaction(signedTxObj.rawTransaction)
    .once('transactionHash', function (txHash) {
      console.log(`waiting for processing of token transfer transaction ${txHash}`);
      callback(null, txHash);
    })
    .once('receipt', function (receipt) {
      if (! receipt.status) {
        console.error(`token transfer transaction ${receipt.transactionHash} failed`);
      } else {
        console.log(`token transfer transaction ${receipt.transactionHash} executed in block ${receipt.blockNumber} consuming ${receipt.gasUsed} gas`);
      }
    })
    .on('error', function (err) {
      console.error(`token transfer transaction failed: ${err}`);
      callback(err, null);
    });
}

start();
