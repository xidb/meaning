import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';
import ReactTable from 'react-table';

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
	constructor() {
		super();
		this.state = {
			rows: 23
		}
	}

	static propTypes = {
		connectDropTarget: PropTypes.func.isRequired,
		isOver: PropTypes.bool.isRequired,
		canDrop: PropTypes.bool.isRequired,
		accepts: PropTypes.arrayOf(PropTypes.string).isRequired,
		onDrop: PropTypes.func,
		files: PropTypes.arrayOf(PropTypes.object),
	};

	componentWillMount() {
		this.updateDimensions();
		window.addEventListener('resize', this.updateDimensions.bind(this));
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.updateDimensions.bind(this));
	}

	updateDimensions() {
		let containerHeight = window.innerHeight * 0.9;
		const filelist = document.querySelector('.filelist');
		if (filelist !== null) {
			containerHeight = filelist.offsetHeight;
		}
		const tableHeight = containerHeight - 85 - 28.5; // pagination and table header height
		const rowHeight = 33.5;
		this.setState({ rows: Math.floor(tableHeight/rowHeight) });
	}

	render() {
		const { canDrop, isOver, connectDropTarget } = this.props;
		const { files } = this.props;
		const { rows } = this.state;

		const columns = [
			{
				Header: 'Artist',
				accessor: 'artist'
			},
			{
				Header: 'Year',
				accessor: 'date',
				maxWidth: 50
			},
			{
				Header: 'Album',
				accessor: 'album'
			},
			{
				Header: 'Disc',
				accessor: 'disc',
				maxWidth: 50
			},
			{
				Header: 'Track',
				accessor: 'track',
				maxWidth: 60
			},
			{
				Header: 'Title',
				accessor: 'title'
			},
		];

		const sort = [
			{id: 'album_artist'}, {id: 'year'}
		];

		return connectDropTarget(
			<div className="filelist">
				<ReactTable
					data={files}
					columns={columns}
					showPageSizeOptions={false}
					pageSize={rows}
					defaultSorted={sort}
					className="-striped -highlight"
				/>
			</div>
		);
	}
}