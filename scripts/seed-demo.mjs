#!/usr/bin/env node
/**
 * Seed FamilyOS with a demo Mongolian family (prototype data).
 *
 * Usage:
 *   node scripts/seed-demo.mjs [path-to-famos.db]
 *
 * Defaults to ./data/famos.db. Safe to re-run: demo rows are replaced.
 * Requires the app to have been set up once (an admin member must exist).
 */
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// better-sqlite3 is a dependency of @famos/db, not the workspace root.
const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const Database = require('better-sqlite3');

const dbPath = process.argv[2] ? resolve(process.argv[2]) : resolve('data/famos.db');
const db = new Database(dbPath);

/** UUIDv7, the ID format FamilyOS uses (`<prefix>_<uuidv7>`). */
function uuid7() {
	const ms = BigInt(Date.now());
	const b = randomBytes(16);
	b[0] = Number((ms >> 40n) & 0xffn);
	b[1] = Number((ms >> 32n) & 0xffn);
	b[2] = Number((ms >> 24n) & 0xffn);
	b[3] = Number((ms >> 16n) & 0xffn);
	b[4] = Number((ms >> 8n) & 0xffn);
	b[5] = Number(ms & 0xffn);
	b[6] = (b[6] & 0x0f) | 0x70;
	b[8] = (b[8] & 0x3f) | 0x80;
	const h = b.toString('hex');
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const sid = (prefix) => `${prefix}_${uuid7()}`;

const TIME_ZONE = 'Asia/Ulaanbaatar';
const NOW = Date.now();
const at = (s) => new Date(s).getTime();

const admin = db.prepare('select id from core_members where role_id = ?').get('admin');
if (!admin) {
	db.close();
	throw new Error('No admin member found — run the first-time setup first.');
}
const adminId = admin.id;

// Fixed demo member IDs (valid UUIDv7 shape) so the seed is reproducible.
const MEMBERS = {
	enkhjargal: 'member_01a1b67f-0353-758d-bcbf-b65746513001',
	batbayar: 'member_01a1b67f-0353-758d-bcbf-b65746513002',
	nomin: 'member_01a1b67f-0353-758d-bcbf-b65746513003',
	temuulen: 'member_01a1b67f-0353-758d-bcbf-b65746513004',
};

const run = db.transaction(() => {
	// --- Members -----------------------------------------------------------
	const insMember = db.prepare(`
		insert into core_members (id, display_name, role_id, about, color, locale, created_at, updated_at)
		values (@id, @name, @role, @about, @color, 'mn', @now, @now)
		on conflict(id) do update set
			display_name = excluded.display_name,
			role_id = excluded.role_id,
			about = excluded.about,
			color = excluded.color,
			updated_at = excluded.updated_at
	`);
	const memberRows = [
		{ id: MEMBERS.enkhjargal, name: 'Enkhjargal', role: 'member', about: 'Mother', color: '#c06ab0' },
		{ id: MEMBERS.batbayar, name: 'Batbayar', role: 'member', about: 'Father', color: '#3d7aae' },
		{ id: MEMBERS.nomin, name: 'Nomin', role: 'supervised', about: 'Sister, 14', color: '#7c3aed' },
		{ id: MEMBERS.temuulen, name: 'Temuulen', role: 'supervised', about: 'Brother, 10', color: '#d97706' },
	];
	for (const m of memberRows) insMember.run({ ...m, now: NOW });

	// --- Calendar events ---------------------------------------------------
	db.prepare('delete from calendar_events where created_by = ?').run(adminId);
	const insEvent = db.prepare(`
		insert into calendar_events
			(id, title, notes, location, all_day, starts_at, ends_at, start_date, end_date, time_zone,
			 rrule, exdates, member_ids, created_by, source_kind, source_id, created_at, updated_at,
			 deleted_at, reminder_minutes, reminder_set, tags, series_id, recurrence_key, version, series_end)
		values
			(@id, @title, @notes, @location, 0, @startsAt, @endsAt, null, null, @timeZone,
			 null, null, @memberIds, @createdBy, null, null, @now, @now,
			 null, 30, 1, null, null, null, 0, null)
	`);
	const events = [
		{ title: 'School — Nomin', notes: 'Grade 9, bring the science project.', location: 'No. 12 School', startsAt: '2026-11-09T08:00:00+08:00', endsAt: '2026-11-09T15:00:00+08:00', memberIds: [MEMBERS.nomin] },
		{ title: 'Work — Batbayar', notes: 'Office day.', location: 'Central Tower', startsAt: '2026-11-09T09:00:00+08:00', endsAt: '2026-11-09T18:00:00+08:00', memberIds: [MEMBERS.batbayar] },
		{ title: 'Football practice — Temuulen', notes: 'Bring boots and water.', location: 'National Stadium', startsAt: '2026-11-09T16:00:00+08:00', endsAt: '2026-11-09T17:30:00+08:00', memberIds: [MEMBERS.temuulen] },
		{ title: 'Family dinner', notes: 'Buuz night!', location: 'Home', startsAt: '2026-11-08T19:00:00+08:00', endsAt: '2026-11-08T20:30:00+08:00', memberIds: [adminId, MEMBERS.enkhjargal, MEMBERS.batbayar, MEMBERS.nomin, MEMBERS.temuulen] },
		{ title: 'Doctor appointment — Enkhjargal', notes: 'Annual check-up.', location: 'City Clinic', startsAt: '2026-11-10T10:00:00+08:00', endsAt: '2026-11-10T11:00:00+08:00', memberIds: [MEMBERS.enkhjargal] },
	];
	for (const e of events) {
		insEvent.run({
			id: sid('cal_event'),
			title: e.title,
			notes: e.notes,
			location: e.location,
			startsAt: at(e.startsAt),
			endsAt: at(e.endsAt),
			timeZone: TIME_ZONE,
			memberIds: JSON.stringify(e.memberIds),
			createdBy: adminId,
			now: NOW,
		});
	}

	// --- Tasks -------------------------------------------------------------
	db.prepare('delete from lists_tasks where created_by = ?').run(adminId);
	const insTask = db.prepare(`
		insert into lists_tasks
			(id, title, notes, assignee_id, due_date, due_time, rrule, rrule_start, done_at, done_by,
			 created_by, source_kind, source_id, created_at, updated_at, deleted_at, version)
		values
			(@id, @title, @notes, @assigneeId, @dueDate, null, null, null, null, null,
			 @createdBy, null, null, @now, @now, null, 0)
	`);
	const tasks = [
		{ title: 'Pay school fee', notes: 'Due this month.', assigneeId: adminId, dueDate: '2026-11-12' },
		{ title: 'Sign permission slip', notes: 'School trip form.', assigneeId: MEMBERS.nomin, dueDate: '2026-11-10' },
		{ title: 'Buy groceries', notes: 'See the shopping list.', assigneeId: MEMBERS.enkhjargal, dueDate: '2026-11-09' },
		{ title: 'Clean room', notes: 'Tidy desk and floor.', assigneeId: MEMBERS.temuulen, dueDate: '2026-11-09' },
	];
	for (const t of tasks) {
		insTask.run({
			id: sid('task'),
			title: t.title,
			notes: t.notes,
			assigneeId: t.assigneeId,
			dueDate: t.dueDate,
			createdBy: adminId,
			now: NOW,
		});
	}

	// --- Chores ------------------------------------------------------------
	db.prepare('delete from chores_assignees where chore_id in (select id from chores_chores where created_by = ?)').run(adminId);
	db.prepare('delete from chores_chores where created_by = ?').run(adminId);
	const insChore = db.prepare(`
		insert into chores_chores
			(id, title, notes, recurrence, start_date, next_due, rotation, assignee_id, created_by,
			 created_at, updated_at, archived_at, version)
		values
			(@id, @title, @notes, @recurrence, @startDate, @nextDue, @rotation, @assigneeId, @createdBy,
			 @now, @now, null, 0)
	`);
	const insAssignee = db.prepare('insert into chores_assignees (chore_id, member_id, position) values (?, ?, ?)');
	const chores = [
		{ title: 'Wash the dishes', notes: 'After dinner.', recurrence: 'daily', startDate: '2026-11-08', nextDue: '2026-11-09', rotation: 'round_robin', assigneeId: MEMBERS.nomin, assignees: [MEMBERS.nomin, MEMBERS.temuulen] },
		{ title: 'Take out the trash', notes: 'To the bin downstairs.', recurrence: 'daily', startDate: '2026-11-08', nextDue: '2026-11-09', rotation: 'fixed', assigneeId: MEMBERS.temuulen, assignees: [MEMBERS.temuulen] },
		{ title: 'Vacuum the living room', notes: 'Under the sofa too.', recurrence: 'weekly', startDate: '2026-11-08', nextDue: '2026-11-10', rotation: 'fixed', assigneeId: MEMBERS.nomin, assignees: [MEMBERS.nomin] },
	];
	for (const c of chores) {
		const choreId = sid('chore');
		insChore.run({
			id: choreId,
			title: c.title,
			notes: c.notes,
			recurrence: c.recurrence,
			startDate: c.startDate,
			nextDue: c.nextDue,
			rotation: c.rotation,
			assigneeId: c.assigneeId,
			createdBy: adminId,
			now: NOW,
		});
		c.assignees.forEach((memberId, i) => insAssignee.run(choreId, memberId, i));
	}

	// --- Shopping ----------------------------------------------------------
	const defaultList = db.prepare('select id from lists_shopping_lists order by sort limit 1').get();
	if (defaultList) {
		db.prepare('delete from lists_shopping_items where list_id = ?').run(defaultList.id);
	}
	const pharmacyList = db.prepare('insert into lists_shopping_lists (id, name, sort, created_at, updated_at, archived_at, version) values (?, ?, ?, ?, ?, null, 0) on conflict(id) do update set name = excluded.name, updated_at = excluded.updated_at')
		.run(sid('shop_list'), 'Pharmacy', 1, NOW, NOW);
	const pharmacyId = db.prepare('select id from lists_shopping_lists where name = ?').get('Pharmacy')?.id;

	const insItem = db.prepare(`
		insert into lists_shopping_items
			(id, list_id, title, title_key, quantity, category, done_at, done_by, added_by,
			 source_kind, source_id, created_at, updated_at, deleted_at, version)
		values
			(@id, @listId, @title, @titleKey, @quantity, @category, null, null, @addedBy,
			 null, null, @now, @now, null, 0)
	`);
	const items = [
		{ listId: defaultList?.id, title: 'Milk', quantity: '2 l', category: 'dairy' },
		{ listId: defaultList?.id, title: 'Bread', quantity: '1 loaf', category: 'bakery' },
		{ listId: defaultList?.id, title: 'Eggs', quantity: '10 pcs', category: 'dairy' },
		{ listId: defaultList?.id, title: 'Rice', quantity: '5 kg', category: 'pantry' },
		{ listId: defaultList?.id, title: 'Apples', quantity: '1 kg', category: 'produce' },
		{ listId: pharmacyId, title: 'Vitamin D', quantity: '1 bottle', category: 'pharmacy' },
		{ listId: pharmacyId, title: 'Bandages', quantity: '1 box', category: 'pharmacy' },
	];
	for (const it of items) {
		if (!it.listId) continue;
		insItem.run({
			id: sid('shop_item'),
			listId: it.listId,
			title: it.title,
			titleKey: it.title.toLowerCase(),
			quantity: it.quantity,
			category: it.category,
			addedBy: adminId,
			now: NOW,
		});
	}

	// --- Meal plan ---------------------------------------------------------
	db.prepare('delete from kitchen_meal_plan where created_by = ?').run(adminId);
	const insMeal = db.prepare(`
		insert into kitchen_meal_plan (id, date, slot, recipe_id, title, note, created_by, created_at, updated_at)
		values (@id, @date, 'dinner', null, @title, @note, @createdBy, @now, @now)
	`);
	const meals = [
		{ date: '2026-11-08', title: 'Buuz (steamed dumplings)', note: 'Family cooking night.' },
		{ date: '2026-11-09', title: 'Fried rice with vegetables', note: 'Quick weekday dinner.' },
		{ date: '2026-11-10', title: 'Tsai (Mongolian milk tea) and boov', note: 'Weekend breakfast.' },
	];
	for (const m of meals) {
		insMeal.run({ id: sid('kitchen_meal'), date: m.date, title: m.title, note: m.note, createdBy: adminId, now: NOW });
	}

	// --- Board notes -------------------------------------------------------
	db.prepare('delete from board_notes where created_by = ?').run(adminId);
	const insNote = db.prepare(`
		insert into board_notes
			(id, text, photo, photo_type, paper, pinned, ends_at, created_by, created_at, updated_at, position, version, created_by_app)
		values
			(@id, @text, null, null, 'note-1', @pinned, null, @createdBy, @now, @now, @position, 0, null)
	`);
	const notes = [
		{ text: 'Welcome to Family Hub OS! 🐎', pinned: 1, position: 0 },
		{ text: 'Milk is running low — add to the shopping list.', pinned: 0, position: 1 },
		{ text: 'Temuulen: football practice Monday 16:00.', pinned: 0, position: 2 },
	];
	for (const n of notes) {
		insNote.run({ id: sid('board_note'), text: n.text, pinned: n.pinned, position: n.position, createdBy: adminId, now: NOW });
	}

	// --- Home --------------------------------------------------------------
	db.prepare('delete from home_items where home_id in (select id from home_homes where created_by = ?)').run(adminId);
	db.prepare('delete from home_services where home_id in (select id from home_homes where created_by = ?)').run(adminId);
	db.prepare('delete from home_homes where created_by = ?').run(adminId);
	const homeId = sid('home');
	db.prepare('insert into home_homes (id, name, address, tenure, notes, created_by, created_at, updated_at) values (?,?,?,?,?,?,?,?)')
		.run(homeId, 'Family apartment', 'Ulaanbaatar, Khan-Uul district', 'owner', '2 bedrooms, 3rd floor, south facing', adminId, NOW, NOW);

	const insHomeItem = db.prepare(`
		insert into home_items (id, home_id, name, room, brand, model, serial, purchased_on, warranty_until, notes, created_by, created_at, updated_at)
		values (?,?,?,?,?,?,?,?,?,?,?,?,?)
	`);
	const homeItems = [
		{ name: 'Refrigerator', room: 'Kitchen', brand: 'Samsung', model: 'RT38', serial: 'SN-REF-2023-001', purchasedOn: '2023-05-12', warrantyUntil: '2028-05-12', notes: '10-year compressor warranty.' },
		{ name: 'Washing machine', room: 'Bathroom', brand: 'LG', model: 'F2', serial: 'SN-WM-2022-114', purchasedOn: '2022-09-03', warrantyUntil: '2027-09-03', notes: 'Clean filter monthly.' },
		{ name: 'Television', room: 'Living room', brand: 'LG', model: 'OLED55', serial: 'SN-TV-2024-207', purchasedOn: '2024-01-20', warrantyUntil: '2026-01-20', notes: 'Wall mounted.' },
	];
	for (const it of homeItems) {
		insHomeItem.run(sid('home_item'), homeId, it.name, it.room, it.brand, it.model, it.serial, it.purchasedOn, it.warrantyUntil, it.notes, adminId, NOW, NOW);
	}

	const insService = db.prepare(`
		insert into home_services (id, home_id, kind, provider, account_number, due_day, notes, created_by, created_at, updated_at)
		values (?,?,?,?,?,?,?,?,?,?)
	`);
	const services = [
		{ kind: 'water', provider: 'USUG', accountNumber: 'UB-102938', dueDay: 15, notes: 'Water and sewage.' },
		{ kind: 'electricity', provider: 'UBEDN', accountNumber: 'UB-556677', dueDay: 10, notes: 'Electricity bill.' },
		{ kind: 'internet', provider: 'Unitel', accountNumber: 'UNITEL-8899', dueDay: 25, notes: 'Fiber 300 Mbps.' },
	];
	for (const s of services) {
		insService.run(sid('home_service'), homeId, s.kind, s.provider, s.accountNumber, s.dueDay, s.notes, adminId, NOW, NOW);
	}

	// --- Pets --------------------------------------------------------------
	db.prepare('delete from pets_treatments where pet_id in (select id from pets_pets where created_by = ?)').run(adminId);
	db.prepare('delete from pets_pets where created_by = ?').run(adminId);
	const insPet = db.prepare(`
		insert into pets_pets (id, name, species, breed, sex, birth_date, chip_number, vet, member_ids, notes, created_by, created_at, updated_at)
		values (?,?,?,?,?,?,?,?,?,?,?,?,?)
	`);
	const insTreatment = db.prepare(`
		insert into pets_treatments (id, pet_id, kind, given_on, product, batch, vet, notes, document_id, created_by, created_at)
		values (?,?,?,?,?,?,?,?,?,?,?)
	`);
	const pets = [
		{ name: 'Buddy', species: 'dog', breed: 'Mongolian bankhar', sex: 'male', birthDate: '2023-04-10', chipNumber: 'MN-BUD-001', vet: 'City Vet Clinic', memberIds: [MEMBERS.temuulen, adminId], notes: 'Loves running in the steppe.' },
		{ name: 'Mochi', species: 'cat', breed: 'Domestic shorthair', sex: 'female', birthDate: '2024-02-14', chipNumber: 'MN-MOC-002', vet: 'City Vet Clinic', memberIds: [MEMBERS.nomin], notes: 'Indoor cat, shy with guests.' },
	];
	for (const p of pets) {
		const petId = sid('pet');
		insPet.run(petId, p.name, p.species, p.breed, p.sex, p.birthDate, p.chipNumber, p.vet, JSON.stringify(p.memberIds), p.notes, adminId, NOW, NOW);
		insTreatment.run(sid('pet_treatment'), petId, 'vaccination', '2026-09-15', 'Rabies vaccine', 'BATCH-2026-09', p.vet, 'Annual booster.', null, adminId, NOW);
		insTreatment.run(sid('pet_treatment'), petId, 'deworming', '2026-06-01', 'Broad-spectrum dewormer', null, p.vet, 'Oral tablet.', null, adminId, NOW);
	}

	// --- Vehicles ----------------------------------------------------------
	db.prepare('delete from vehicles_logs where vehicle_id in (select id from vehicles_vehicles where created_by = ?)').run(adminId);
	db.prepare('delete from vehicles_vehicles where created_by = ?').run(adminId);
	const insVehicle = db.prepare(`
		insert into vehicles_vehicles (id, name, plate, make, model, year, fuel, vin, member_ids, notes, created_by, created_at, updated_at)
		values (?,?,?,?,?,?,?,?,?,?,?,?,?)
	`);
	const insVehicleLog = db.prepare(`
		insert into vehicles_logs (id, vehicle_id, kind, done_on, place, notes, document_id, created_by, created_at)
		values (?,?,?,?,?,?,?,?,?)
	`);
	const vehicles = [
		{ name: 'Family car', plate: 'UB 1234 UBN', make: 'Toyota', model: 'Prius', year: 2019, fuel: 'hybrid', vin: 'JTDKN3DU3L0000000', memberIds: [adminId, MEMBERS.batbayar], notes: 'Daily commuter.' },
		{ name: 'Motorcycle', plate: 'UB 9876 UBN', make: 'Honda', model: 'CB500F', year: 2021, fuel: 'petrol', vin: 'JH2PC400000000000', memberIds: [MEMBERS.batbayar], notes: 'Weekend rides.' },
	];
	for (const v of vehicles) {
		const vehicleId = sid('vehicle');
		insVehicle.run(vehicleId, v.name, v.plate, v.make, v.model, v.year, v.fuel, v.vin, JSON.stringify(v.memberIds), v.notes, adminId, NOW, NOW);
		insVehicleLog.run(sid('vehicle_log'), vehicleId, 'service', '2026-09-20', 'Toyota Service Center', 'Oil change, filter, brake check.', null, adminId, NOW);
		insVehicleLog.run(sid('vehicle_log'), vehicleId, 'insurance', '2026-05-10', 'Gomur Insurance', 'Annual insurance renewed.', null, adminId, NOW);
	}
});

run();
db.close();
console.log('Demo data seeded into', dbPath);
