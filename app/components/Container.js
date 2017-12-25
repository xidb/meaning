import React, { Component } from 'react';
import { DragDropContext, DragDropContextProvider } from 'react-dnd';
import HTML5Backend, { NativeTypes } from 'react-dnd-html5-backend';
import Target from './Target';
import FileList from './FileList';

@DragDropContext(HTML5Backend)
export default class Container extends Component {
	constructor(props) {
		super(props);

		this.handleFileDrop = this.handleFileDrop.bind(this);

		this.state = {files: []};
	}

	handleFileDrop(item, monitor) {
		if (monitor) {
			this.setState({files: [...this.state.files, ...monitor.getItem().files]});
		}
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

		return (
			<DragDropContextProvider backend={HTML5Backend}>
				<div className={containerClass}>{targetOrFileList}</div>
			</DragDropContextProvider>
		);
	}
}