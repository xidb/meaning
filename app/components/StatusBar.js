import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class StatusBar extends Component {
	static propTypes = {
		message: PropTypes.string
	};

	constructor(props) {
		super(props);
		this.state = {ticks: 0, message: '', spinner: false, clearTick: 0};
	}

	tick() {
		if (this.state.ticks === this.state.clearTick) {
			this.setState({message: ''});
		}
		this.setState(prevState => ({
			ticks: prevState.ticks + 1
		}));
	}

	componentDidMount() {
		this.interval = setInterval(() => this.tick(), 100);
	}

	componentWillUnmount() {
		clearInterval(this.interval);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.message === '') {
			return;
		}
		this.setState({
			message: nextProps.message,
			clearTick: this.state.ticks + 25
		});
		this.props.clearStatusMessage();
	}

	render() {
		const {message} = this.state;

		const spinner = message
			? <span className="status-bar__spinner" />
			: <span className="status-bar__spinner status-bar__spinner--hide" />;

		return(
			<div className="status-bar">
				{spinner}
				<span className="status-bar__status">{message}</span>
			</div>
		);
	}
}