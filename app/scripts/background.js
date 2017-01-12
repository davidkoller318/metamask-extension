const urlUtil = require('url')
const Dnode = require('dnode')
const eos = require('end-of-stream')
const Migrator = require('pojo-migrator')
const migrations = require('./lib/migrations')
const LocalStorageStore = require('./lib/observable/local-storage')
const PortStream = require('./lib/port-stream.js')
const notification = require('./lib/notifications.js')
const messageManager = require('./lib/message-manager')
const setupMultiplex = require('./lib/stream-utils.js').setupMultiplex
const MetamaskController = require('./metamask-controller')
const extension = require('./lib/extension')
const firstTimeState = require('./first-time-state')

const STORAGE_KEY = 'metamask-config'
const METAMASK_DEBUG = 'GULP_METAMASK_DEBUG'
let popupIsOpen = false


//
// State and Persistence
//

// state persistence

let dataStore = new LocalStorageStore({ storageKey: STORAGE_KEY })
// initial state for first time users
if (!dataStore.get()) {
  dataStore.put({ meta: { version: 0 }, data: firstTimeState })
}

// migrations

let migrator = new Migrator({
  migrations,
  // Data persistence methods
  loadData: () => dataStore.get(),
  setData: (newState) => dataStore.put(newState),
})

//
// MetaMask Controller
//

const controller = new MetamaskController({
  // User confirmation callbacks:
  showUnconfirmedMessage: triggerUi,
  unlockAccountMessage: triggerUi,
  showUnapprovedTx: triggerUi,
  // initial state
  initState: migrator.getData(),
})
// setup state persistence
controller.store.subscribe((newState) => migrator.saveData(newState))

//
// connect to other contexts
//

extension.runtime.onConnect.addListener(connectRemote)
function connectRemote (remotePort) {
  var isMetaMaskInternalProcess = remotePort.name === 'popup' || remotePort.name === 'notification'
  var portStream = new PortStream(remotePort)
  if (isMetaMaskInternalProcess) {
    // communication with popup
    popupIsOpen = remotePort.name === 'popup'
    setupTrustedCommunication(portStream, 'MetaMask', remotePort.name)
  } else {
    // communication with page
    var originDomain = urlUtil.parse(remotePort.sender.url).hostname
    setupUntrustedCommunication(portStream, originDomain)
  }
}

function setupUntrustedCommunication (connectionStream, originDomain) {
  // setup multiplexing
  var mx = setupMultiplex(connectionStream)
  // connect features
  controller.setupProviderConnection(mx.createStream('provider'), originDomain)
  controller.setupPublicConfig(mx.createStream('publicConfig'))
}

function setupTrustedCommunication (connectionStream, originDomain) {
  // setup multiplexing
  var mx = setupMultiplex(connectionStream)
  // connect features
  setupControllerConnection(mx.createStream('controller'))
  controller.setupProviderConnection(mx.createStream('provider'), originDomain)
}

//
// remote features
//

function setupControllerConnection (stream) {
  controller.stream = stream
  var api = controller.getApi()
  var dnode = Dnode(api)
  stream.pipe(dnode).pipe(stream)
  dnode.on('remote', (remote) => {
    // push updates to popup
    var sendUpdate = remote.sendUpdate.bind(remote)
    controller.on('update', sendUpdate)
    // teardown on disconnect
    eos(stream, () => {
      controller.removeListener('update', sendUpdate)
      popupIsOpen = false
    })
  })
}

//
// User Interface setup
//

// popup trigger
function triggerUi () {
  if (!popupIsOpen) notification.show()
}

// On first install, open a window to MetaMask website to how-it-works.
extension.runtime.onInstalled.addListener(function (details) {
  if ((details.reason === 'install') && (!METAMASK_DEBUG)) {
    extension.tabs.create({url: 'https://metamask.io/#how-it-works'})
  }
})

// plugin badge text
controller.txManager.on('updateBadge', updateBadge)
function updateBadge () {
  var label = ''
  var unapprovedTxCount = controller.txManager.unapprovedTxCount
  var unconfMsgs = messageManager.unconfirmedMsgs()
  var unconfMsgLen = Object.keys(unconfMsgs).length
  var count = unapprovedTxCount + unconfMsgLen
  if (count) {
    label = String(count)
  }
  extension.browserAction.setBadgeText({ text: label })
  extension.browserAction.setBadgeBackgroundColor({ color: '#506F8B' })
}
