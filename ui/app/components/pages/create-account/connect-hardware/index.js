const { Component } = require('react')
const PropTypes = require('prop-types')
const h = require('react-hyperscript')
const connect = require('react-redux').connect
const actions = require('../../../../actions')
const ConnectScreen = require('./connect-screen')
const AccountList = require('./account-list')
const { DEFAULT_ROUTE } = require('../../../../routes')
const { formatBalance } = require('../../../../util')

class ConnectHardwareForm extends Component {
  constructor (props, context) {
    super(props)
    this.state = {
      error: null,
      btnText: context.t('connectToTrezor'),
      selectedAccount: null,
      accounts: [],
      browserSupported: true,
    }
  }

  componentWillReceiveProps (nextProps) {
    const { accounts } = nextProps
    const newAccounts = this.state.accounts.map(a => {
      const normalizedAddress = a.address.toLowerCase()
      const balanceValue = accounts[normalizedAddress] && accounts[normalizedAddress].balance || null
      a.balance = balanceValue ? formatBalance(balanceValue, 6) : '...'
      return a
    })
    this.setState({accounts: newAccounts})
  }


  async componentDidMount () {
    const unlocked = await this.props.checkHardwareStatus('trezor')
    if (unlocked) {
      this.getPage(0)
    }
  }

  connectToTrezor = () => {
    if (this.state.accounts.length) {
      return null
    }
    this.setState({ btnText: this.context.t('connecting')})
    this.getPage(0)
  }

  onAccountChange = (account) => {
    this.setState({selectedAccount: account.toString(), error: null})
  }

  getPage = (page) => {
    this.props
      .connectHardware('trezor', page)
      .then(accounts => {
        if (accounts.length) {
          const newState = {}
          // Default to the first account
          if (this.state.selectedAccount === null) {
            const firstAccount = accounts[0]
            newState.selectedAccount = firstAccount.index.toString() === '0' ? firstAccount.index.toString() : null
          // If the page doesn't contain the selected account, let's deselect it
          } else if (!accounts.filter(a => a.index.toString() === this.state.selectedAccount).length) {
            newState.selectedAccount = null
          }


          // Map accounts with balances
          newState.accounts = accounts.map(account => {
            const normalizedAddress = account.address.toLowerCase()
            const balanceValue = this.props.accounts[normalizedAddress] && this.props.accounts[normalizedAddress].balance || null
            account.balance = balanceValue ? formatBalance(balanceValue, 6) : '...'
            return account
          })

          this.setState(newState)
        }
      })
      .catch(e => {
        if (e === 'Window blocked') {
          this.setState({ browserSupported: false })
        }
        this.setState({ btnText: this.context.t('connectToTrezor') })
      })
  }

  onForgetDevice = () => {
    this.props.forgetDevice('trezor')
    .then(_ => {
      this.setState({
        error: null,
        btnText: this.context.t('connectToTrezor'),
        selectedAccount: null,
        accounts: [],
      })
    }).catch(e => {
      this.setState({ error: e.toString() })
    })
  }

  onUnlockAccount = () => {

    if (this.state.selectedAccount === null) {
      this.setState({ error: this.context.t('accountSelectionRequired') })
    }

    this.props.unlockTrezorAccount(this.state.selectedAccount)
    .then(_ => {
      this.props.history.push(DEFAULT_ROUTE)
    }).catch(e => {
      this.setState({ error: e.toString() })
    })
  }

  onCancel = () => {
    this.props.history.push(DEFAULT_ROUTE)
  }

  renderError () {
    return this.state.error
      ? h('span.error', { style: { marginBottom: 40 } }, this.state.error)
      : null
  }

  renderContent () {
    if (!this.state.accounts.length) {
      return h(ConnectScreen, {
        connectToTrezor: this.connectToTrezor,
        btnText: this.state.btnText,
        browserSupported: this.state.browserSupported,
      })
    }

    return h(AccountList, {
      accounts: this.state.accounts,
      selectedAccount: this.state.selectedAccount,
      onAccountChange: this.onAccountChange,
      network: this.props.network,
      getPage: this.getPage,
      history: this.props.history,
      onUnlockAccount: this.onUnlockAccount,
      onForgetDevice: this.onForgetDevice,
      onCancel: this.onCancel,
    })
  }

  render () {
    return h('div.new-account-create-form', [
      this.renderError(),
      this.renderContent(),
    ])
  }
}

ConnectHardwareForm.propTypes = {
  hideModal: PropTypes.func,
  showImportPage: PropTypes.func,
  showConnectPage: PropTypes.func,
  connectHardware: PropTypes.func,
  checkHardwareStatus: PropTypes.func,
  forgetDevice: PropTypes.func,
  unlockTrezorAccount: PropTypes.func,
  numberOfExistingAccounts: PropTypes.number,
  history: PropTypes.object,
  t: PropTypes.func,
  network: PropTypes.string,
  accounts: PropTypes.object,
}

const mapStateToProps = state => {
  const {
    metamask: { network, selectedAddress, identities = {}, accounts = [] },
  } = state
  const numberOfExistingAccounts = Object.keys(identities).length

  return {
    network,
    accounts,
    address: selectedAddress,
    numberOfExistingAccounts,
  }
}

const mapDispatchToProps = dispatch => {
  return {
    connectHardware: (deviceName, page) => {
      return dispatch(actions.connectHardware(deviceName, page))
    },
    checkHardwareStatus: (deviceName) => {
      return dispatch(actions.checkHardwareStatus(deviceName))
    },
    forgetDevice: (deviceName) => {
      return dispatch(actions.forgetDevice(deviceName))
    },
    unlockTrezorAccount: index => {
      return dispatch(actions.unlockTrezorAccount(index))
    },
    showImportPage: () => dispatch(actions.showImportPage()),
    showConnectPage: () => dispatch(actions.showConnectPage()),
  }
}

ConnectHardwareForm.contextTypes = {
  t: PropTypes.func,
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(
  ConnectHardwareForm
)
