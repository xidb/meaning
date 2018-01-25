import fs from 'fs';
import dir from 'node-dir';
import { File } from 'file-api';
import db from 'sqlite-crud';
import Promise from 'bluebird';
import taglib from 'taglib2';
import mime from 'mime';

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

module.exports.getMetadata = async function(files) {
	const metaFields = [
		'albumartist', 'artist', 'album', 'year', 'discnumber',
		'track', 'title', 'lyrics', 'genre', 'image_name'
	];

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

				if (field === 'image_name' && meta['pictures']) {
					// Make unique image path for album,
					// even if it does not have image
					// to not store it two times
					// if another file in album has image
					const album = meta['album']
						? meta['album']
						: file.path.split('\\').slice(0, -1).join('\\'); // use dir path if album empty

					const picture = meta['pictures'][0];
					const maybeExt = mime.extension(picture['mimetype']);
					const imageExt = maybeExt !== void 0
						? maybeExt.replace('jpeg', 'jpg')
						: 'jpg';
					meta['image_name'] = btoa(encodeURIComponent(meta['albumartist'] + album)) + `.${imageExt}`;

					// Save file
					const imagePath = `.imagecache/${meta['image_name']}`;
					if (!fs.exists(imagePath)) {
						fs.writeFile(imagePath, picture['picture'], null, () => {
						});
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
		'song',
		{ lyrics: lyrics },
		[{
			column: 'id',
			comparator: '=',
			value: file.id
		}]
	);
};