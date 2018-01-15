import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class Lyrics extends Component {
	static propTypes = {
		file: PropTypes.object
	};

	render() {
		const file = this.props.file;
		const error = typeof file.lyrics === 'undefined'
			? 'Select a song...'
			: file.lyrics === ''
				? 'Nothing here...'
				: false;

		const output = error || file.lyrics;

		return(
			<div className="lyrics">
				{output}
			</div>
		);
	}
}