import React, { Component } from 'react';
import { DragDropContext, DragDropContextProvider } from 'react-dnd';
import HTML5Backend, { NativeTypes } from 'react-dnd-html5-backend';

import _ from 'lodash/core';
import fs from 'fs';
import db from 'sqlite-crud';
import { requireTaskPool } from 'electron-remote';
import Task from './Task';

const TaskPool = requireTaskPool(require.resolve('./Task'));

import Target from './Target';
import FileList from './FileList';
import StatusBar from './StatusBar';
import Lyrics from './Lyrics';

@DragDropContext(HTML5Backend)
export default class Container extends Component {
	constructor(props) {
		super(props);

		this.handleFileDrop = this.handleFileDrop.bind(this);

		this.state = {files: [], status: '', selected: {}};
		this.fetchFromDb();
	}

	async fetchFromDb() {
		await db.connectToDB('app/db.sqlite');

		// await db.run('DELETE FROM song');

		const songs = await db.queryRows('SELECT * FROM song');

		if (songs.length > 0) {
			this.setFiles(songs);
		}
	}

	async handleFileDrop(item, monitor) {
		if (!monitor) {
			return;
		}

		let dropped = _.sortBy(monitor.getItem().files, 'path');

		const files = dropped.filter(item => {
			return fs.lstatSync(item.path).isFile();
		});

		if (files.length > 0) {
			await this.processFiles(files);
		}

		const dirs = dropped.filter(item => {
			return fs.lstatSync(item.path).isDirectory();
		});

		if (dirs.length > 0) {
			const paths = _.map(dirs, 'path');

			const subdirsChunked = await TaskPool.getSubdirsChunked(paths, 3);

			for (let chunk of subdirsChunked) {
				const filePathArrays = await TaskPool.parseDirs(chunk);
				let files = [];

				filePathArrays.map(array => {
					files.push(...array);
				});

				await this.processFiles(files, subdirsChunked.length);
			}
		}
	}

	async processFiles(files, timeout) {
		const filtered = this.filterAudio(files);

		this.setStatus(filtered);

		if (filtered.length < 20) {
			this.setFiles(_.sortBy(await Task.getMetadata(filtered), 'path'));
		} else {
			this.setFiles(_.sortBy(await TaskPool.getMetadata(filtered, timeout), 'path'));
		}
	}

	filterAudio(files) {
		return files.filter(file => {
			const isAudio = file.type.match(/audio\/.*/i);
			let notExists = true;

			for (let existingFile of this.state.files) {
				if (existingFile.path === file.path) {
					notExists = false;
					break;
				}
			}
			return isAudio && notExists;
		});
	}

	setFiles(files) {
		this.setState({files: [...this.state.files, ...files]});
	}

	setStatus(input) {
		let inputString = '';
		if (typeof input === 'object') {
			for (let file of input) {
				inputString += `${file.name}; `;
			}
		} else {
			inputString = input;
		}

		this.setState({status: inputString});
	}

	songSelected(file) {
		this.setState({selected: file});
	}

	render() {
		const {FILE} = NativeTypes;
		const {files} = this.state;

		let target;
		let fileList;
		let lyrics;
		let containerClass;
		if (files.length === 0) {
			target = <Target accepts={[FILE]} onDrop={this.handleFileDrop} />;
			containerClass = 'container container--target';
		} else {
			fileList = <FileList
				accepts={[FILE]}
				onDrop={this.handleFileDrop}
				files={files}
				songSelected={this.songSelected.bind(this)}
			/>;
			lyrics = <Lyrics file={this.state.selected} />;
			containerClass = 'container container--filelist';
		}

		return(
			<DragDropContextProvider backend={HTML5Backend}>
				<div className={containerClass}>
					{target}{fileList}{lyrics}
					<StatusBar status={this.state.status} />
				</div>
			</DragDropContextProvider>
		);
	}
}