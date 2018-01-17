const db = require('sqlite-crud');

(async () => {
	db.connectToDB('app/db.sqlite');
	await db.migrate('app/migrations');
})();