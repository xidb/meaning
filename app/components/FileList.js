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

		this.throttle = _.throttle(FileList.throttleCall, 200);

		this.state = {
			page: props.settings.page,
			selectedIndex: props.settings.selectedIndex,
			rows: props.settings.rows
		};

		this.search = props.settings.search;
		this.sorted = props.settings.sorted;

		this.fetchPageArguments = {
			page: this.state.page,
			pageSize: this.state.rows,
			sorted: this.sorted,
			search: this.search
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

    static throttleCall(method) {
		method.call();
	}

	componentDidMount() {
		this.win = remote.getCurrentWindow();

		const home = () => {
			if (this.state.page !== 0) {
				this.setState({page: 0})
			}
		};
		shortcut.register(this.win, 'Home', () => { this.throttle(home) });

		const end = () => {
			if (this.state.page !== this.lastPage) {
				this.setState({page: this.lastPage})
			}
		};
		shortcut.register(this.win, 'End', () => { this.throttle(end) });

		const prevPage = () => {
			if (this.state.page !== 0) {
				this.setState({page: this.state.page - 1})
			}
		};
		shortcut.register(this.win, 'Left', () => { this.throttle(prevPage) });

		const nextPage = () => {
			if (this.canNext) {
				this.setState({page: this.state.page + 1})
			}
		};
		shortcut.register(this.win, 'Right', () => { this.throttle(nextPage) });

		const pageUp = () => {
			if (this.state.page !== 0) {
				this.setState({page: Math.max(this.state.page - 10, 0)})
			}
		};
		shortcut.register(this.win, 'PageUp', () => { this.throttle(pageUp) });

		const pageDown = () => {
			if (this.canNext) {
				this.setState({page: Math.min(this.state.page + 10, this.lastPage)})
			}
		};
		shortcut.register(this.win, 'PageDown', () => { this.throttle(pageDown) });

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
		shortcut.register(this.win, 'Up', () => { this.throttle(up) });

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
		shortcut.register(this.win, 'Down', () => { this.throttle(down) });

		const handleMouseWheel = (event) => {
			if (event.target.tagName === 'TEXTAREA') {
				event.stopPropagation();
				return;
			}

			if (event.deltaY > 0) {
				this.throttle(down);
			} else if (event.deltaY < 0) {
				this.throttle(up);
			}
		};

		window.addEventListener('wheel', handleMouseWheel, true);
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.updateDimensions.bind(this));
		shortcut.unregisterAll(this.win);
	}

	async fetchPage(state) {
		console.time('fetch_to_render');
		const isEvent = state.constructor.name === 'SyntheticEvent';
		let { page, pageSize, sorted } = isEvent ? this.fetchPageArguments : state;

		if (isEvent) {
			this.search = state.target.value;
		}

		const sortChanged = JSON.stringify(this.fetchPageArguments.sorted) !== JSON.stringify(sorted);
		const searchChanged = this.fetchPageArguments.search !== this.search;

		// reset page if sorting or searching started
		if (sortChanged || searchChanged) {
			this.sorted = sorted;
			this.state.page = 0;
			page = 0;
		}

		this.fetchPageArguments = {page, pageSize, sorted, search: this.search};

		await this.props.fetchPage(page, pageSize, sorted, this.search);
	}

	async songSelected(selectedIndex) {
		const settings = {
			page: this.state.page,
			selectedIndex: selectedIndex,
			rows: this.state.rows,
			search: this.search,
			sorted: this.sorted
		};
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

	render() {
		console.timeEnd('fetch_to_render');
		const { canDrop, isOver, connectDropTarget } = this.props;
		const { files } = this.props;
		const pages = this.props.settings.pages;
		const { page, rows } = this.state;
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
						defaultValue={this.search}
						className="filelist__search"
						placeholder="Search"
						onChange={this.fetchPage.bind(this)}
					/>
				</div>
				<ReactTable
                    manual
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
					defaultSorted={this.sorted}
					onPageChange={page => this.setState({page: page})}
					onFetchData={this.fetchPage.bind(this)}
					page={page}
					pages={pages}
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