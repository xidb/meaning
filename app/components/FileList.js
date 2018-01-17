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
			rows: 24,
			search: ''
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
		let containerHeight = window.innerHeight - 27; // status bar
		const filelist = document.querySelector('.filelist');
		if (filelist !== null) {
			containerHeight = filelist.offsetHeight;
		}
		const tableHeight = containerHeight - 15 - 24.5 - 85 - 28.5; // padding, search, table header, pagination
		//  height
		const rowHeight = 33.5;
		this.setState({ rows: Math.floor(tableHeight/rowHeight) });
	}

	shouldComponentUpdate(nextProps, nextState) {
		if (this.state !== nextState) {
			return true;
		}

		if (this.props.files.length === nextProps.files.length) {
			return false;
		}

		return true;
	}

	render() {
		const { canDrop, isOver, connectDropTarget } = this.props;
		let { files } = this.props;
		const { rows } = this.state;
		const { search } = this.state;

		if (search !== '') {
			files = files.filter(file => {

				return 	file.album_artist.includes(search)  ||
						file.date.includes(search)          ||
						file.album.includes(search)         ||
						file.disc.includes(search)          ||
						String(file.track).includes(search) ||
						file.title.includes(search)
			})
		}

		const columns = [
			{
				Header: 'Artist',
				accessor: 'album_artist'
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
			{
				Header: 'Lyrics',
				accessor: 'lyrics'
			},
		];

		return connectDropTarget(
			<div className="filelist">
				<input
					className="search"
					placeholder="Search"
					onChange={e => this.setState({search: e.target.value})}
				/>
				<ReactTable
					getTdProps={(state, rowInfo, column, instance) => {
						return {
							onClick: (e, handleOriginal) => {
								if (rowInfo && rowInfo.original) {
									this.props.songSelected(rowInfo.original);
								}
							}
						}
					}}
					data={files}
					columns={columns}
					showPageSizeOptions={false}
					pageSize={rows}
					className="-striped -highlight"
					previousText="&#11207; Previous"
					nextText="Next &#11208;"
					loadingText="Loading..."
					noDataText="Nothing here..."
					pageText=""
					ofText="of"
					rowsText="rows"
				/>
			</div>
		);
	}
}