import db from 'sqlite-crud';

module.exports.insert = async function(file) {
	const dbFields = [
		'path', 'albumartist', 'artist', 'album', 'year', 'discnumber',
		'track', 'title','lyrics', 'genre', 'image_name'
	];

	for (let key in file) {
		if (!file.hasOwnProperty(key)) {
			continue;
		}

		if (!dbFields.includes(key)) {
			delete file[key];
		}
	}

	await db.connectToDB('app/db.sqlite');
	await db.insertRow('song', file);
};
