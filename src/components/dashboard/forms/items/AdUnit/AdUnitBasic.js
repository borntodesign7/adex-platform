import React, { Component } from 'react'
import PropTypes from 'prop-types'
import NewAdUnitHoc from './NewAdUnitHoc'
import Translate from 'components/translate/Translate'
import Grid from '@material-ui/core/Grid'
import TextField from '@material-ui/core/TextField'
import Dropdown from 'components/common/dropdown'
import { validName } from 'helpers/validators'
import { validUrl } from 'helpers/validators'
import { constants } from 'adex-models'

const AdTypes = constants.AdUnitsTypes
	.map(type => {
		return {
			value: type,
			label: type.split('_')[1]
		}
	})

class AdUnitBasic extends Component {

	componentDidMount() {
		const { newItem } = this.props
		this.validateName(newItem.title, false)
		this.validateTargetUrl(newItem.targetUrl, false)
	}

	validateName(name, dirty, errMsg) {
		const { msg, errMsgArgs } = validName(name)

		this.props.validate(
			'title',
			{
				isValid: !msg,
				err: { msg: errMsg || msg, args: errMsgArgs },
				dirty: dirty
			})
	}

	validateTargetUrl(targetUrl, dirty) {
		this.props.validate('targetUrl',
			{
				isValid: validUrl(targetUrl),
				err: { msg: 'ERR_INVALID_URL' },
				dirty: dirty
			})
	}

	validateAndUpdateDD = (dirty, propsName, value) => {
		let isValid = !!value
		let msg = 'ERR_REQUIRED_FIELD'

		this.props.handleChange(propsName, value)
		this.props.validate(propsName,
			{
				isValid: isValid,
				err: { msg: msg },
				dirty: dirty
			})
	}

	render() {
		const {
			t,
			newItem,
			invalidFields,
			handleChange,
			nameHelperTxt,
			descriptionHelperTxt
		} = this.props
		const { targetUrl, type, title, description } = newItem
		const errTitle = invalidFields['title']
		const errTargetUrl = invalidFields['targetUrl']

		return (
			<div>
				<Grid
					container
					spacing={16}
				>
					<Grid item sm={12}>
						<TextField
							fullWidth
							type='text'
							required
							label={'Ad Unit ' + t('title', { isProp: true })}
							name='name'
							value={title}
							onChange={(ev) =>
								handleChange('title', ev.target.value)}
							onBlur={() => this.validateName(title, true)}
							onFocus={() => this.validateName(title, false)}
							error={errTitle && !!errTitle.dirty}
							maxLength={128}
							helperText={
								(errTitle && !!errTitle.dirty)
									? errTitle.errMsg
									: (nameHelperTxt || '')
							}
						/>
					</Grid>
					<Grid item sm={12}>
						<TextField
							fullWidth
							type='text'
							multiline
							rows={3}
							label={t('description', { isProp: true })}
							value={description}
							onChange={(ev) =>
								handleChange('description', ev.target.value)}
							maxLength={1024}
							helperText={descriptionHelperTxt || ''}
						/>
					</Grid>
					<Grid item xs={12}>
						<TextField
							fullWidth
							type='text'
							required
							label={t('targetUrl', { isProp: true })}
							value={targetUrl}
							onChange={(ev) =>
								handleChange('targetUrl', ev.target.value)
							}
							maxLength={1024}
							onBlur={() => this.validateTargetUrl(targetUrl, true)}
							onFocus={() => this.validateTargetUrl(targetUrl, false)}
							error={errTargetUrl && !!errTargetUrl.dirty}
							helperText={
								(errTargetUrl && !!errTargetUrl.dirty)
									? errTargetUrl.errMsg
									: ''
							}
						/>
					</Grid>
					<Grid item sm={12} md={12}>
						<Dropdown
							fullWidth
							required
							onChange={this.validateAndUpdateDD
								.bind(this, true, 'type')}
							source={AdTypes}
							value={type + ''}
							label={t('adType', { isProp: true })}
							htmlId='ad-type-dd'
							name='adType'
						/>
					</Grid>
				</Grid>
			</div>
		)
	}
}

AdUnitBasic.propTypes = {
	newItem: PropTypes.object.isRequired,
	title: PropTypes.string,
	descriptionHelperTxt: PropTypes.string,
	nameHelperTxt: PropTypes.string,
}

const NewAdUnitBasic = NewAdUnitHoc(AdUnitBasic)

export default Translate(NewAdUnitBasic)
