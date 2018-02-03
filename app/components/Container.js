import React, { Component } from 'react';
import { DragDropContext, DragDropContextProvider } from 'react-dnd';
import HTML5Backend, { NativeTypes } from 'react-dnd-html5-backend';

import _ from 'lodash';
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
		this.saveSettingsThrottle = _.throttle(this.saveSettings, 500);

		this.state = {
			files: [],
			selected: {},
			statusMessage: '',
			render: false
		};

		this.settings = {};

		void this.fetchFromDb();
	}

	async fetchFromDb() {
		await db.connectToDB('app/db.sqlite');

		// await db.run('DELETE FROM songs');
		const settings = await db.queryRows('SELECT * FROM settings');
		await this.sendSettingsToComponents(settings);
		this.setState({selected: this.settings['Container'].selected});

		console.time('db_fetch_first_100');
		const firstPage = await db.queryRows(
			'SELECT * FROM songs ORDER by albumartist, year, album, discnumber, track LIMIT 100'
		);
		console.timeEnd('db_fetch_first_100');

		if (firstPage.length > 0) {
			this.setFiles(firstPage);
		}

		this.setState({render: true});

		if (firstPage.length < 100) {
			return;
		}

		console.time('db_fetch_first_all');
		const songs = await db.queryRows(
			'SELECT * FROM songs ORDER by albumartist, year, album, discnumber, track LIMIT -1 OFFSET 100'
		);
		console.timeEnd('db_fetch_first_all');

		if (songs.length > 0) {
			this.setFiles(songs);
		}
	}

	async sendSettingsToComponents(settings) {
		settings.map(row => {
			this.settings[row.component] = JSON.parse(row.settings);
		});
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

		this.lastInsertTick = this.ticks;

		setTimeout(ipcRenderer.send('progress', insertCounter / finishCounter), 100);

		if (insertCounter % 20 === 0) {
			let fileMetadata = `${file.albumartist} - `;
			fileMetadata += file.album ? file.album : file.title;
			this.setStatusMessage(`Updating library... ${fileMetadata}`);
		}

		if (insertCounter === finishCounter) {
			ipcRenderer.send('progress', 0);
			this.updatingDb = false;
		}
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

	async songSelected(file, fileListSettings) {
		// check exist
		if (!fs.existsSync(file.path)) {
			this.setStatusMessage(`${file.path} not found, removing...`);
			_.remove(this.state.files, {id: file.id});

			await db.deleteRows(
				'songs',
				[{
					column: 'id',
					comparator: '=',
					value: file.id
				}]
			);
			this.setState({files: this.state.files});
			return;
		}

		const imagePath = await this.searchImage(file);

		const containerSettings = JSON.stringify({selected: {file: file, imagePath: imagePath}});
		this.saveSettingsThrottle(containerSettings, fileListSettings);

		this.setState({selected: {file: file, imagePath: imagePath}});
	}

	saveSettings(containerSettings, fileListSettings) {
		// save selected
		db.updateRow(
			'settings',
			{ settings: containerSettings },
			[{
				column: 'component',
				comparator: '=',
				value: 'Container'
			}]
		);

		db.updateRow(
			'settings',
			{ settings: fileListSettings },
			[{
				column: 'component',
				comparator: '=',
				value: 'FileList'
			}]
		);
	}

	async searchImage(file) {
		const imageName = file.image_name;

		// Try jpg, as most of the cover are in jpg
		const imagePath = `.imagecache/${imageName}.jpg`;

		if (fs.existsSync(imagePath)) {
			return `../${imagePath}`;
		}

		// try to find image with another extension
		const anotherExt = await new Promise(resolve => {
			findFile('.imagecache', `${imageName}.*`, (err, files) => {
				if (files[0] !== void 0 && files[0]['file'] !== void 0) {
					resolve(`../.imagecache/${files[0]['file']}`);
				} else {
					resolve(null);
				}
			});
		});

		if (anotherExt !== null) {
			return anotherExt;
		}

		// else try to find image in song dir
		const songDir = file.path.split('\\').slice(0, -1).join('\\').replace(/\\/g, '/');

		return await new Promise(resolve => {
			findFile(songDir, `.*\.(jpg|png|gif|bmp|tiff)`, (err, files) => {
				if (files[0] !== void 0 && files[0]['file'] !== void 0) {
					resolve(`//${songDir}/${files[0]['file']}`.replace(/\\/g, '/'));
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

	tick() {
		// Check maybe update not doing anything for 3 seconds
		if (this.updatingDb && (this.ticks - this.lastInsertTick) >= 3) {
			ipcRenderer.send('progress', 0);
			this.updatingDb = false;
		}

		this.ticks++;
	}

	componentDidMount() {
		this.ticks = 0;
		this.interval = setInterval(() => this.tick(), 1000);
	}

	componentWillUnmount() {
		clearInterval(this.interval);
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
				settings={this.settings['FileList']}
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