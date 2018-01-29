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
		connectDropTarget: PropTypes.func,
		isOver: PropTypes.bool,
		canDrop: PropTypes.bool,
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
			const searchLowerCase = search.toLowerCase();
			files = files.filter(file => {

				return 	String(file.albumartist).toLowerCase().includes(searchLowerCase)    ||
						String(file.year).includes(searchLowerCase)                         ||
						String(file.album).toLowerCase().includes(searchLowerCase)          ||
						String(file.discnumber).includes(searchLowerCase)                   ||
						String(file.track).includes(searchLowerCase)                        ||
						String(file.title).toLowerCase().includes(searchLowerCase)
			})
		}

		const columns = [
			{
				Header: 'Artist',
				accessor: 'albumartist',
				Cell: props => props.value === props['original'].artist ? props.value : `${props.value} / ${props['original'].artist}`
			},
			{
				Header: 'Year',
				accessor: 'year',
				maxWidth: 50
			},
			{
				Header: 'Album',
				accessor: 'album'
			},
			{
				Header: 'Disc',
				accessor: 'discnumber',
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
			}
		];

		return connectDropTarget(
			<div className="filelist">
				<div className="filelist__buttons">
					<input
						value={search}
						className="filelist__search"
						placeholder="Search"
						onChange={e => this.setState({search: e.target.value})}
					/>
				</div>
				<ReactTable
					getTdProps={(state, rowInfo) => {
						return {
							onClick: () => {
								if (rowInfo && rowInfo['original']) {
									void this.props.songSelected(rowInfo['original']);
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