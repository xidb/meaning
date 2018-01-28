import React, { Component } from 'react';
import { DragDropContext, DragDropContextProvider } from 'react-dnd';
import HTML5Backend, { NativeTypes } from 'react-dnd-html5-backend';

import _ from 'lodash/core';
import fs from 'fs';
import os from 'os';
import db from 'sqlite-crud';
import findFile from 'file-regex';
import events from 'events';
events.EventEmitter.defaultMaxListeners = 20;

import { ipcRenderer } from 'electron';
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

		this.state = {
			files: [],
			selected: { file: {}, imagePath: 'assets/record.svg'},
			statusMessage: '',
			render: false
		};

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

		this.setState({render: true});

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

		if (this.updatingDb) {
			this.setStatusMessage('Currently in progress, try later');
			return;
		}

		this.dbInsertCounter = this.fileCount = 0;
		this.initFilesLength = this.state.files.length;
		this.updateMode = false;

		let dropped = _.sortBy(monitor.getItem().files, 'path');

		const files = dropped.filter(item => {
			return fs.lstatSync(item.path).isFile();
		});

		if (files.length > 0) {
			this.fileCount += files.length;
			await this.processFiles(files);
		}

		const dirs = dropped.filter(item => {
			return fs.lstatSync(item.path).isDirectory();
		});

		if (dirs.length > 0) {
			const paths = _.map(dirs, 'path');

			this.fileCount += await TaskPool.fileCount(paths);
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
			return;
		}
		const filteredFileCount = files.length - audio.length;
		if (filteredFileCount > 1) {
			this.updateMode = true;
		}
		this.setStatusMessage(audio);

		if (audio.length < 20) {
			this.setFiles(_.sortBy(await Task.getMetadata(audio), 'path'), true);
		} else {
			this.setFiles(_.sortBy(await TaskPool.getMetadata(audio), 'path'), true);
		}
	}

	filterAudio(files) {
		return files.filter(file => {
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
			TaskDb.insert(file).then(() => { this.createStatusMessage(file) });
		});
	}

	createStatusMessage(file) {
		this.dbInsertCounter++;
		this.updatingDb = true;

		const insertCounter = this.updateMode
			? this.initFilesLength + this.dbInsertCounter
			: this.dbInsertCounter;

		const finishCounter = this.updateMode
			? this.state.files.length
			: this.fileCount;

		setTimeout(ipcRenderer.send('progress', insertCounter / finishCounter), 100);

		if (insertCounter % 20 === 0) {
			let fileMetadata = `${file.albumartist} - `;
			fileMetadata += file.album ? file.album : file.title;
			this.setStatusMessage(`Updating library... ${fileMetadata}`);
		}

		setTimeout(() => {
			if (insertCounter === finishCounter) {
				ipcRenderer.send('progress', 0);
				this.updatingDb = false;
			}
		}, 1000);
	}

	setStatusMessage(input) {
		let inputString = '';
		if (typeof input === 'object') {
			const last = Math.min(input.length, 20) - 1;
			for (let i = 0; i <= last; i++) {
				inputString += input[i].name;
				inputString += i !== last ? ', ' : '.';
			}
		} else {
			inputString = input;
		}
		this.setState({statusMessage: inputString});
	}

	clearStatusMessage() {
		this.setStatusMessage('');
	}

	async songSelected(file) {
		const imagePath = await this.searchImage(file.image_name);

		this.setState({selected: {file: file, imagePath: imagePath}});
	}

	async searchImage(imageName) {
		// Try jpg, as most of the cover are in jpg
		const imagePath = `.imagecache/${imageName}.jpg`;

		if (fs.existsSync(imagePath)) {
			return `../${imagePath}`;
		}

		// else try to find image with another extension
		return await new Promise(resolve => {
			findFile('.imagecache', `${imageName}.*`, (err, files) => {
				if (files[0] !== void 0 && files[0]['file'] !== void 0) {
					resolve(`../.imagecache/${files[0]['file']}`);
				} else {
					resolve('assets/record.svg');
				}
			});
		});
	}

	static updateLyrics(file, lyrics) {
		Task.updateLyrics(file, lyrics);
		_.find(this.state.files, {id: file.id}).lyrics = lyrics;
	}

	render() {
		if (this.state.render === false) {
			return null;
		}

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
			lyrics = <Lyrics
				file={this.state.selected.file}
				imagePath={this.state.selected.imagePath}
				updateLyrics={Container.updateLyrics.bind(this)}
			/>;
			containerClass = 'container container--filelist';
		}

		return(
			<DragDropContextProvider backend={HTML5Backend}>
				<div className={containerClass}>
					{target}
					{fileList}
					{lyrics}
					<StatusBar
						message={this.state.statusMessage}
						clearStatusMessage={this.clearStatusMessage.bind(this)} />
				</div>
			</DragDropContextProvider>
		);
	}
}