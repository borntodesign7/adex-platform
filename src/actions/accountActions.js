import * as types from 'constants/actionTypes'
import { addSig, getSig } from 'services/auth/auth'
import { getSession, checkSession } from 'services/adex-market/actions'
import {
	getRelayerConfigData,
	getQuickWallet,
	backupWallet,
	getIdentityData,
} from 'services/adex-relayer/actions'
import { updateSpinner, updateGlobalUi } from 'actions'
import { translate } from 'services/translations/translations'
import { getAuthSig } from 'services/smart-contracts/actions/ethers'
import {
	removeLegacyKey,
	getWalletHash,
	generateSalt,
	getRecoveryWalletData,
} from 'services/wallet/wallet'
import { getValidatorAuthToken } from 'services/adex-validator/actions'
import {
	getAccountStats,
	getOutstandingBalance,
} from 'services/smart-contracts/actions/stats'
import { getChannelsWithOutstanding } from 'services/smart-contracts/actions/core'
import {
	addToast,
	confirmAction,
	updateMemoryUi,
	updateInitialDataLoaded,
} from './uiActions'
import { getAllItems } from './itemActions'
import { updateSlotsDemandThrottled } from './analyticsActions'
import {
	getEthereumProvider,
	ethereumNetworkId,
	getMetamaskEthereum,
} from 'services/smart-contracts/ethers'
import { AUTH_TYPES, ETHEREUM_NETWORKS } from 'constants/misc'
import {
	selectAccount,
	selectIdentity,
	selectAuth,
	selectWallet,
	selectSearchParams,
	selectAuthType,
	selectAccountIdentity,
	selectLoginDirectSide,
} from 'selectors'
import { logOut } from 'services/store-data/auth'
import { getErrorMsg } from 'helpers/errors'
import { push } from 'connected-react-router'
import {
	CREATING_SESSION,
	QUICK_WALLET_BACKUP,
	UPDATING_ACCOUNT_IDENTITY,
} from 'constants/spinners'
import { campaignsLoop } from 'services/store-data/campaigns'
import statsLoop from 'services/store-data/account'
import {
	analyticsLoop,
	advancedAnalyticsLoop,
} from 'services/store-data/analytics'

const VALIDATOR_LEADER_ID = process.env.VALIDATOR_LEADER_ID

// MEMORY STORAGE
export function updateSignin(prop, value) {
	return function(dispatch) {
		return dispatch({
			type: types.UPDATE_SIGNIN,
			prop: prop,
			value: value,
		})
	}
}

export function resetSignin() {
	return function(dispatch) {
		return dispatch({
			type: types.RESET_SIGNIN,
		})
	}
}

// PERSISTENT STORAGE
export function createAccount(acc) {
	return function(dispatch) {
		return dispatch({
			type: types.CREATE_ACCOUNT,
			account: acc,
		})
	}
}

// LOGOUT
export function resetAccount() {
	return function(dispatch) {
		return dispatch({
			type: types.RESET_ACCOUNT,
		})
	}
}

export function updateAccount({ meta, newValues }) {
	return function(dispatch) {
		return dispatch({
			type: types.UPDATE_ACCOUNT,
			meta: meta,
			newValues: newValues,
		})
	}
}

export function updateChannelsWithBalanceAll(channels) {
	return function(dispatch) {
		return dispatch({
			type: types.UPDATE_CHANNELS_WITH_BALANCE_ALL,
			channels,
		})
	}
}

export function resetChannelsWithBalanceAll() {
	return function(dispatch) {
		return dispatch({
			type: types.RESET_CHANNELS_WITH_BALANCE_ALL,
		})
	}
}

export function updateChannelsWithOutstandingBalance(channels) {
	return function(dispatch) {
		return dispatch({
			type: types.UPDATE_CHANNELS_WITH_OUTSTANDING_BALANCE,
			channels,
		})
	}
}

export function resetChannelsWithOutstandingBalance() {
	return function(dispatch) {
		return dispatch({
			type: types.RESET_CHANNELS_WITH_OUTSTANDING_BALANCE,
		})
	}
}

export function updateGasData({ gasData }) {
	return function(dispatch) {
		return dispatch({
			type: types.UPDATE_GAS_DATA,
			gasData: gasData,
		})
	}
}

// getIdentityStatistics tooks to long some times
// if the account is change we do not update the account
// TODO: we can use something for abortable tasks
export function isAccountChanged(getState, account) {
	const hasAuth = selectAuth(getState())
	const accountCheck = selectAccount(getState())
	const accountChanged =
		!hasAuth ||
		!accountCheck.wallet.address ||
		accountCheck.wallet.address !== account.wallet.address ||
		!accountCheck.identity.address ||
		!accountCheck.identity.address !== !account.identity.address

	return accountChanged
}

export function updateAccountStats() {
	return async function(dispatch, getState) {
		const account = selectAccount(getState())
		try {
			const { identity, wallet } = account
			const { address } = identity
			const { all, withOutstandingBalance } = await getChannelsWithOutstanding({
				identityAddr: address,
				wallet,
			})

			if (!isAccountChanged(getState, account)) {
				updateChannelsWithBalanceAll(all)(dispatch)
				updateInitialDataLoaded('allChannels', true)(dispatch, getState)
			}

			const outstandingBalanceMainToken = await getOutstandingBalance({
				wallet,
				address,
				withBalance: withOutstandingBalance,
			}).catch(err => {
				console.error('ERR_OUTSTANDING_BALANCES', err)
			})

			const { formatted, raw } = await getAccountStats({
				account,
				outstandingBalanceMainToken,
				all,
			})

			if (!isAccountChanged(getState, account)) {
				await updateChannelsWithOutstandingBalance(withOutstandingBalance)(
					dispatch
				)
				await updateAccount({
					newValues: { stats: { formatted, raw } },
				})(dispatch)
			}
		} catch (err) {
			console.error('ERR_STATS', err)
			addToast({
				type: 'cancel',
				label: translate('ERR_STATS', { args: [getErrorMsg(err)] }),
				timeout: 20000,
			})(dispatch)
		}
	}
}

export function updateAccountIdentityData(onDataUpdated) {
	return async function(dispatch, getState) {
		updateSpinner(UPDATING_ACCOUNT_IDENTITY, true)(dispatch)
		const identity = selectAccountIdentity(getState())

		try {
			const relayerData =
				(await getIdentityData({
					identityAddr: identity.address,
				})) || {}

			const updatedIdentity = { ...identity }

			updatedIdentity.currentPrivileges = relayerData.currentPrivileges
			updatedIdentity.isLimitedVolume = relayerData.isLimitedVolume
			updatedIdentity.relayerData = relayerData

			updateAccount({
				newValues: { identity: updatedIdentity },
			})(dispatch)
			if (typeof onDataUpdated === 'function') {
				onDataUpdated()
			}
		} catch (err) {
			addToast({
				type: 'cancel',
				label: translate('ERR_UPDATING_ACCOUNT_IDENTITY', {
					args: [getErrorMsg(err)],
				}),
				timeout: 20000,
			})(dispatch)
		}
		updateSpinner(UPDATING_ACCOUNT_IDENTITY, true)(dispatch)
	}
}

export function updateValidatorAuthTokens({ newAuth }) {
	return async function(dispatch, getState) {
		const { identity } = getState().persist.account

		const newIdentity = { ...identity }
		const newTokens = { ...(newIdentity.validatorAuthTokens || {}), ...newAuth }

		// We don't want to update account if there is no actual change
		if (
			JSON.stringify(newIdentity.validatorAuthTokens) !==
			JSON.stringify(newTokens)
		) {
			newIdentity.validatorAuthTokens = newTokens
			updateAccount({ newValues: { identity: newIdentity } })(dispatch)
		}
	}
}

export function createSession({
	wallet,
	identity = {},
	email,
	deleteLegacyKey,
}) {
	return async function(dispatch, getState) {
		updateSpinner(CREATING_SESSION, true)(dispatch)
		try {
			const newWallet = { ...wallet }
			const sessionSignature =
				getSig({
					addr: newWallet.address,
					mode: newWallet.authType,
					identity: identity.address,
				}) || null

			const hasSession =
				!!sessionSignature &&
				(await checkSession({
					authSig: sessionSignature,
					skipErrToast: true,
				}))

			if (hasSession) {
				newWallet.authSig = sessionSignature
			} else {
				const {
					signature,
					mode,
					authToken,
					hash,
					typedData,
				} = await getAuthSig({ wallet: newWallet })

				const { status, expiryTime } = await getSession({
					identity: identity.address,
					mode: mode,
					signature,
					authToken,
					hash,
					typedData,
					signerAddress: newWallet.address,
				})

				if (status === 'OK') {
					addSig({
						addr: wallet.address,
						sig: signature,
						mode: wallet.authType,
						expiryTime: expiryTime,
						identity: identity.address,
					})
					newWallet.authSig = signature
				}
			}

			const account = {
				email: email,
				wallet: newWallet,
				identity: { ...identity },
			}

			const leaderValidatorAuth = await getValidatorAuthToken({
				validatorId: VALIDATOR_LEADER_ID,
				account,
			})

			account.identity.validatorAuthTokens = {
				[VALIDATOR_LEADER_ID]: leaderValidatorAuth,
			}

			updateAccount({
				newValues: { ...account },
			})(dispatch)

			if (deleteLegacyKey) {
				await removeLegacyKey({
					email: wallet.email,
					password: wallet.password,
				})
			}

			const side = selectLoginDirectSide(getState())
			updateMemoryUi('initialDataLoaded', false)(dispatch, getState)

			if (['advertiser', 'publisher'].includes(side)) {
				dispatch(push(`/dashboard/${side}`))
				updateGlobalUi('goToSide', '')(dispatch)
			} else {
				dispatch(push('/side-select'))
			}
		} catch (err) {
			console.error('ERR_GETTING_SESSION', err)
			addToast({
				type: 'cancel',
				label: translate('ERR_GETTING_SESSION', { args: [getErrorMsg(err)] }),
				timeout: 20000,
			})(dispatch)
		}

		updateSpinner(CREATING_SESSION, false)(dispatch)
	}
}

export function getRelayerConfig() {
	return async function(dispatch) {
		const cfg = await getRelayerConfigData()
		return dispatch({
			type: types.UPDATE_RELAYER_CFG,
			cfg,
		})
	}
}

async function isMetamaskMatters(getState) {
	const state = getState()
	const searchParams = selectSearchParams(state)
	const authType = selectAuthType(state)

	const doesItMatter =
		authType === AUTH_TYPES.METAMASK.name ||
		(!authType &&
			searchParams.get('external') === 'metamask' &&
			(await getEthereumProvider()) === AUTH_TYPES.METAMASK.name)

	return doesItMatter
}

export function onMetamaskNetworkChange({ id } = {}) {
	return async function(dispatch, getState) {
		if (
			(await isMetamaskMatters(getState)) &&
			process.env.NODE_ENV !== (ETHEREUM_NETWORKS[id] || {}).for
		) {
			confirmAction(
				null,
				null,
				{
					title: translate('WARNING'),
					text: translate('WATNING_METAMASK_INVALID_NETWORK', {
						args: [ETHEREUM_NETWORKS[process.env.NODE_ENV].name],
					}),
				},
				true
			)(dispatch)
		} else {
			confirmAction(null, null, {}, true, false)(dispatch)
		}
	}
}

export const onMetamaskAccountChange = (accountAddress = '') => {
	return async function(_, getState) {
		const state = getState()
		const hasAuth = selectAuth(state)
		const account = selectAccount(state)
		const { authType, address = '' } = account.wallet

		if (
			hasAuth &&
			authType === AUTH_TYPES.METAMASK.name &&
			(!accountAddress ||
				address.toLowerCase() !== accountAddress.toLowerCase())
		) {
			logOut()
		} else if (!hasAuth) {
			const identity = selectIdentity(state)
			const { identityContractOwner } = identity
			logOut(!identityContractOwner || identityContractOwner === accountAddress)
		}
	}
}

export function metamaskAccountCheck() {
	return async function(_, getState) {
		const isMatters = await isMetamaskMatters(getState)
		if (isMatters) {
			const mmEthereum = await getMetamaskEthereum()
			// NOTE:
			// after refresh if metamask is enabled ethereum.selectedAddress is ok,
			// but it is open in new tab is undefined and them most secure way is to call enable() again
			// or just some unknown timeout that may not work
			// the reason for the timeout for the enable is because if it is not enabled and there is
			// auth we need to log out

			const selectedAddress =
				mmEthereum && mmEthereum.selectedAddress
					? mmEthereum.selectedAddress
					: (await Promise.race([
							mmEthereum.enable(),
							new Promise(resolve => {
								setTimeout(() => {
									resolve([null])
								}, 333)
							}),
					  ]))[0]
			onMetamaskAccountChange(selectedAddress)(_, getState)
		}
	}
}

export function metamaskNetworkCheck() {
	return async function(_, getState) {
		const id = await ethereumNetworkId()
		onMetamaskNetworkChange({ id })(_, getState)
	}
}

export function metamaskChecks() {
	return async function(_, getState) {
		metamaskNetworkCheck()(_, getState)
		metamaskAccountCheck()(_, getState)
		if (window.ethereum) {
			window.ethereum.on('accountsChanged', accounts => {
				console.log('acc changed', accounts[0])
				onMetamaskAccountChange(accounts[0])(_, getState)
			})
			window.ethereum.on('networkChanged', network => {
				console.log('networkChanged', network)
				onMetamaskNetworkChange({ id: network })(_, getState)
			})
		}
	}
}

async function hasBackup({ email, password }) {
	const salt = generateSalt(email)
	const hash = await getWalletHash({ salt, password })
	const { encryptedWallet } = await getQuickWallet({ hash })

	return !!encryptedWallet && encryptedWallet.wallet
}

async function makeBackup({ email, password, authType }) {
	const walletSalt = generateSalt(email)
	const walletHash = await getWalletHash({ salt: walletSalt, password })
	const encryptedWallet = await getRecoveryWalletData({
		email,
		password,
		authType,
	})

	await backupWallet({
		email,
		salt: walletSalt,
		hash: walletHash,
		encryptedWallet,
	})
}

export function ensureQuickWalletBackup() {
	return async function(dispatch, getState) {
		updateSpinner(QUICK_WALLET_BACKUP, true)(dispatch)
		try {
			const { email, password, authType } = selectWallet(getState())
			const isLocal = authType === 'quick' || authType === 'grant'

			if (isLocal && !(await hasBackup({ email, password }))) {
				await makeBackup({ email, password, authType })
			}
		} catch (err) {}
		updateSpinner(QUICK_WALLET_BACKUP, false)(dispatch)
	}
}

export function loadAccountData() {
	return async function(dispatch, getState) {
		updateMemoryUi('initialDataLoaded', false)(dispatch, getState)
		const account = selectAccount(getState())
		!isAccountChanged(getState, account) &&
			(await updateAccountIdentityData(() =>
				updateInitialDataLoaded('accountIdentityData', true)(dispatch, getState)
			)(dispatch, getState))

		const items = getAllItems(() =>
			updateInitialDataLoaded('allItems', true)(dispatch, getState)
		)(dispatch, getState)

		const advancedAnalytics = advancedAnalyticsLoop.start(() =>
			updateInitialDataLoaded('advancedAnalytics', true)(dispatch, getState)
		)
		const campaigns = campaignsLoop.start(() =>
			updateInitialDataLoaded('campaigns', true)(dispatch, getState)
		)
		const demand = updateSlotsDemandThrottled()(dispatch, getState)

		await Promise.all[(items, advancedAnalytics, campaigns, demand)]

		await statsLoop.start(() =>
			updateInitialDataLoaded('stats', true)(dispatch, getState)
		)

		updateMemoryUi('initialDataLoaded', true)(dispatch, getState)
	}
}

export function stopAccountDataUpdate() {
	return async function(dispatch, getState) {
		updateMemoryUi('initialDataLoaded', false)(dispatch, getState)
		analyticsLoop.stop()
		advancedAnalyticsLoop.stop()
		campaignsLoop.stop()
		statsLoop.stop()
	}
}
