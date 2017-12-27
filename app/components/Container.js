import React, { Component } from 'react';
import { DragDropContext, DragDropContextProvider } from 'react-dnd';
import HTML5Backend, { NativeTypes } from 'react-dnd-html5-backend';

import fs from 'fs';
import dir from 'node-dir';
import { File } from 'file-api';
import { _ } from 'lodash/core';
import ffmetadata from "ffmetadata";

import Target from './Target';
import FileList from './FileList';
import StatusBar from './StatusBar';

@DragDropContext(HTML5Backend)
export default class Container extends Component {
	static metaFields = [
		'album', 'album_artist', 'artist', 'composer', 'date',
		'disc', 'genre', 'lyrics', 'title', 'track'
	];

	constructor(props) {
		super(props);

		this.handleFileDrop = this.handleFileDrop.bind(this);

		this.state = {files: [], status: ''};
		this.filtered = [];
		this.index = 0;
	}

	handleFileDrop(item, monitor) {
		if (!monitor) {
			return;
		}

		this.index = 0;

		let dropped = _.sortBy(monitor.getItem().files, 'path');

		const paths = dropped.filter(item => {
			return fs.lstatSync(item.path).isDirectory();
		});

		if (paths.length > 0) {
			paths.map(item => {
				const filePaths = dir.files(item.path, {sync:true});

				for (let filePath of filePaths) {
					dropped.push(new File(filePath));
				}
			})
		}

		this.processFiles(dropped);
	}

	processFiles(dropped) {
		this.filtered = dropped.filter(file => {
			const isAudio = file.type.match(/audio\/.*/i);
			let notExists = true;

			for (let stateFile of this.state.files) {
				if (stateFile.path === file.path) {
					notExists = false;
					break;
				}
			}
			return isAudio && notExists;
		});

		this.filtered.map((file) => {
			setTimeout( this.getMetadata(file), 0);
		});
	}

	getMetadata(file) {
		this.state.status = `Processing ${file.path}`;
		ffmetadata.read(file.path, (err, data) => {
			if (!err) {
				Container.metaFields.map(metaField => {
					file[metaField] = typeof data[metaField] !== 'undefined'
						? data[metaField]
						: ''
				});

				setTimeout( this.saveImage(file), 0);

				this.index++;

				if (this.index === this.filtered.length) {
					this.setState({files: [...this.state.files, ...this.filtered]});
				}
			}
		});
	}

	saveImage(file) {
		let artist = file.album_artist === ''
			? file.artist
			: file.album_artist;

		let album = file.album === ''
			? file.path.split('\\').slice(0, -1).join('\\') // filepath
			: file.album;

		const imagePath = `.imagecache/${btoa(encodeURIComponent(artist+album))}.jpg`;

		if (!fs.existsSync(imagePath)) {
			ffmetadata.read(file.path, {coverPath: imagePath}, (err, data) => {});
		}

		file.imagePath = imagePath;
	}

	render() {
		const {FILE} = NativeTypes;
		const {files} = this.state;

		let targetOrFileList;
		let containerClass;
		if (files.length === 0) {
			targetOrFileList = <Target accepts={[FILE]} onDrop={this.handleFileDrop} />;
			containerClass = 'container-center';
		} else {
			targetOrFileList = <FileList accepts={[FILE]} onDrop={this.handleFileDrop} files={files} />;
			containerClass = 'container-left';
		}

		return(
			<DragDropContextProvider backend={HTML5Backend}>
				<div className={containerClass}>
					{targetOrFileList}
					<StatusBar status={this.state.status}/>
				</div>
			</DragDropContextProvider>
		);
	}
}