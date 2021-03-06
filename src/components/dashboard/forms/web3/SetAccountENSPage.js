import React from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { execute, updateNewTransaction } from 'actions'
import { TextField, InputAdornment, Box, Typography } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import { t, selectValidationsById, selectNewTransactionById } from 'selectors'

function SetAccountENSPage({ stepsId, validateId } = {}) {
	const { username } = useSelector(state =>
		selectNewTransactionById(state, stepsId)
	)

	const { username: errUsername, fees: errFees } = useSelector(
		state => selectValidationsById(state, validateId) || {}
	)

	return (
		<div>
			<Box mb={2}>
				<Typography variant='subtitle1' display='block'>
					{t('SET_ENS_MAIN_INFO')}:
				</Typography>
			</Box>
			<Box mb={2}>
				<TextField
					autoFocus
					type='text'
					variant='outlined'
					required
					fullWidth
					label={t('ENS_TO_SET_TO_ADDR')}
					name='username'
					value={username || ''}
					onChange={ev =>
						execute(
							updateNewTransaction({
								tx: stepsId,
								key: 'username',
								value: ev.target.value,
							})
						)
					}
					InputProps={{
						endAdornment: (
							<InputAdornment position='end'>
								{`.${process.env.REVERSE_REGISTRAR_PARENT}`}
							</InputAdornment>
						),
					}}
					error={errUsername && !!errUsername.dirty}
					helperText={
						errUsername && !!errUsername.dirty ? errUsername.errMsg : ''
					}
				/>
			</Box>
			{errFees && errFees.dirty && errFees.errMsg && (
				<Alert variant='outlined' severity='error'>
					{errFees.errMsg}
				</Alert>
			)}
		</div>
	)
}

SetAccountENSPage.propTypes = {
	stepsId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
	validateId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
		.isRequired,
}

export default SetAccountENSPage
