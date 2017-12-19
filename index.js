'use strict';

// Import parts of electron to use
const {app, BrowserWindow} = require('electron');
const url = require('url');
const path = require('path');

import {enableLiveReload} from 'electron-compile';
enableLiveReload();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

let dev = process.env.DEV === 'true';

function createWindow() {
	let windowArgs = {
		show: false
	};

	if (dev) {
		const devWindowArgs = {
			width: 1280,
			height: 720
		};
		windowArgs = {windowArgs, ...devWindowArgs};
	}

	mainWindow = new BrowserWindow(windowArgs);

	const indexPath = url.format({
		protocol: 'file:',
		pathname: path.join(__dirname, '', 'index.html'),
		slashes: true
	});
	mainWindow.loadURL(indexPath);

	// Don't show until we are ready and loaded
	mainWindow.once('ready-to-show', () => {
		// Open the DevTools automatically if developing
		if (dev) {
			// mainWindow.maximize();
			mainWindow.webContents.openDevTools();
		}

		mainWindow.show();
	});

	// Emitted when the window is closed.
	mainWindow.on('closed', function() {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow();
	}
});

