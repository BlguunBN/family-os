#!/usr/bin/env node
/**
 * Apply the first-pass Mongolian (mn) translations to the generated language pack.
 *
 * The pack is generated from English, so we match on the English source text and
 * replace it with Mongolian. Run after `node scripts/lang.ts template mn`.
 *
 * Usage: node scripts/apply-mn.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'languages/mn';

/** English source text -> Mongolian. */
const MAP = {
	// --- chrome / navigation ---
	'Loading…': 'Ачааллаж байна…',
	'Language': 'Хэл',
	'Sign out': 'Гарах',
	'Sign out everywhere': 'Бүх төхөөрөмжөөс гар',
	'Today': 'Өнөөдөр',
	'Members': 'Гишүүд',
	'Calendar': 'Хуанли',
	'Lists': 'Жагсаалтууд',
	'Tasks': 'Ажлууд',
	'Shopping': 'Худалдан авах',
	'Board': 'Самбар',
	'Assistant': 'Туслах',
	'Settings': 'Тохиргоо',
	'Family': 'Гэр бүл',
	'Me': 'Би',
	'Home': 'Гэр',
	'Back': 'Буцах',
	'Save': 'Хадгалах',
	'Cancel': 'Цуцлах',
	'Delete': 'Устгах',
	'Edit': 'Засах',
	'Add': 'Нэмэх',
	'Search': 'Хайх',
	'Close': 'Хаах',
	'Done': 'Дууссан',
	'More': 'Илүү',
	'All day': 'Бүх өдөр',
	'Tomorrow': 'Маргааш',
	'Yesterday': 'Өчигдөр',
	'Now': 'Одоо',
	'Next up': 'Дараагийн',
	'Coming up': 'Удахгүй',
	'Any time': 'Дурын цаг',
	'Evening': 'Орой',
	'Pinned': 'Тэмдэглэсэн',
	'Due': 'Гүйцэтгэх хугацаа',
	'Assignee': 'Хариуцсан',
	'Location': 'Байршил',
	'Notes': 'Тэмдэглэл',
	'Name': 'Нэр',
	'Email': 'И-мейл',
	'Password': 'Нууц үг',
	'Role': 'Эрх',
	'Admin': 'Админ',
	'Member': 'Гишүүн',
	'Supervised': 'Хяналттай',
	'Guest': 'Зочин',
	'Owner': 'Эзэмшигч',

	// --- greetings / home ---
	'Good morning': 'Өглөөний мэнд',
	'Good afternoon': 'Өдрийн мэнд',
	'Good evening': 'Оройн мэнд',
	'Welcome home': 'Гэртээ тавтай морил',
	'Nothing is planned yet': 'Төлөвлөгөө байхгүй байна',
	'Nothing planned': 'Төлөвлөгөө байхгүй',
	'For you to check': 'Шалгах зүйлс',
	'Open Quick add': 'Түргэн нэмэх нээх',
	'A quiet day.': 'Амгалан өдөр.',
	'The day is done.': 'Өдөр дууслаа.',
	'Whose next thing to show': 'Хэн дараагийн зүйлээ харуулах вэ',

	// --- auth / setup ---
	'Welcome to FamilyOS': 'FamilyOS-д тавтай морил',
	'Sign in': 'Нэвтрэх',
	'Sign in with email': 'И-мейлээр нэвтрэх',
	" Who's using FamilyOS?": 'FamilyOS-г хэн ашиглаж байна вэ?',
	"Who's using FamilyOS?": 'FamilyOS-г хэн ашиглаж байна вэ?',
	'Email or password is incorrect.': 'И-мейл эсвэл нууц үг буруу байна.',
	'Create account': 'Бүртгэл үүсгэх',
	'Your name': 'Таны нэр',
	'Family name': 'Гэр бүлийн нэр',
	'Setup code': 'Тохируулгын код',
	'Wrong PIN.': 'PIN код буруу байна.',
	'At least 10 characters.': 'Хамгийн багадаа 10 тэмдэгт.',
	'Enter your name.': 'Нэрээ оруулна уу.',
	'Enter an email address, for example name@example.com.':
		'И-мейл хаягаа оруулна уу, жишээ нь name@example.com.',

	// --- counts / time ---
	'in {{count}} min': '{{count}} мин',
	'in {{count}} h': '{{count}} ц',
	'to go': 'үлдлээ',
	'starts': 'эхэлнэ',
	'now': 'одоо',
	'hr': 'ц',
	'min': 'мин',
	'first': 'эхлээд',
	'then': 'дараа нь',
	'At {{place}}': '{{place}} дээр',
	'Starts {{time}}': '{{time}} эхэлнэ',
	'Until {{time}}': '{{time}} хүртэл',
	'+{{count}} more': '+{{count}} илүү',

	// --- shopping ---
	'Add item': 'Зүйл нэмэх',
	'Items to get': 'Авах зүйлс',
	'Groceries': 'Хүнс',
	'Quantity': 'Тоо хэмжээ',
	'Category': 'Ангилал',

	// --- kitchen / meals ---
	'Kitchen': 'Гал тогоо',
	'Meal plan': 'Хоолны төлөвлөгөө',
	'Dinner': 'Оройн хоол',
	'Recipe': 'Жор',
	'Recipes': 'Жорууд',
	'Breakfast': 'Өглөөний хоол',
	'Lunch': 'Өдрийн хоол',
	'Snack': 'Зуур',
	'Servings': 'Хэдэн хүнд',
	'Ingredients': 'Орц',
	'Steps': 'Алхамууд',

	// --- chores ---
	'Chores': 'Үүрэг',
	'Add chore': 'Үүрэг нэмэх',
	'Round robin': 'Ээлжлэн',
	'Fixed': 'Тогтмол',
	'Daily': 'Өдөр бүр',
	'Weekly': 'Долоо хоног бүр',
	'Monthly': 'Сар бүр',

	// --- records ---
	'Records': 'Бичиг баримт',
	'Add document': 'Баримт нэмэх',
	'Document': 'Баримт',
	'Obligation': 'Үүрэг',

	// --- board ---
	'Add note': 'Тэмдэглэл нэмэх',
	'Note': 'Тэмдэглэл',

	// --- common errors ---
	'Something went wrong. Please try again.': 'Алдаа гарлаа. Дахин оролдоно уу.',
	'Try again': 'Дахин оролдох',
	'No access': 'Нэвтрэлт байхгүй',

	// --- login / PIN notice ---
	'Signing in with a PIN works only on family devices. An admin can turn this device into a family device after signing in.':
		'PIN кодоор нэвтрэх нь зөвхөн гэр бүлийн төхөөрөмж дээр хүчинтэй. Админ нэвтэрсэний дараа энэ төхөөрөмжийг гэр бүлийн төхөөрөмж болгож болно.',

	// --- home page chrome ---
	'Set up the AI': 'AI-г тохируулах',
	'Set up AI': 'AI-г тохируулах',
	'Not now': 'Одоо биш',
	'Ask the assistant': 'Туслахас асуух',
	'Calendar, tasks, shopping and more': 'Хуанли, ажлууд, худалдан авах болон бусад',
	'open': 'нээлттэй',
	'items to get': 'авах зүйлс',
	'and {{count}} more': 'болон {{count}} илүү',
	'NEXT DAYS': 'ДАРААГИЙН ӨДРҮҮД',
	'ON THE BOARD': 'САМБАР ДЭЭР',
	'TASKS': 'АЖЛУУД',
	'SHOPPING': 'ХУДАЛДАН АВАХ',
	'KITCHEN': 'ГАЛ ТОГОО',
	'FAMILY': 'ГЭР БҮЛ',
	'Tomorrow': 'Маргааш',
	'Good evening': 'Оройн мэнд',
	'Good morning': 'Өглөөний мэнд',
	'Good afternoon': 'Өдрийн мэнд',
};

let total = 0;
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'manifest.json')) {
	const path = join(DIR, file);
	const data = JSON.parse(readFileSync(path, 'utf8'));
	let changed = 0;
	for (const [key, value] of Object.entries(data)) {
		if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(MAP, value)) {
			data[key] = MAP[value];
			changed++;
		}
	}
	writeFileSync(path, JSON.stringify(data, null, '\t') + '\n');
	total += changed;
	console.log(`${file}: ${changed} translated`);
}
console.log(`\nTotal: ${total} strings translated in ${DIR}`);
