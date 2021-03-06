import { getEthers } from 'services/smart-contracts/ethers'
import {
	getSigner,
	getMultipleTxSignatures,
} from 'services/smart-contracts/actions/ethers'
import { getSweepingTxnsIfNeeded } from 'services/smart-contracts/actions/core'
import { Contract } from 'ethers'
import {
	bigNumberify,
	parseUnits,
	getAddress,
	Interface,
	keccak256,
	id,
} from 'ethers/utils'
import { generateAddress2 } from 'ethereumjs-util'
import { executeTx } from 'services/adex-relayer'
import {
	selectRelayerConfig,
	selectMainToken,
	selectFeeTokenWhitelist,
	selectSaiToken,
	t,
} from 'selectors'
import { formatTokenAmount } from 'helpers/formatters'
import { getProxyDeployBytecode } from 'adex-protocol-eth/js/IdentityProxyDeploy'
import solc from 'solcBrowser'
import { RoutineAuthorization } from 'adex-protocol-eth/js/Identity'
import ERC20TokenABI from 'services/smart-contracts/abi/ERC20Token'
import ScdMcdMigrationABI from 'services/smart-contracts/abi/ScdMcdMigration'
import { contracts } from 'services/smart-contracts/contractsCfg'
const { AdExENSManager, ReverseRegistrar } = contracts

const ERC20 = new Interface(ERC20TokenABI)
const ScdMcdMigration = new Interface(ScdMcdMigrationABI)
const AdExENSManagerInterface = new Interface(AdExENSManager.abi)
const ReverseRegistrarInterface = new Interface(ReverseRegistrar.abi)
const { SCD_MCD_MIGRATION_ADDR } = process.env

export async function getIdentityDeployData({
	owner,
	relayerRoutineAuthValidUntil = 10648454444,
}) {
	const {
		identityFactoryAddr,
		relayerAddr,
		baseIdentityAddr,
		identityRecoveryAddr,
		coreAddr,
		mainToken,
	} = selectRelayerConfig()

	const privileges = [[owner, 2], [identityRecoveryAddr, 2]]

	const routineAuthorizationsRaw = [
		{
			relayer: relayerAddr,
			outpace: coreAddr,
			validUntil: relayerRoutineAuthValidUntil,
			feeTokenAddr: mainToken.address,
			feeTokenAmount: '0x00',
		},
	]

	const bytecode = getProxyDeployBytecode(
		baseIdentityAddr,
		privileges,
		{
			privSlot: 0,
			routineAuthsSlot: 1,
			routineAuthorizations: routineAuthorizationsRaw.map(x =>
				new RoutineAuthorization(x).hash()
			),
		},
		solc
	)

	const salt = keccak256(owner)

	const identityAddr = getAddress(
		`0x${generateAddress2(identityFactoryAddr, salt, bytecode).toString('hex')}`
	)

	return {
		identityFactoryAddr,
		baseIdentityAddr,
		bytecode,
		salt,
		identityAddr,
		privileges,
		routineAuthorizationsRaw,
	}
}

export async function withdrawFromIdentity({
	account,
	amountToWithdraw,
	withdrawTo,
	getFeesOnly,
}) {
	const mainToken = selectMainToken()
	const { decimals, symbol, address: tokenAddr } = mainToken
	const { wallet, identity, stats } = account
	const { authType } = wallet
	const { availableIdentityBalanceMainToken } = stats.raw
	const { provider, Identity, getToken } = await getEthers(authType)

	const identityAddr = identity.address

	const toWithdraw = parseUnits(amountToWithdraw, decimals)

	const withdrawTx = {
		identityContract: identityAddr,
		feeTokenAddr: tokenAddr,
		to: tokenAddr,
		data: ERC20.functions.transfer.encode([withdrawTo, toWithdraw]),
		withdrawTx: true,
	}
	const txns = [withdrawTx]

	const txnsByFeeToken = await getIdentityTxnsWithNoncesAndFees({
		amountInMainTokenNeeded: toWithdraw,
		txns,
		identityAddr,
		provider,
		Identity,
		account,
		getToken,
	})

	const fees = await getIdentityTxnsTotalFees({ txnsByFeeToken, mainToken })
	const mtBalance = bigNumberify(availableIdentityBalanceMainToken)

	if (fees.totalBN.gt(mtBalance)) {
		throw new Error(
			t('ERR_INSUFFICIENT_BALANCE_WITHDRAW', {
				args: [
					`${formatTokenAmount(
						mtBalance.toString(),
						decimals,
						false,
						2
					)} ${symbol}`,
					`${fees.total} ${symbol}`,
					`${formatTokenAmount(toWithdraw.toString(), decimals)} ${symbol}`,
				],
			})
		)
	}

	const maxWithdraw = mtBalance.sub(fees.totalBN)

	let actualWithdrawAmount = toWithdraw

	if (toWithdraw.gt(maxWithdraw)) {
		actualWithdrawAmount = maxWithdraw
		txnsByFeeToken[tokenAddr] = txnsByFeeToken[tokenAddr].map(tx => {
			if (tx.withdrawTx) {
				tx.data = ERC20.functions.transfer.encode([
					withdrawTo,
					actualWithdrawAmount.toString(),
				])
			}

			return tx
		})
	}

	if (getFeesOnly) {
		return {
			fees: fees.total,
			totalBN: fees.totalBN,
			actualWithdrawAmount,
			toGet: formatTokenAmount(actualWithdrawAmount, decimals),
		}
	}

	const result = await processExecuteByFeeTokens({
		identityAddr,
		txnsByFeeToken,
		wallet,
		provider,
	})

	return {
		result,
	}
}

export async function setIdentityPrivilege({
	account,
	setAddr,
	privLevel,
	getFeesOnly,
}) {
	const { wallet, identity } = account
	const { provider, MainToken, Identity, getToken } = await getEthers(
		wallet.authType
	)
	const identityAddr = identity.address

	const identityInterface = new Interface(Identity.abi)

	const tx1 = {
		identityContract: identityAddr,
		feeTokenAddr: MainToken.address,
		to: identityAddr,
		data: identityInterface.functions.setAddrPrivilege.encode([
			setAddr,
			privLevel,
		]),
	}

	const txns = [tx1]
	const txnsByFeeToken = await getIdentityTxnsWithNoncesAndFees({
		txns,
		identityAddr,
		provider,
		Identity,
		account,
		getToken,
	})

	if (getFeesOnly) {
		const { total, totalBN } = await getIdentityTxnsTotalFees({
			txnsByFeeToken,
		})
		return {
			fees: total,
			totalBN,
		}
	}

	const result = await processExecuteByFeeTokens({
		txnsByFeeToken,
		identityAddr,
		wallet,
		provider,
		extraData: {
			setAddr,
			privLevel,
		},
	})

	return {
		result,
	}
}
function txnsByTokenWithSaiToDaiSwap({
	txns,
	mainToken,
	daiAddr,
	saiAddr,
	identityAddr,
}) {
	const { txnsByFeeToken, saiWithdrawAmount } = txns.reduce(
		(current, tx, i) => {
			const { withdrawAmountByToken } = tx

			const needSaiToDaiSwap =
				!!saiAddr &&
				!!withdrawAmountByToken &&
				!!withdrawAmountByToken[saiAddr] &&
				(tx.feeTokenAddr === saiAddr || !tx.feeTokenAddr) &&
				mainToken.address === daiAddr &&
				saiAddr !== daiAddr

			let feeTokenAddr = ''

			if (needSaiToDaiSwap) {
				current.saiWithdrawAmount = current.saiWithdrawAmount.add(
					bigNumberify(withdrawAmountByToken[saiAddr])
				)
				feeTokenAddr = daiAddr
			}

			feeTokenAddr = feeTokenAddr || tx.feeTokenAddr || mainToken.address
			// normalize tx
			tx.feeTokenAddr = feeTokenAddr
			tx.identityContract = (tx.identityContract || identityAddr).toLowerCase()

			current.txnsByFeeToken[feeTokenAddr] = [
				...(current.txnsByFeeToken[feeTokenAddr] || []),
				tx,
			]

			return current
		},
		{
			saiWithdrawAmount: bigNumberify('0'),
			txnsByFeeToken: {},
		}
	)

	return { txnsByFeeToken, saiWithdrawAmount }
}

export async function addIdentityENS({ username = '', account, getFeesOnly }) {
	const { wallet, identity } = account
	const { provider, MainToken, getToken, Identity } = await getEthers(
		wallet.authType
	)
	const identityAddr = identity.address

	const tx1 = {
		identityContract: identityAddr,
		feeTokenAddr: MainToken.address,
		to: AdExENSManager.address,
		data: AdExENSManagerInterface.functions.registerAndSetup.encode([
			AdExENSManager.publicResolver,
			id(username),
			identityAddr,
		]),
	}

	const tx2 = {
		identityContract: identityAddr,
		feeTokenAddr: MainToken.address,
		to: ReverseRegistrar.address,
		data: ReverseRegistrarInterface.functions.setName.encode([
			`${username}.${ReverseRegistrar.parentDomain}`,
		]),
	}

	const txns = [tx1, tx2]

	const txnsByFeeToken = await getIdentityTxnsWithNoncesAndFees({
		txns,
		identityAddr,
		provider,
		Identity,
		account,
		getToken,
	})

	const { mainToken } = selectRelayerConfig()
	const { total, totalBN } = await getIdentityTxnsTotalFees({
		txnsByFeeToken,
		mainToken,
	})
	if (getFeesOnly) {
		return {
			fees: total,
			totalBN,
		}
	}

	const result = await processExecuteByFeeTokens({
		identityAddr,
		txnsByFeeToken,
		wallet,
		provider,
	})

	return {
		result,
	}
}

export async function getIdentityTxnsWithNoncesAndFees({
	amountInMainTokenNeeded = '0',
	txns = [],
	identityAddr,
	provider,
	Identity,
	account,
	getToken,
}) {
	const feeTokenWhitelist = selectFeeTokenWhitelist()
	const saiToken = selectSaiToken()
	const { mainToken, daiAddr, saiAddr } = selectRelayerConfig()
	const mainTokenWithFees = feeTokenWhitelist[mainToken.address]

	let isDeployed = (await provider.getCode(identityAddr)) !== '0x'
	let identityContract = null

	if (isDeployed) {
		identityContract = new Contract(identityAddr, Identity.abi, provider)
	}

	const initialNonce = isDeployed
		? (await identityContract.nonce()).toNumber()
		: 0

	const feesForMainTxns = txns.length
		? bigNumberify(
				!initialNonce
					? mainTokenWithFees.minDeploy
					: mainTokenWithFees.minRecommended
		  ).add(
				bigNumberify(mainTokenWithFees.minRecommended).mul(
					bigNumberify(txns.length - 1)
				)
		  )
		: bigNumberify(0)

	const totalAmountInMainTokenNeeded = feesForMainTxns.add(
		bigNumberify(amountInMainTokenNeeded)
	)

	const {
		sweepTxns = [],
		swapAmountsByToken = {},
	} = await getSweepingTxnsIfNeeded({
		amountInMainTokenNeeded: totalAmountInMainTokenNeeded,

		account,
	})

	// { txnsByFeeToken, saiWithdrawAmount }
	const sweepTxnsByToken = txnsByTokenWithSaiToDaiSwap({
		txns: sweepTxns,
		mainToken,
		daiAddr,
		saiAddr,
		identityAddr,
	})

	// { txnsByFeeToken, saiWithdrawAmount }
	const otherTxnsByToken = txnsByTokenWithSaiToDaiSwap({
		txns,
		mainToken,
		daiAddr,
		saiAddr,
		identityAddr,
	})

	// 1st - always get sweeping txns (channelWithdraw)
	// 2nd - swap SAI to DAI if needed (main token is DAI)
	// 3rd - make other txns with the main token only

	// TODO: make it work with other tokens
	// TODO: change getSwapAmountsByToken if more swaps are supported
	const saiSwapAmount = sweepTxnsByToken.saiWithdrawAmount
		.add(otherTxnsByToken.saiWithdrawAmount)
		.add(bigNumberify(swapAmountsByToken[saiAddr] || 0))

	if (!saiSwapAmount.isZero()) {
		sweepTxnsByToken.txnsByFeeToken[daiAddr] = [
			...(sweepTxnsByToken.txnsByFeeToken[daiAddr] || []),
			...(await swapSaiToDaiTxns({
				getToken,
				identityAddr,
				daiAddr,
				saiToken,
				swapAmount: saiSwapAmount,
			})),
		]
	}

	const allFeeTokens = [
		...new Set([
			...Object.keys(sweepTxnsByToken.txnsByFeeToken),
			...Object.keys(otherTxnsByToken.txnsByFeeToken),
		]),
	]

	const txnsByFeeToken = allFeeTokens.reduce((txns, token) => {
		txns[token] = [
			...(sweepTxnsByToken.txnsByFeeToken[token] || []),
			...(otherTxnsByToken.txnsByFeeToken[token] || []),
		]

		return txns
	}, {})

	let currentNonce = initialNonce

	Object.keys(txnsByFeeToken).forEach(key => {
		txnsByFeeToken[key] = txnsByFeeToken[key].map(tx => {
			const { routinesSweepTxCount = 0, extraTxFeesCount = 0, isSweepTx } = tx
			const feeToken = feeTokenWhitelist[tx.feeTokenAddr]
			const txFeeAmount = isSweepTx ? feeToken.min : feeToken.minRecommended

			const minFeeAmount = bigNumberify(
				currentNonce === 0 ? feeToken.minDeploy : txFeeAmount
			)

			const sweepRoutinesFeeAmount = bigNumberify(routinesSweepTxCount).mul(
				bigNumberify(feeToken.min)
			)

			const extraFeesAmount = bigNumberify(extraTxFeesCount).mul(
				bigNumberify(feeToken.minRecommended)
			)

			// Total relayer fees for the transaction
			const feeAmount = minFeeAmount
				.add(sweepRoutinesFeeAmount)
				.add(extraFeesAmount)
				.toString()

			// fees that are not pre calculated with in the total identity balance
			const nonIdentityBalanceFeeAmount = bigNumberify(feeAmount)
				.sub(bigNumberify(isSweepTx ? feeToken.min : 0))
				.sub(bigNumberify(routinesSweepTxCount).mul(bigNumberify(feeToken.min)))
				.toString()

			const txWithNonce = {
				...tx,
				feeTokenAddr: feeToken.address,
				feeAmount,
				nonce: currentNonce,
				nonIdentityBalanceFeeAmount,
			}

			currentNonce += 1

			return txWithNonce
		})
	})

	return txnsByFeeToken
}

export async function getApproveTxns({
	getToken,
	token,
	identityAddr,
	feeTokenAddr,
	approveForAddress,
	approveAmount,
}) {
	const tokenContract = getToken(token)

	const allowance = await tokenContract.allowance(
		identityAddr,
		approveForAddress
	)

	const approveTxns = []

	if (!allowance.isZero()) {
		approveTxns.push({
			identityContract: identityAddr,
			feeTokenAddr: feeTokenAddr,
			to: token.address,
			data: ERC20.functions.approve.encode([approveForAddress, 0]),
		})
	}

	approveTxns.push({
		identityContract: identityAddr,
		feeTokenAddr: feeTokenAddr,
		to: token.address,
		data: ERC20.functions.approve.encode([approveForAddress, approveAmount]),
	})

	return approveTxns
}

async function swapSaiToDaiTxns({
	identityAddr,
	daiAddr,
	saiToken,
	swapAmount,
	getToken,
}) {
	const approveTxns = await getApproveTxns({
		getToken,
		token: saiToken,
		identityAddr,
		feeTokenAddr: daiAddr,
		approveForAddress: SCD_MCD_MIGRATION_ADDR,
		approveAmount: swapAmount,
	})

	const swapTx = {
		identityContract: identityAddr,
		feeTokenAddr: daiAddr,
		to: SCD_MCD_MIGRATION_ADDR,
		data: ScdMcdMigration.functions.swapSaiToDai.encode([swapAmount]),
	}

	return [...approveTxns, swapTx]
}

// TODO: use byToken where needed
// currently works because only using SAI and DAI only
export async function getIdentityTxnsTotalFees({
	txnsByFeeToken,
	mainToken = {},
}) {
	const feeTokenWhitelist = selectFeeTokenWhitelist()
	const bigZero = bigNumberify('0')
	const feesData = Object.values(txnsByFeeToken)
		.reduce((all, byFeeToken) => all.concat(byFeeToken), [])
		.reduce(
			(result, tx) => {
				const txFeeAmount = bigNumberify(tx.nonIdentityBalanceFeeAmount)
				result.total = result.total.add(txFeeAmount)

				result.byToken[tx.feeTokenAddr] = (
					result.byToken[tx.feeTokenAddr] || bigZero
				).add(txFeeAmount)

				return result
			},
			{ total: bigZero, byToken: {} }
		)

	const byToken = Object.entries(feesData.byToken).map(([key, value]) => {
		const { decimals, symbol } = feeTokenWhitelist[key]
		return {
			address: key,
			fee: formatTokenAmount(value.toString(), decimals),
			symbol,
			feeFormatted: `${formatTokenAmount(
				value.toString(),
				decimals,
				false,
				4
			)} ${symbol}`,
		}
	})

	const fees = {
		// TODO: change to return total as BN and add totalFormatted
		total: formatTokenAmount(
			feesData.total.toString(),
			mainToken.decimals || 18,
			false,
			2
		),
		totalBN: feesData.total,
		byToken,
	}

	return fees
}

export async function processExecuteByFeeTokens({
	txnsByFeeToken,
	wallet,
	provider,
	identityAddr,
	extraData = {},
}) {
	const signer = await getSigner({ wallet, provider })
	const all = Object.values(txnsByFeeToken).map(async txnsRaw => {
		const signatures = await getMultipleTxSignatures({ txns: txnsRaw, signer })
		const data = {
			txnsRaw,
			signatures,
			identityAddr,
			...extraData,
		}

		if (
			process.env.BUILD_TYPE === 'staging' ||
			process.env.NODE_ENV === 'development'
		) {
			console.log('data', JSON.stringify(data, null, 2))
		}

		const result = await executeTx(data)

		return {
			result,
		}
	})

	const results = await Promise.all(all)

	return results
}

export async function withdrawOtherTokensFromIdentity({
	account,
	amountToWithdraw,
	tokenAddress,
	tokenDecimals,
	withdrawTo,
	getFeesOnly,
}) {
	const { mainToken } = selectRelayerConfig()
	const { wallet, identity } = account
	const { authType } = wallet
	const { provider, Identity, getToken } = await getEthers(authType)
	const decimals = parseInt(tokenDecimals, 10)

	const identityAddr = identity.address

	const toWithdraw = parseUnits(amountToWithdraw, decimals)

	const withdrawTx = {
		identityContract: identityAddr,
		feeTokenAddr: mainToken.address,
		to: tokenAddress,
		data: ERC20.functions.transfer.encode([withdrawTo, toWithdraw]),
	}
	const txns = [withdrawTx]

	const txnsByFeeToken = await getIdentityTxnsWithNoncesAndFees({
		txns,
		identityAddr,
		provider,
		Identity,
		account,
		getToken,
	})

	const fees = await getIdentityTxnsTotalFees({ txnsByFeeToken, mainToken })

	if (getFeesOnly) {
		return {
			fees: fees.total,
			toGet: formatTokenAmount(toWithdraw, decimals),
		}
	}

	const result = await processExecuteByFeeTokens({
		identityAddr,
		txnsByFeeToken,
		wallet,
		provider,
	})

	return {
		result,
	}
}
