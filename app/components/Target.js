import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';

const boxTarget = {
	drop(props, monitor) {
		if (props.onDrop) {
			props.onDrop(props, monitor);
		}
	},
};

@DropTarget(props => props.accepts, boxTarget, (connect, monitor) => ({
	connectDropTarget: connect.dropTarget(),
	isOver: monitor.isOver(),
	canDrop: monitor.canDrop(),
}))

export default class Target extends Component {
	static propTypes = {
		connectDropTarget: PropTypes.func,
		isOver: PropTypes.bool,
		canDrop: PropTypes.bool,
		accepts: PropTypes.arrayOf(PropTypes.string).isRequired,
		onDrop: PropTypes.func,
	};

	render() {
		const { canDrop, isOver, connectDropTarget } = this.props;
		const isActive = canDrop && isOver;
		let containerClass = 'target';
		if (isActive) {
			containerClass += ' dragover';
		}

		return connectDropTarget(
			<div className={containerClass}>
				{isActive ? 'Release to drop' : 'Drag your music here'}
			</div>
		);
	}
}