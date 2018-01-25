import React, { Component } from 'react';
import PropTypes from 'prop-types';

import Spinner from './StatusBarSpinner';

export default class StatusBar extends Component {
	static propTypes = {
		message: PropTypes.string,
		spinner: PropTypes.bool
	};

	constructor(props) {
		super(props);
		this.state = {message: '', timeout: null};
	}

	componentWillReceiveProps(nextProps) {
		if (!nextProps.spinner) {
			return;
		}

		clearTimeout(this.state.timeout);
		this.setState({
			message: nextProps.message,
			timeout: setTimeout(() => this.setState({message: ''}), 1500),
		});
	}

	shouldComponentUpdate(nextProps) {
		return nextProps.message !== this.state.message || nextProps.spinner !== this.props.spinner;
	}

	render() {
		return(
			<div className="status-bar">
				<Spinner spin={this.props.spinner} />
				<span className="status-bar__status">{this.state.message}</span>
			</div>
		);
	}
}