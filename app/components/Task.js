import fs from 'fs';
import dir from 'node-dir';
import { File } from 'file-api';
import db from 'sqlite-crud';
import _ from 'lodash';
import Promise from 'bluebird';
import taglib from 'taglib2';
import mime from 'mime';
import md5 from 'md5';

const fileFormats = [
	'mp3', 'm4a', 'ogg', 'wma', 'm4b', 'm4p', 'mp4', '3g2',
	'wav', 'flac', 'ape', 'mpc', 'wv', 'opus', 'tta'
];

const metaFields = [
	'albumartist', 'artist', 'album', 'year', 'discnumber',
	'track', 'title', 'lyrics', 'genre', 'image_name'
];

module.exports.getSubdirsChunked = async function(paths, chunks) {
	let subdirsArrays = await Promise.map(paths, path => {
		return new Promise(resolve => {
			dir.subdirs(path, (err, subdirs) => {
				if (err) {
					throw err;
				}

				if (subdirs.length > 0) {
					resolve(subdirs);
				} else {
					resolve([path]);
				}
			});
		});
	});

	let merged = [];

	subdirsArrays.map(subdirs => {
		merged.push(...subdirs);
	});

	return _.chunk(merged, chunks);
};

module.exports.fileCount = async function(paths) {
	return _.sum(
		await Promise.map(paths, path => {
			return new Promise(resolve => {
				dir.files(path, (err, filePaths) => {
					if (err) {
						throw err;
					}

					resolve(
						filePaths.filter(filePath => {
							const ext = filePath.toLowerCase().split('.').pop();
							return fileFormats.includes(ext);
						}).length
					);
				});
			});
		})
	);
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
					if (fileFormats.includes(filePath.toLowerCase().split('.').pop())) {
						files.push(new File(filePath))
					}
				});

				resolve(files);
			});
		});
	});
};

module.exports.getMetadata = async function(files) {
	return Promise.map(files, file => {
		return new Promise(resolve => {
			const meta = taglib.readTagsSync(file.path);

			// Artist and title tags are required
			if (!meta['artist'] || !meta['title']) {
				return resolve({error: `Required artist or title tags not found for ${file.path}`});
			}

			metaFields.map(field => {
				if (field === 'albumartist' && !meta[field]) {
					meta[field] = meta['artist'];
				}

				if (field === 'discnumber') {
					meta[field] = parseInt(meta[field]);
				}

				if (field === 'image_name') {
					// Make unique image path for album,
					// even if it does not have image
					// to not store it two times
					// if another file in album has image
					const album = meta['album']
						? meta['album']
						: file.path.split('\\').slice(0, -1).join('\\'); // use dir path if album empty

					meta['image_name'] = md5(encodeURIComponent(meta['albumartist'] + album));

					if (meta['pictures']) {
						const picture = meta['pictures'][0];
						const maybeExt = mime.extension(picture['mimetype']);
						const imageExt = maybeExt !== void 0
							? maybeExt.replace('jpeg', 'jpg')
							: 'jpg';

						// Save file
						const imagePath = `.imagecache/${meta['image_name']}.${imageExt}`;

						if (!fs.existsSync(imagePath)) {
							fs.writeFileSync(imagePath, picture['picture'], null, () => {
							});
						}
					}
				}

				file[field] = meta[field]
					? meta[field]
					: null
			});

			resolve(file);
		});
	});
};

module.exports.updateLyrics = async function(file, lyrics) {
	db.connectToDB('app/db.sqlite');

	taglib.writeTagsSync(file.path, {lyrics: lyrics});

	await db.updateRow(
		'songs',
		{ lyrics: lyrics },
		[{
			column: 'id',
			comparator: '=',
			value: file.id
		}]
	);
};