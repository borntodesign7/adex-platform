import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import actions from 'actions'
// import Translate from 'components/translate/Translate'
import NewTransactionHoc from './TransactionHoc'
import TextField from '@material-ui/core/TextField'
import { InputLoading } from 'components/common/spinners/'
import InputAdornment from '@material-ui/core/InputAdornment'

class SetAccountENSPage extends Component {
	componentDidMount() {
		const { transaction, validate } = this.props
		if (!transaction.withdrawAmount) {
			validate('setEns', {
				isValid: false,
				err: { msg: 'ERR_REQUIRED_FIELD' },
				dirty: false,
			})
		}
	}

	render() {
		const {
			actions,
			transaction,
			t,
			invalidFields,
			handleChange,
			setEnsSpinner,
			validate,
		} = this.props
		const { setEns } = transaction || {}
		// const errAmount = invalidFields['withdrawAmount']
		const errAddr = invalidFields['setEns']

		return (
			<div>
				<div> {t('SET_ENS_MAIN_INFO')}</div>
				<form noValidate>
					<TextField
						type='text'
						required
						fullWidth
						label={t('ENS_TO_SET_TO_ADDR')}
						name='setEns'
						value={setEns || ''}
						onChange={ev => handleChange('setEns', ev.target.value)}
						InputProps={{
							endAdornment: (
								<InputAdornment position='end'>
									{`.${process.env.REVERSE_REGISTRAR_PARENT}`}
								</InputAdornment>
							),
						}}
						onBlur={() =>
							actions.validateENS({
								ens: setEns,
								dirty: true,
								validate,
								name: 'setEns',
							})
						}
						onFocus={() =>
							actions.validateENS({
								ens: setEns,
								dirty: false,
								validate,
								name: 'setEns',
							})
						}
						error={errAddr && !!errAddr.dirty}
						helperText={errAddr && !!errAddr.dirty ? errAddr.errMsg : ''}
					/>
					{setEnsSpinner ? <InputLoading /> : null}
				</form>
			</div>
		)
	}
}

SetAccountENSPage.propTypes = {
	actions: PropTypes.object.isRequired,
	label: PropTypes.string,
	txId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
	stepsId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
	transaction: PropTypes.object.isRequired,
	account: PropTypes.object.isRequired,
}

function mapStateToProps(state, props) {
	// const persist = state.persist
	const memory = state.memory
	const txId = props.stepsId
	return {
		txId: txId,
		setEnsSpinner: memory.spinners['setEns'],
	}
}

function mapDispatchToProps(dispatch) {
	return {
		actions: bindActionCreators(actions, dispatch),
	}
}

const SetAccountENSPageForm = NewTransactionHoc(SetAccountENSPage)
export default connect(
	mapStateToProps,
	mapDispatchToProps
)(SetAccountENSPageForm)
