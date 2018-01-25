import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class Spinner extends Component {
	static propTypes = {
		spin: PropTypes.bool
	};

	shouldComponentUpdate(nextProps) {
		return this.props.spin !== nextProps.spin;
	}

	render() {
		return this.props.spin
			? <span className="status-bar__spinner" />
			: <span className="status-bar__spinner status-bar__spinner--hide" />;
	}
}