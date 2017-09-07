const BN = require('ethereumjs-util').BN
const EthQuery = require('ethjs-query')
const normalize = require('eth-sig-util').normalize

class PendingBalanceCalculator {

  constructor ({ getBalance, getPendingTransactions }) {
    this.getPendingTransactions = getPendingTransactions
    this.getNetworkBalance = getBalance
  }

  async getBalance() {
    console.log('getting balance')
    const results = await Promise.all([
      this.getNetworkBalance(),
      this.getPendingTransactions(),
    ])

    const balance = results[0]
    const pending = results[1]

    console.dir(pending)

    const pendingValue = pending.reduce((total, tx) => {
      return total.add(this.valueFor(tx))
    }, new BN(0))

    console.log(`subtracting ${pendingValue.toString()} from ${balance.toString()}`)

    return `0x${ balance.sub(pendingValue).toString(16) }`
  }

  valueFor (tx) {
    const txValue = tx.txParams.value
    const normalized = normalize(txValue).substring(2)
    console.log({ txValue, normalized })
    const value = this.hexToBn(txValue)
    return value
  }

  hexToBn (hex) {
    return new BN(normalize(hex).substring(2), 16)
  }

}

module.exports = PendingBalanceCalculator
