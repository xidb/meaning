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

export default class FileList extends Component {
	static propTypes = {
		connectDropTarget: PropTypes.func.isRequired,
		isOver: PropTypes.bool.isRequired,
		canDrop: PropTypes.bool.isRequired,
		accepts: PropTypes.arrayOf(PropTypes.string).isRequired,
		onDrop: PropTypes.func,
		files: PropTypes.arrayOf(PropTypes.object),
	};

	static list(files) {
		return files.map(file => (
			<li key={file.name}>
				{`'${file.name}' of size '${file.size}' and type '${file.type}'`}
			</li>
		));
	}

	render() {
		const { canDrop, isOver, connectDropTarget } = this.props;
		const { files } = this.props;

		return connectDropTarget(
			<div className="filelist">{FileList.list(files)}</div>
		);
	}
}