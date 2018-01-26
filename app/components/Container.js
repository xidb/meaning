import React, { Component } from 'react';
import { DragDropContext, DragDropContextProvider } from 'react-dnd';
import HTML5Backend, { NativeTypes } from 'react-dnd-html5-backend';

import _ from 'lodash/core';
import fs from 'fs';
import os from 'os';
import db from 'sqlite-crud';
import events from 'events';
events.EventEmitter.defaultMaxListeners = 20;

import { requireTaskPool } from 'electron-remote';
import Task from './Task';
// Set number of max processes according to cpu cores, but reserve one for main and for renderer
const TaskPool = requireTaskPool(require.resolve('./Task'), Math.min(2, os.cpus().length - 2));
const TaskDb = requireTaskPool(require.resolve('./TaskDb'), 1);

import Target from './Target';
import FileList from './FileList';
import StatusBar from './StatusBar';
import Lyrics from './Lyrics';

@DragDropContext(HTML5Backend)
export default class Container extends Component {
	constructor(props) {
		super(props);

		this.handleFileDrop = this.handleFileDrop.bind(this);

		this.state = {files: [], statusMessage: '', statusSpinner: false, selected: {}};
		void this.fetchFromDb();
	}

	async fetchFromDb() {
		await db.connectToDB('app/db.sqlite');

		// await db.run('DELETE FROM song');

		console.time('db_init_first');
		const firstPage = await db.queryRows(
			'SELECT * FROM song ORDER by albumartist, year, album, discnumber, track LIMIT 100'
		);
		console.timeEnd('db_init_first');

		if (firstPage.length > 0) {
			this.setFiles(firstPage);
		}

		if (firstPage.length < 100) {
			return;
		}

		console.time('db_init_full');
		const songs = await db.queryRows(
			'SELECT * FROM song ORDER by albumartist, year, album, discnumber, track LIMIT -1 OFFSET 100'
		);
		console.timeEnd('db_init_full');

		if (songs.length > 0) {
			this.setFiles(songs);
		}
	}

	async handleFileDrop(item, monitor) {
		if (!monitor) {
			return;
		}

		this.dbInsertCounter = this.state.files.length;

		this.setState({statusSpinner: true});

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

			const subdirsChunked = await TaskPool.getSubdirsChunked(paths, 5);

			for (let chunk of subdirsChunked) {
				const filePathArrays = await TaskPool.parseDirs(chunk);
				let files = [];

				filePathArrays.map(array => {
					files.push(...array);
				});

				void this.processFiles(files);
			}
		}
	}

	async processFiles(files) {
		const audio = this.filterAudio(files);
		if (audio.length === 0) {
			this.setState({statusSpinner: false});
			return;
		}
		this.setStatusMessage(audio);

		if (audio.length < 20) {
			this.setFiles(_.sortBy(await Task.getMetadata(audio), 'path'), true);
		} else {
			this.setFiles(_.sortBy(await TaskPool.getMetadata(audio), 'path'), true);
		}
	}

	filterAudio(files) {
		const fileFormats = [
			'mp3', 'm4a', 'ogg', 'wma', 'm4b', 'm4p', 'mp4', '3g2',
			'wav', 'flac', 'ape', 'mpc', 'wv', 'opus', 'tta'
		];

		return files.filter(file => {
			const formatSupported = fileFormats.includes(file.name.split('.').pop());
			if (!formatSupported) {
				return false;
			}

			let exists = false;

			for (let existingFile of this.state.files) {
				if (existingFile.path === file.path) {
					exists = true;
					break;
				}
			}

			return !exists;
		});
	}

	setFiles(files, toDb = false) {
		files = files.filter(file => {
			if (file.error !== void 0) {
				this.setStatusMessage(file.error);
			}

			return file.error === void 0;
		});

		if (files.length > 0) {
			this.setState({files: [...this.state.files, ...files]});
		}

		if (toDb === false) {
			return;
		}

		files.map(file => {
			TaskDb.insert(file).then(() => {
				this.dbInsertCounter++;

				const filesLeft = this.state.files.length - this.dbInsertCounter;
				if (filesLeft % 10 === 0) {
					const filesMessage = filesLeft !== 0 ? `${filesLeft} files to go` : 'Completed!';
					this.setStatusMessage(`Updating library... ${filesMessage} | ${file.albumartist} - ${file.album}`);
				}

				if (this.dbInsertCounter === this.state.files.length) {
					this.setState({statusSpinner: false})
				}
			});
		});
	}

	setStatusMessage(input) {
		let inputString = '';
		if (typeof input === 'object') {
			const last = Math.min(input.length, 20) - 1;
			for (let i = 0; i <= last; i++) {
				inputString += input[i].name;
				inputString += i !== last
					? ','
					: '.';
			}
		} else {
			inputString = input;
		}
		this.setState({statusMessage: inputString, statusSpinner: true});
	}

	clearMessage() {
		this.setStatusMessage('');
	}

	songSelected(file) {
		this.setState({selected: file});
	}

	updateLyrics(file, lyrics) {
		Task.updateLyrics(file, lyrics);
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
			lyrics = <Lyrics file={this.state.selected} updateLyrics={this.updateLyrics.bind(this)} />;
			containerClass = 'container container--filelist';
		}

		return(
			<DragDropContextProvider backend={HTML5Backend}>
				<div className={containerClass}>
					{target}{fileList}{lyrics}
					<StatusBar
						message={this.state.statusMessage}
						spinner={this.state.statusSpinner}
						clearMessage={this.clearMessage.bind(this)} />
				</div>
			</DragDropContextProvider>
		);
	}
}