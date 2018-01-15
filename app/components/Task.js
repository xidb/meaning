import fs from 'fs';
import Promise from 'bluebird';
import ffmetadata from 'ffmetadata';
import dir from 'node-dir';
import { File } from 'file-api';

Array.prototype.chunk = function(groupsize) {
	let sets = [], chunks, i = 0;
	chunks = this.length / groupsize;

	while (i < chunks) {
		sets[i] = this.splice(0, groupsize);
		i++;
	}

	return sets;
};

module.exports.getSubdirsChunked = async function(paths, chunks) {
	let subdirsArrays = await Promise.map(paths, path => {
		return new Promise(resolve => {
			dir.subdirs(path, (err, subdirs) => {
				if (err) {
					throw err;
				}

				resolve(subdirs);
			});
		});
	});

	let merged = [];

	subdirsArrays.map(subdirs => {
		merged.push(...subdirs);
	});

	return merged.chunk(chunks);
};

module.exports.parseDirs = async function(paths) {
	return Promise.map(paths, path => {
		return new Promise(resolve => {
			dir.files(path, (err, filePaths) => {
				if (err) {
					throw err;
				}

				let files = [];

				filePaths.map(filePath => {
					files.push(new File(filePath))
				});

				resolve(files);
			});
		});
	});
};

module.exports.getMetadata = async function(files, timeout) {
	const metaFields = [
		'album', 'album_artist', 'artist', 'composer', 'date',
		'disc', 'genre', 'lyrics', 'title', 'track'
	];

	return Promise.map(files, file => {
		return new Promise(resolve => {
			setTimeout(resolve => {
				ffmetadata.read(file.path, (err, data) => {
					metaFields.map(metaField => {
						file[metaField] = typeof data[metaField] !== 'undefined'
							? data[metaField]
							: ''
					});

					if (timeout < 20) {
						saveImage(file);
					}

					resolve(file);
				})
			}, timeout, resolve);
		});
	});

	function saveImage(file) {
		// Make unique image path for album,
		// even if it does not have image
		// to not store it two times
		// if another file has image
		let artist = file.album_artist === ''
			? file.artist
			: file.album_artist;

		let album = file.album === ''
			? file.path.split('\\').slice(0, -1).join('\\') // dir path
			: file.album;

		const imagePath = `.imagecache/${btoa(encodeURIComponent(artist+album))}.jpg`;

		if (!fs.existsSync(imagePath)) {
			ffmetadata.read(file.path, {coverPath: imagePath}, (err, data) => {});
		}

		file.imagePath = imagePath;
	}
};