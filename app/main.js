'use strict';

// Import parts of electron to use
const {app, BrowserWindow, ipcMain, shell, Menu, MenuItem} = require('electron');
const windowStateKeeper = require('electron-window-state');
const url = require('url');
const path = require('path');
import installExtension, {REACT_DEVELOPER_TOOLS} from 'electron-devtools-installer';
import {enableLiveReload} from 'electron-compile';

let dev = process.env.DEV === 'true';

if (dev) {
	enableLiveReload();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
	let windowArgs = {};

	if (dev) {
		const devWindowArgs = {
			width: 1280,
			height: 720
		};
		windowArgs = {...windowArgs, ...devWindowArgs};

		installExtension(REACT_DEVELOPER_TOOLS)
			.then((name) => console.log(`Added Extension:  ${name}`))
			.catch((err) => console.log('An error occurred: ', err));
	}

	// Load the previous state with fallback to defaults
	let mainWindowState = windowStateKeeper({
		windowArgs
	});

	// Create the window using the state information
	mainWindow = new BrowserWindow({
		x: mainWindowState.x,
		y: mainWindowState.y,
		width: mainWindowState.width,
		height: mainWindowState.height,
		backgroundColor: '#313131',
		webPreferences: {
			textAreasAreResizable: false
		}
	});

	mainWindowState.manage(mainWindow);

	const indexPath = url.format({
		protocol: 'file:',
		pathname: path.join(__dirname, '', 'main.html'),
		slashes: true
	});
	mainWindow.loadURL(indexPath);
	mainWindow.webContents.openDevTools();

	// Emitted when the window is closed.
	mainWindow.on('closed', function () {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	});
}

function createMenu() {
	let menu;

	const preciousMenuItem = {
		label: 'Dance!',
		click() {
			shell.openExternal('https://www.youtube.com/watch?v=dQw4w9WgXcQ?autoplay=1');
		}
	};

	if (dev) {
		// Just edit default menu
		menu = Menu.getApplicationMenu();

		menu.items.map(
			(menuItem) => {
				if (menuItem.label === 'Help') {
					menuItem.submenu.clear();
					menuItem.submenu.append(
						new MenuItem(preciousMenuItem)
					);
				}
			}
		);

	} else {
		// Create new
		const subMenuHelp = {
			label: 'Help',
			submenu: [preciousMenuItem]
		};

		menu = Menu.buildFromTemplate([subMenuHelp]);
	}

	Menu.setApplicationMenu(menu);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createMenu);
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

ipcMain.on('progress', (event, arg) => {
	mainWindow.setProgressBar(arg);
});