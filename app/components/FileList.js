import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';
import ReactTable from 'react-table';

import { remote } from 'electron';
import shortcut from 'electron-localshortcut';
import _ from 'lodash';

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
	constructor(props) {
		super(props);

		this.keyThrottle = _.throttle(this.key, 200);

		this.state = {
			page: props.settings.page,
			selectedIndex: props.settings.selectedIndex,
			rows: 24,
			search: '',
		};

		this.lastPage = 9999999;
		this.pageRows = {};
		this.canNext = true;
		this.startRow = 0;
		this.endRow = 9999999;
		this.lastIndex = 9999999;
	}

	static propTypes = {
		connectDropTarget: PropTypes.func,
		isOver: PropTypes.bool,
		canDrop: PropTypes.bool,
		accepts: PropTypes.arrayOf(PropTypes.string).isRequired,
		onDrop: PropTypes.func,
		files: PropTypes.arrayOf(PropTypes.object),
		settings: PropTypes.object
	};

	async componentWillMount() {
		this.updateDimensions();
		window.addEventListener('resize', this.updateDimensions.bind(this));
	}

	key(method) {
		method.call();
	}

	componentDidMount() {
		this.win = remote.getCurrentWindow();

		const home = () => {
			if (this.state.page !== 0) {
				this.setState({page: this.state.page - 1})
			}
		};
		shortcut.register(this.win, 'Home', () => { this.keyThrottle(home) });

		const end = () => {
			if (this.state.page !== this.lastPage) {
				this.setState({page: this.lastPage})
			}
		};
		shortcut.register(this.win, 'End', () => { this.keyThrottle(end) });

		const prevPage = () => {
			if (this.state.page !== 0) {
				this.setState({page: this.state.page - 1})
			}
		};
		shortcut.register(this.win, 'Left', () => { this.keyThrottle(prevPage) });

		const nextPage = () => {
			if (this.canNext) {
				this.setState({page: this.state.page + 1})
			}
		};
		shortcut.register(this.win, 'Right', () => { this.keyThrottle(nextPage) });

		const pageUp = () => {
			if (this.state.page !== 0) {
				this.setState({page: Math.max(this.state.page - 10, 0)})
			}
		};
		shortcut.register(this.win, 'PageUp', () => { this.keyThrottle(pageUp) });

		const pageDown = () => {
			if (this.canNext) {
				this.setState({page: Math.min(this.state.page + 10, this.lastPage)})
			}
		};
		shortcut.register(this.win, 'PageDown', () => { this.keyThrottle(pageDown) });

		const up = () => {
			let toIndex = this.state.selectedIndex - 1;

			if (!(toIndex >= this.startRow - 1 && toIndex <= this.endRow)) {
				toIndex = Math.min(this.endRow - 1, this.lastIndex);
			}

			if (toIndex < 0) {
				return;
			}

			if (toIndex >= this.startRow) {
				this.setState({selectedIndex: toIndex});
			} else {
				this.setState({page: this.state.page - 1, selectedIndex: toIndex});
			}

			void this.songSelected(toIndex);
		};
		shortcut.register(this.win, 'Up', () => { this.keyThrottle(up) });

		const down = () => {
			let toIndex = this.state.selectedIndex + 1;

			if (!(toIndex >= this.startRow && toIndex <= this.endRow)) {
				toIndex = this.startRow;
			}

			if (toIndex > this.lastIndex) {
				return;
			}

			if (toIndex < this.endRow) {
				this.setState({selectedIndex: toIndex});
			} else {
				this.setState({page: this.state.page + 1, selectedIndex: toIndex});
			}

			void this.songSelected(toIndex);
		};
		shortcut.register(this.win, 'Down', () => { this.keyThrottle(down) });

		const handleMouseWheel = (event) => {
			if (event.target.tagName === 'TEXTAREA') {
				event.stopPropagation();
				return;
			}

			if (event.deltaY > 0) {
				this.keyThrottle(down);
			} else if (event.deltaY < 0) {
				this.keyThrottle(up);
			}
		};

		window.addEventListener('wheel', handleMouseWheel, true);
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.updateDimensions.bind(this));
		shortcut.unregisterAll(this.win);
	}

	async songSelected(selectedIndex) {
		const settings = JSON.stringify({page: this.state.page, selectedIndex: selectedIndex});
		void this.props.songSelected(_.find(this.pageRows, {_index: selectedIndex})['_original'], settings);
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
			});
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
						onChange={e => this.setState({search: e.target.value, page: 0})}
					/>
				</div>
				<ReactTable
					data={files}
					columns={columns}
					getProps={(props) => {
						this.lastPage = props.pages - 1;
						this.pageRows = props.pageRows;
						this.canNext = props.canNext;
						this.startRow = props.startRow;
						this.endRow = props.endRow;
						this.lastIndex = props['resolvedData'].length - 1;
						return {};
					}}
					getTrProps={(state, rowInfo) => {
						let classes = [];
						if (rowInfo) {
							if (rowInfo['original']['lyrics'] !== null) {
								classes.push('rt-tr--has-lyrics');
							}
							if (rowInfo['index'] === this.state.selectedIndex) {
								classes.push('rt-tr--selected');
							}
						}

						return {
							className: classes,
							onClick: () => {
								if (rowInfo) {
									void this.songSelected(rowInfo['index']);
									if (rowInfo['index']) {
										this.setState({selectedIndex: rowInfo['index']});
									}
								}
							}
						}
					}}
					onPageChange={page => this.setState({page: page})}
					page={this.state.page}
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