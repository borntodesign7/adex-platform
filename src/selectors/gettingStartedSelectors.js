import { createSelector } from 'reselect'
import {
	selectAdUnitsArray,
	selectCampaignsArray,
	selectAdSlotsArray,
	selectAccountIdentityDeployData,
	selectAccountStatsFormatted,
	selectPublisherMaxImpressions,
} from 'selectors'

export const selectHasCreatedAdUnit = createSelector(
	[selectAdUnitsArray],
	adUnitsArray => adUnitsArray.length > 0
)

export const selectHasCreatedCampaign = createSelector(
	[selectCampaignsArray],
	campaignsArray => campaignsArray.length > 0
)

export const selectHasConfirmedEmail = createSelector(
	[selectAccountIdentityDeployData],
	({ meta }) => !!meta.emailConfirmed
)

export const selectHasFundedAccount = createSelector(
	[selectAccountStatsFormatted, selectHasCreatedCampaign],
	({ identityBalanceMainToken }, hasCampaign) =>
		hasCampaign || Number(identityBalanceMainToken) > 0
)

export const selectHasCreatedAdSlot = createSelector(
	[selectAdSlotsArray],
	adSlotsArray => adSlotsArray.length > 0
)

export const selectHasAdSlotImpressions = createSelector(
	[selectPublisherMaxImpressions],
	maxImpressions => maxImpressions > 0
)
export const selectHas5000Impressions = createSelector(
	[selectPublisherMaxImpressions],
	maxImpressions => maxImpressions > 5000
)
