import {
	Campaign as CampaignModel,
	AdUnit as AdUnitModel,
	AdSlot as AdSlotModel,
} from 'adex-models'
import initialState from 'store/initialState'

import { createSelector } from 'reselect'

export const selectNewItems = state => state.memory.newItem

export const selectNewItemByType = createSelector(
	[selectNewItems, (_, type) => type],
	(items, type) => items[type]
)

// NOTE: currently used only for existing items update
export const selectNewItemByTypeAndId = createSelector(
	[selectNewItems, (_, type, itemId) => ({ type, itemId })],
	(items, { type, itemId }) =>
		itemId ? items[itemId] || { ...initialState.newItem[type] } : items[type]
)

export const selectNewCampaign = createSelector(
	selectNewItems,
	({ Campaign }) => new CampaignModel(Campaign)
)

export const selectNewAdUnit = createSelector(
	selectNewItems,
	({ AdUnit }) => new AdUnitModel(AdUnit)
)

export const selectNewAdSlot = createSelector(
	selectNewItems,
	({ AdSlot }) => new AdSlotModel(AdSlot)
)
