import React, { useEffect, Fragment, useState } from 'react'
import PropTypes from 'prop-types'
import { FormHelperText, TextField, Box } from '@material-ui/core'
import AutocompleteMUI, {
	createFilterOptions,
} from '@material-ui/lab/Autocomplete'
import { CheckSharp, ErrorSharp } from '@material-ui/icons'

const StatusIcon = {
	success: <CheckSharp color='secondary' />,
	error: <ErrorSharp color='error' />,
}

function Autocomplete({
	source,
	multiple,
	label,
	variant,
	error,
	errorText,
	onInit,
	value,
	onChange,
	fullWidth,
	enableCreate,
}) {
	useEffect(() => {
		typeof onInit === 'function' && onInit()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const handleChange = item => {
		const selectedItem = item ? item.value || item.label : item
		onChange(selectedItem)
	}

	return (
		<Fragment>
			<AutocompleteMUI
				multiple={multiple}
				options={source}
				value={value || null}
				getOptionLabel={option => option.label || option}
				getOptionSelected={(a, b = '') => {
					return [JSON.stringify(b), b, b.value].includes(a.value)
				}}
				onChange={(_, newValue) => handleChange(newValue)}
				renderInput={params => {
					return (
						<TextField
							{...params}
							label={label}
							variant={variant}
							fullWidth={fullWidth}
							error={error}
						/>
					)
				}}
			/>
			{error && (
				<FormHelperText error id='component-error-text'>
					{errorText}
				</FormHelperText>
			)}
		</Fragment>
	)
}

const filter = createFilterOptions()

export const AutocompleteWithCreate = ({
	source,
	label,
	variant,
	error,
	helperText,
	fullWidth,
	initialValue,
	onChange,
	changeOnInputUpdate,
}) => {
	const [value, setValue] = useState(null)

	useEffect(() => {
		setValue({ label: initialValue, value: initialValue })
	}, [initialValue])

	return (
		<AutocompleteMUI
			value={value}
			onChange={(event, newValue) => {
				// Create a new value from the user input
				if (newValue && (newValue.inputValue || newValue.value)) {
					const value = newValue.inputValue || newValue.value
					setValue({
						label: newValue.label || value,
						value,
					})
					onChange(value)
				} else {
					setValue(newValue)
					onChange('')
				}
			}}
			onInputChange={(ev, value) => {
				if (changeOnInputUpdate) {
					onChange(value)
				}
			}}
			filterOptions={(options, params) => {
				const filtered = filter(options, params)

				// Suggest the creation of a new value
				if (!changeOnInputUpdate && params.inputValue !== '') {
					filtered.push({
						inputValue: params.inputValue,
						label: `Add "${params.inputValue}"`,
					})
				}

				return filtered
			}}
			selectOnFocus
			// clearOnBlur
			// handleHomeEndKeys
			options={source}
			getOptionLabel={option => {
				// Value selected with enter, right from the input
				if (typeof option === 'string') {
					return option
				}
				// Add "xxx" option created dynamically
				if (option.inputValue) {
					return option.inputValue
				}
				// Regular option
				return option.label
			}}
			renderOption={option =>
				option.status ? (
					<Box
						display='flex'
						justifyContent='space-between'
						flexDirection='row'
						alignItems='center'
						width={1}
					>
						{option.label}

						{StatusIcon[option.status] || option.status}
					</Box>
				) : (
					option.label
				)
			}
			freeSolo={!changeOnInputUpdate}
			renderInput={params => (
				<TextField
					{...params}
					error={error}
					fullWidth={fullWidth}
					label={label}
					helperText={helperText}
					variant={variant}
				/>
			)}
		/>
	)
}

Autocomplete.propTypes = {
	source: PropTypes.array.isRequired,
	label: PropTypes.string.isRequired,
	onChange: PropTypes.func.isRequired,
	multiple: PropTypes.bool,
	variant: PropTypes.string,
}

export default Autocomplete
