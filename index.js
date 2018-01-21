'use strict';

const {promisify} = require('util');
const {resolve} = require('path');

const assertValidGlobOpts = require('assert-valid-glob-opts');
const {chmod, readdir, rmdir, unlink} = require('graceful-fs');
const {hasMagic} = require('glob');
const inspectWithKind = require('inspect-with-kind');
const rimraf = require('rimraf');

const RIMRAF_DOC_URL = 'https://github.com/isaacs/rimraf#options';
const SUPPORTED_FS_METHODS = [
	'unlink',
	'chmod',
	'stat',
	'lstat',
	'rmdir',
	'readdir'
];
const defaultGlobOptions = {
	nosort: true,
	silent: true
};
const promisifiedRimraf = promisify(rimraf);

module.exports = async function rmfr(...args) {
	const argLen = args.length;

	if (argLen !== 1 && argLen !== 2) {
		throw new RangeError(`Expected 1 or 2 arguments (<string>[, <Object>]), but got ${
			argLen === 0 ? 'no' : argLen
		} arguments.`);
	}

	const defaultOptions = {
		glob: false,
		chmod,
		readdir,
		rmdir,
		unlink
	};

	if (argLen === 1) {
		return promisifiedRimraf(args[0], defaultOptions);
	}

	const [path] = args;

	if (typeof args[1] !== 'object') {
		throw new TypeError(`Expected an option object passed to rimraf (${RIMRAF_DOC_URL}), but got ${
			inspectWithKind(args[1])
		}.`);
	}

	const options = Object.assign(defaultOptions, args[1]);
	const errors = [];

	for (const method of SUPPORTED_FS_METHODS) {
		if (options[method] !== undefined && typeof options[method] !== 'function') {
			errors.push(`\`${method}\` option must be a function, but got ${
				inspectWithKind(options[method])
			}.`);
		}
	}

	if (options.maxBusyTries !== undefined && typeof options.maxBusyTries !== 'number') {
		errors.push(`\`maxBusyTries\` option must be a number, but got ${
			inspectWithKind(options.maxBusyTries)
		}.`);
	}

	if (options.emfileWait !== undefined && typeof options.emfileWait !== 'number') {
		errors.push(`\`emfileWait\` option must be a number, but got ${
			inspectWithKind(options.emfileWait)
		}.`);
	}

	if (options.disableGlob !== undefined && typeof options.disableGlob !== 'boolean') {
		errors.push(`\`disableGlob\` option must be a boolean, but got ${
			inspectWithKind(options.disableGlob)
		}.`);
	}

	if (options.glob === true) {
		options.glob = defaultGlobOptions;
	} else if (typeof options.glob === 'object') {
		assertValidGlobOpts(options.glob);
		const hasCwdOption = options.glob.cwd !== undefined;

		options.glob = Object.assign({
			nosort: true,
			silent: true
		}, options.glob, {
			// Remove this line when isaacs/rimraf#133 is merged
			absolute: hasCwdOption
		});

		if (errors.length === 0 && hasCwdOption && !hasMagic(path, options.glob)) {
			// Bypass https://github.com/isaacs/rimraf/blob/v2.6.2/rimraf.js#L62
			return promisifiedRimraf(resolve(options.glob.cwd, path), Object.assign(options, {
				disableGlob: true
			}));
		}
	} else if (options.glob !== false) {
		errors.push(`\`glob\` option must be an object passed to \`glob\` or a Boolean value, but got ${
			inspectWithKind(options.glob)
		}.`);
	}

	if (errors.length === 1) {
		throw new TypeError(`${errors[0]} ${RIMRAF_DOC_URL}`);
	}

	if (errors.length !== 0) {
		throw new TypeError(`There was ${errors.length} errors in rimraf options you provided:
${errors.map(error => `  * ${error}`).join('\n')}
Read ${RIMRAF_DOC_URL} for the details.`);
	}

	return promisifiedRimraf(path, options);
};
