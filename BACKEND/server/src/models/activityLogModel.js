const db = require('../database');

function mapActivityLog(row) {
	if (!row) return null;

	return {
		id: String(row.activity_id),
		adminId: String(row.admin_id),
		action: row.action,
		entityType: row.entity_type,
		entityId: row.entity_id,
		description: row.description,
		changes: row.changes ? JSON.parse(row.changes) : null,
		ipAddress: row.ip_address,
		createdAt: row.created_at
	};
}

async function createActivityLogsTable() {
	await db.query(`
		CREATE TABLE IF NOT EXISTS activity_logs (
			activity_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			admin_id BIGINT UNSIGNED NOT NULL,
			action VARCHAR(50) NOT NULL,
			entity_type VARCHAR(50) NOT NULL,
			entity_id VARCHAR(100),
			description TEXT,
			changes JSON,
			ip_address VARCHAR(45),
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (activity_id),
			FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE,
			INDEX idx_admin_id (admin_id),
			INDEX idx_created_at (created_at),
			INDEX idx_entity_type (entity_type)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
	`);
}

async function findById(id) {
	const [rows] = await db.query(
		`SELECT * FROM activity_logs WHERE activity_id = ? LIMIT 1`,
		[Number(id)]
	);
	return mapActivityLog(rows[0]);
}

async function findByAdminId(adminId, limit = 100, offset = 0) {
	const [rows] = await db.query(
		`SELECT * FROM activity_logs
		 WHERE admin_id = ?
		 ORDER BY created_at DESC
		 LIMIT ? OFFSET ?`,
		[Number(adminId), limit, offset]
	);
	return rows.map(mapActivityLog);
}

async function findAll(filters = {}, limit = 100, offset = 0) {
	let sql = `
		SELECT al.*,
		       CONCAT(u.first_name, ' ', u.last_name) AS actor_name,
		       u.email AS actor_email,
		       u.role  AS actor_role
		FROM activity_logs al
		LEFT JOIN users u ON u.user_id = al.admin_id
		WHERE 1=1`;
	const values = [];

	if (filters.adminId) {
		sql += ` AND al.admin_id = ?`;
		values.push(Number(filters.adminId));
	}

	if (filters.entityType) {
		sql += ` AND al.entity_type = ?`;
		values.push(filters.entityType);
	}

	if (filters.action) {
		sql += ` AND al.action = ?`;
		values.push(filters.action);
	}

	if (filters.startDate) {
		sql += ` AND al.created_at >= ?`;
		values.push(filters.startDate);
	}

	if (filters.endDate) {
		sql += ` AND al.created_at <= ?`;
		values.push(filters.endDate);
	}

	sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
	values.push(limit, offset);

	const [rows] = await db.query(sql, values);
	return rows.map(function (row) {
		const log = mapActivityLog(row);
		log.actorName  = row.actor_name  || null;
		log.actorEmail = row.actor_email || null;
		log.actorRole  = row.actor_role  || null;
		return log;
	});
}

async function create(data) {
	const [result] = await db.query(
		`INSERT INTO activity_logs (admin_id, action, entity_type, entity_id, description, changes, ip_address)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			Number(data.adminId),
			data.action,
			data.entityType,
			data.entityId || null,
			data.description || null,
			data.changes ? JSON.stringify(data.changes) : null,
			data.ipAddress || null
		]
	);
	return findById(result.insertId);
}

async function delete_(id) {
	const [result] = await db.query(`DELETE FROM activity_logs WHERE activity_id = ?`, [Number(id)]);
	return result.affectedRows > 0;
}

module.exports = {
	createActivityLogsTable,
	findById,
	findByAdminId,
	findAll,
	create,
	delete: delete_
};
