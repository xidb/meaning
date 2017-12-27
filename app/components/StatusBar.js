import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class StatusBar extends Component {
	static propTypes = {
		status: PropTypes.string
	};

	constructor(props) {
		super(props);
		this.state = {ticks: 0, status: ''};
	}

	tick() {
		this.setState(prevState => ({
			ticks: prevState.ticks + 1,
			status: ''
		}));
	}

	componentDidMount() {
		this.interval = setInterval(() => this.tick(), 100);
	}

	componentWillUnmount() {
		clearInterval(this.interval);
	}

	componentWillReceiveProps(nextProps) {
		this.setState({
			status: nextProps.status
		});
	}

	render() {
		const status = this.state.status;
		const spinner = status.length > 0
			? <span className="spinner" />
			: '';
		return(
			<div className="status-bar">
				{spinner}
				<span className="status-bar-status">{this.state.status}</span>
			</div>
		);
	}
}