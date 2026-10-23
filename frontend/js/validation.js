(function (global) {
	'use strict';

	let generatedId = 0;
	const medicalSpecialties = new Set([
		'general',
		'general medicine',
		'cardiology',
		'dermatology',
		'endocrinology',
		'gastroenterology',
		'general surgery',
		'gynecology & obstetrics',
		'nephrology',
		'neurology',
		'neurosurgery',
		'oncology',
		'ophthalmology',
		'orthopaedics',
		'ent',
		'pediatrics',
		'psychiatry',
		'pulmonology',
		'radiology',
		'urology',
		'emergency medicine',
		'anesthesiology',
		'pathology'
	]);

	function getFieldContainer(field) {
		return field.closest('.form-group, .field') || field.parentElement;
	}

	function findErrorElement(container, fieldId) {
		return Array.from(container.querySelectorAll('[data-validation-error-for]'))
			.find(error => error.dataset.validationErrorFor === fieldId) || null;
	}

	function getErrorElement(field, container) {
		let error = findErrorElement(container, field.id);

		if (!error) {
			error = document.createElement('div');
			error.className = 'form-error';
			error.dataset.validationErrorFor = field.id;
			error.id = field.id + '-validation-error';
			error.setAttribute('role', 'alert');
			container.appendChild(error);
		}

		return error;
	}

	function updateDescribedBy(field, errorId, addError) {
		const ids = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
		const filteredIds = ids.filter(id => id !== errorId);

		if (addError) filteredIds.push(errorId);
		if (filteredIds.length) {
			field.setAttribute('aria-describedby', filteredIds.join(' '));
		} else {
			field.removeAttribute('aria-describedby');
		}
	}

	function getMessage(field) {
		const value = field.value.trim();

		if (field.required && !value) return 'This field is required.';
		if (field.validity.valueMissing) return 'This field is required.';
		if (!value) return '';

		if (field.type === 'tel') {
			const digits = value.replace(/\D/g, '');
			if (!/^[+\d\s().-]+$/.test(value) || !/^(?:[6-9]\d{9}|91[6-9]\d{9})$/.test(digits)) {
				return 'Enter a valid 10-digit Indian mobile number.';
			}
		}

		if (field.dataset.validate === 'person-name' && !/^\p{L}[\p{L}\p{M}\s.'’-]*$/u.test(value)) {
			return 'Enter a name using letters, spaces, apostrophes, or hyphens.';
		}

		if (field.dataset.validate === 'medical-specialty' && !medicalSpecialties.has(value.toLowerCase())) {
			return 'Choose a listed medical specialty.';
		}

		if (field.dataset.validate === 'contact-email') {
			const localPart = value.slice(0, value.lastIndexOf('@'));
			if (!/\p{L}/u.test(localPart)) return 'Email must include a letter before @.';
		}

		if (field.type === 'date' || (field.dataset && field.dataset.validate && field.dataset.validate.startsWith('date-'))) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
				return 'Enter a valid date in YYYY-MM-DD format.';
			}

			const parts = value.split('-');
			const year = parseInt(parts[0], 10);
			const month = parseInt(parts[1], 10);
			const day = parseInt(parts[2], 10);

			if (month < 1 || month > 12 || day < 1 || day > 31) {
				return 'Enter a valid calendar date.';
			}

			const selectedDate = new Date(year, month - 1, day);
			if (isNaN(selectedDate.getTime()) || selectedDate.getFullYear() !== year || selectedDate.getMonth() !== month - 1 || selectedDate.getDate() !== day) {
				return 'Enter a valid calendar date.';
			}

			if (year < 1900 || year > 2100) {
				return 'Enter a year between 1900 and 2100.';
			}

			const today = new Date();
			today.setHours(0, 0, 0, 0);

			if (field.min && value < field.min) {
				return 'Date cannot be earlier than ' + field.min + '.';
			}
			if (field.max && value > field.max) {
				return 'Date cannot be later than ' + field.max + '.';
			}

			const validateType = (field.dataset && field.dataset.validate) || '';

			if (validateType === 'date-not-future' || validateType === 'dob' || field.id === 'dob' || field.name === 'dob') {
				if (selectedDate > today) {
					return 'Date of birth cannot be in the future.';
				}
				const minDobYear = today.getFullYear() - 130;
				if (year < minDobYear) {
					return 'Enter a realistic date of birth (within the last 130 years).';
				}
			}

			if (validateType === 'date-not-past' || validateType === 'appointment-date' || field.id === 'apptDate' || field.name === 'apptDate') {
				if (selectedDate < today) {
					return 'Appointment date cannot be in the past.';
				}
				const maxAppt = new Date(today);
				maxAppt.setFullYear(today.getFullYear() + 1);
				if (selectedDate > maxAppt) {
					return 'Appointment date cannot be more than 1 year in advance.';
				}
			}

			if (validateType === 'date-future') {
				if (selectedDate < today) {
					return 'Date must be in the future.';
				}
			}
		}

		if (field.type === 'time') {
			if (!/^\d{1,2}:\d{2}$/.test(value)) {
				return 'Enter a valid time in HH:MM format.';
			}
			const timeParts = value.split(':');
			const hours = parseInt(timeParts[0], 10);
			const minutes = parseInt(timeParts[1], 10);
			if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
				return 'Enter a valid time.';
			}
		}

		const validity = field.validity;
		if (validity.typeMismatch) {
			return field.type === 'email' ? 'Enter a valid email address.' : 'Enter a valid value.';
		}
		if (validity.tooShort) return 'This value is too short.';
		if (validity.tooLong) return 'This value is too long.';
		if (validity.rangeUnderflow) return 'Value is below the allowed minimum.';
		if (validity.rangeOverflow) return 'Value is above the allowed maximum.';
		if (validity.stepMismatch || validity.badInput) return 'Enter a valid value.';
		if (validity.patternMismatch) return field.title || 'Use the requested format.';
		if (validity.customError) return field.validationMessage || 'Enter a valid value.';

		return '';
	}

	function clearField(field) {
		if (!field || !field.id) return;

		const container = getFieldContainer(field);
		const error = findErrorElement(container, field.id);
		const errorId = field.id + '-validation-error';

		field.classList.remove('is-invalid', 'is-valid');
		field.removeAttribute('aria-invalid');
		updateDescribedBy(field, errorId, false);
		if (error) error.remove();
		if (!container.querySelector('.is-invalid')) container.classList.remove('is-invalid');
		if (!container.querySelector('.is-valid')) container.classList.remove('is-valid');
	}

	function validateField(field) {
		if (!field || field.disabled || field.type === 'button' || field.type === 'submit' || field.type === 'reset') {
			return true;
		}

		if (!field.id) {
			generatedId += 1;
			field.id = 'validation-field-' + generatedId;
		}

		const container = getFieldContainer(field);
		const message = getMessage(field);
		const errorId = field.id + '-validation-error';

		field.classList.remove('is-invalid', 'is-valid');
		container.classList.remove('is-invalid', 'is-valid');

		if (message) {
			const error = getErrorElement(field, container);
			error.textContent = message;
			field.classList.add('is-invalid');
			container.classList.add('is-invalid');
			field.setAttribute('aria-invalid', 'true');
			updateDescribedBy(field, errorId, true);
			return false;
		}

		const error = findErrorElement(container, field.id);
		if (error) error.remove();
		field.removeAttribute('aria-invalid');
		updateDescribedBy(field, errorId, false);

		if (field.value.trim()) {
			field.classList.add('is-valid');
			container.classList.add('is-valid');
		}

		return true;
	}

	function validateForm(form, options) {
		if (!(form instanceof HTMLFormElement)) return false;

		const settings = Object.assign({ focusFirstInvalid: true }, options);
		const fields = Array.from(form.querySelectorAll('input, select, textarea'));
		let firstInvalid = null;

		fields.forEach(field => {
			if (!validateField(field) && !firstInvalid) firstInvalid = field;
		});

		if (firstInvalid && settings.focusFirstInvalid) firstInvalid.focus();
		return firstInvalid === null;
	}

	function clearForm(form) {
		if (!(form instanceof HTMLFormElement)) return;
		form.querySelectorAll('input, select, textarea').forEach(clearField);
	}

	function prepareForm(form) {
		form.noValidate = true;
	}

	function prepareForms(root) {
		if (root.matches && root.matches('form')) prepareForm(root);
		if (root.querySelectorAll) root.querySelectorAll('form').forEach(prepareForm);
	}

	document.addEventListener('submit', event => {
		const form = event.target;
		if (!(form instanceof HTMLFormElement)) return;

		prepareForm(form);
		if (!validateForm(form)) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	}, true);

	document.addEventListener('input', event => {
		const field = event.target;
		if (field.matches && field.matches('input, select, textarea') && field.classList.contains('is-invalid')) {
			validateField(field);
		}
	}, true);

	document.addEventListener('change', event => {
		const field = event.target;
		if (field.matches && field.matches('input, select, textarea') && field.classList.contains('is-invalid')) {
			validateField(field);
		}
	}, true);

	document.addEventListener('reset', event => {
		const form = event.target;
		if (form instanceof HTMLFormElement) {
			global.setTimeout(() => clearForm(form), 0);
		}
	}, true);

	prepareForms(document);

	if (global.MutationObserver && document.documentElement) {
		const observer = new MutationObserver(records => {
			records.forEach(record => record.addedNodes.forEach(prepareForms));
		});
		observer.observe(document.documentElement, { childList: true, subtree: true });
	}

	global.CMSValidation = {
		validateField,
		validateForm,
		clearField,
		clearForm
	};
})(window);
