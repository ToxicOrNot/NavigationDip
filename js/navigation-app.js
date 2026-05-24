const NAV_DATA_URLS = [
	'./mpunav_mirror/external/mospolynavigation.github.io/polyna-preprocess/locationsV2.json',
	'https://mospolynavigation.github.io/polyna-preprocess/locationsV2.json',
]
const PLAN_BASE_URL = './mpunav_mirror/mpunav.ru/cdn/plans/'
const WAY_COLOR = '#3CD288'
const WAY_WIDTH = '4px'
const STAIR_UP_WEIGHT = 1085
const STAIR_DOWN_WEIGHT = 916
const ROUTEABLE_VERTEX_TYPES = new Set(['hallway', 'lift', 'stair', 'corpusTransition', 'crossingSpace'])
const SCHEDULE_API_BASE = './api/schedule'
const FAVORITE_GROUPS_STORAGE_KEY = 'navigation.favoriteScheduleGroups'
const USER_GROUP_STORAGE_KEY = 'navigation.userGroup'
const LESSON_TIMES = {
	0: {
		1: '09:00-10:30',
		2: '10:40-12:10',
		3: '12:20-13:50',
		4: '14:30-16:00',
		5: '16:10-17:40',
		6: '17:50-19:20',
		7: '19:30-21:00',
	},
	1: {
		1: '09:00-10:30',
		2: '10:40-12:10',
		3: '12:20-13:50',
		4: '14:30-16:00',
		5: '16:10-17:40',
		6: '18:20-19:40',
		7: '19:50-21:10',
	},
}
const SCHEDULE_DAY_LABELS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
const RUSSIAN_MONTH_INDEX = {
	янв: 0,
	январь: 0,
	января: 0,
	фев: 1,
	февраль: 1,
	февраля: 1,
	мар: 2,
	март: 2,
	марта: 2,
	апр: 3,
	апрель: 3,
	апреля: 3,
	май: 4,
	мая: 4,
	июн: 5,
	июнь: 5,
	июня: 5,
	июл: 6,
	июль: 6,
	июля: 6,
	авг: 7,
	август: 7,
	августа: 7,
	сен: 8,
	сентябрь: 8,
	сентября: 8,
	окт: 9,
	октябрь: 9,
	октября: 9,
	ноя: 10,
	ноябрь: 10,
	ноября: 10,
	дек: 11,
	декабрь: 11,
	декабря: 11,
}

const dom = {}
const state = {
	data: null,
	locationsById: new Map(),
	corpusesById: new Map(),
	plansById: new Map(),
	roomsById: new Map(),
	routeInputIndex: new Map(),
	availableRooms: [],
	graph: null,
	currentPlan: null,
	planModel: null,
	currentClickedRoomId: null,
	currentRoute: null,
	currentRouteStepIndex: 0,
	routeSelection: {
		fromId: undefined,
		toId: undefined,
	},
	scheduleApiCache: new Map(),
	availableGroups: [],
	groupsLoaded: false,
	scheduleMode: 'semester',
	scheduleGroupsMeta: null,
	scheduleRoomIndex: new Map(),
	currentSchedule: null,
	scheduleViewDate: formatDateKey(new Date()),
	favoriteGroups: {},
	userGroup: '',
	chatPendingIntent: null,
}

document.addEventListener('DOMContentLoaded', init)

async function init() {
	cacheDom()
	loadFavoriteGroups()
	loadUserGroup()
	hideLegacyGraphControls()
	setupStaticHandlers()
	setupScheduleHandlers()
	setupChatHandlers()
	setRouteStatus('Загрузка данных навигации...')

	try {
		state.data = await fetchFirstJson(NAV_DATA_URLS)
		prepareNavigationData()
		populateMapSelect()
		populateRoomSuggestions()
		setupRouteInputs()
		switchPlan(state.plansById.has('A-2') ? 'A-2' : state.data.plans.find(plan => plan.available)?.id)
		setRouteStatus('Выберите аудитории на карте или через поля поиска')
		showFavoriteScheduleOnStartup().catch(error => {
			console.error(error)
			showScheduleError('Не удалось автоматически загрузить расписание')
		})
	} catch (error) {
		console.error(error)
		setRouteStatus('Не удалось загрузить данные навигации')
	}
}

function cacheDom() {
	dom.sectionMain = document.querySelector('.section-main')
	dom.mapWrapper = document.querySelector('.map-wrapper')
	dom.planObject = document.querySelector('.plan-object')
	dom.waySvg = document.querySelector('.svg-way')
	dom.graphMarkers = document.querySelector('.graph-markers')
	dom.mapSelect = document.getElementById('map-select')
	dom.mapSelectLabel = document.querySelector('label[for="map-select"]')
	dom.menu = document.querySelector('.menu')
	dom.selector = document.querySelector('.selector')
	dom.buttonFrom = document.querySelector('.button-from')
	dom.buttonTo = document.querySelector('.button-to')
	dom.inputFrom = document.getElementById('input-from')
	dom.inputTo = document.getElementById('input-to')
	dom.buildButton = document.querySelector('.build-way')
	dom.eraseButton = document.querySelector('.erase')
	dom.outputWay = document.querySelector('.output-way-between-au')
	dom.menuTabs = document.querySelectorAll('.menu-tab')
	dom.menuPanels = document.querySelectorAll('.menu-panel')
	dom.groupScheduleInput = document.getElementById('input-group-schedule')
	dom.groupScheduleButton = document.querySelector('.load-group-schedule')
	dom.refreshGroupListButton = document.querySelector('.refresh-group-list')
	dom.groupSuggestions = document.getElementById('group-suggestions')
	dom.scheduleStatus = document.querySelector('.schedule-status')
	dom.scheduleOutput = document.querySelector('.schedule-output')
	dom.chatForm = document.querySelector('.chat-form')
	dom.chatInput = document.querySelector('.chat-input')
	dom.chatMessages = document.querySelector('.chat-messages')
	dom.routeDetails = document.createElement('div')
	dom.routeDetails.className = 'route-details'
	dom.outputWay.after(dom.routeDetails)
	if (dom.mapSelectLabel) dom.mapSelectLabel.textContent = 'Корпус'

	dom.floorSwitcher = document.createElement('div')
	dom.floorSwitcher.className = 'floor-switcher'
	dom.floorSwitcher.hidden = true
	dom.mapWrapper.appendChild(dom.floorSwitcher)

	dom.routePager = document.createElement('div')
	dom.routePager.className = 'route-pager'
	dom.routePager.hidden = true

	dom.routePagerPrev = document.createElement('button')
	dom.routePagerPrev.type = 'button'
	dom.routePagerPrev.className = 'route-pager-button route-pager-prev'
	dom.routePagerPrev.textContent = '←'
	dom.routePagerPrev.setAttribute('aria-label', 'Предыдущий участок маршрута')
	dom.routePagerPrev.addEventListener('click', () => showRouteStep(state.currentRouteStepIndex - 1))
	dom.routePager.appendChild(dom.routePagerPrev)

	dom.routePagerStatus = document.createElement('div')
	dom.routePagerStatus.className = 'route-pager-status'
	dom.routePager.appendChild(dom.routePagerStatus)

	dom.routePagerNext = document.createElement('button')
	dom.routePagerNext.type = 'button'
	dom.routePagerNext.className = 'route-pager-button route-pager-next'
	dom.routePagerNext.textContent = '→'
	dom.routePagerNext.setAttribute('aria-label', 'Следующий участок маршрута')
	dom.routePagerNext.addEventListener('click', () => showRouteStep(state.currentRouteStepIndex + 1))
	dom.routePager.appendChild(dom.routePagerNext)

	dom.mapWrapper.appendChild(dom.routePager)
}

function hideLegacyGraphControls() {
	for (const selector of [
		'.tracing',
		'.create-list-of-vertexes',
		'.fill-graph',
		'.fill-auditoriums-vertexes',
		'.tracing-cross',
		'.hide-graph',
		'.show-graph',
		'.select-points',
	]) {
		const element = document.querySelector(selector)
		if (element) element.style.display = 'none'
	}
}

function setupStaticHandlers() {
	dom.planObject.addEventListener('load', onPlanObjectLoad)
	dom.mapSelect.addEventListener('change', event => switchCorpus(event.target.value))
	dom.buttonFrom.addEventListener('click', () => selectClickedRoomAs('from'))
	dom.buttonTo.addEventListener('click', () => selectClickedRoomAs('to'))
	dom.buildButton.addEventListener('click', event => {
		event.preventDefault()
		buildRouteBetweenSelectedRooms()
	})
	dom.eraseButton.addEventListener('click', clearRoute)

	dom.menuTabs.forEach(tab => {
		tab.addEventListener('click', () => activateMenuTab(tab.dataset.tab))
	})

	new DragHandler(
		document.querySelector('.drag-able'),
		document.querySelector('.scale-able'),
		document.querySelector('.map-wrapper'),
		document.querySelector('.button-plus'),
		document.querySelector('.button-minus')
	)
}

function setupChatHandlers() {
	if (!dom.chatForm || !dom.chatInput || !dom.chatMessages) return

	dom.chatForm.addEventListener('submit', event => {
		event.preventDefault()
		sendChatMessage()
	})

	dom.chatInput.addEventListener('keydown', event => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault()
			sendChatMessage()
		}
	})
}

async function sendChatMessage() {
	const text = dom.chatInput.value.trim()
	if (!text) return

	appendChatMessage('user', text)
	dom.chatInput.value = ''
	dom.chatInput.disabled = true
	if (dom.chatForm) dom.chatForm.classList.add('chat-form-loading')

	try {
		const response = await handleChatMessage(text)
		for (const message of Array.isArray(response) ? response : [response]) {
			if (message) appendChatMessage('bot', message)
		}
	} catch (error) {
		console.error(error)
		appendChatMessage('bot', 'Не удалось обработать запрос. Проверьте, что локальный сервер запущен через node server.js.')
	} finally {
		dom.chatInput.disabled = false
		if (dom.chatForm) dom.chatForm.classList.remove('chat-form-loading')
		dom.chatInput.focus()
	}
}

function appendChatMessage(role, text) {
	const message = document.createElement('div')
	message.className = `chat-message ${role === 'user' ? 'user-message' : 'bot-message'}`

	const author = document.createElement('div')
	author.className = 'chat-message-author'
	author.textContent = role === 'user' ? 'Вы' : 'Бот'
	message.appendChild(author)

	const body = document.createElement('div')
	body.className = 'chat-message-text'
	body.textContent = text
	message.appendChild(body)

	dom.chatMessages.appendChild(message)
	dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight
}

async function handleChatMessage(userText) {
	const pendingIntent = state.chatPendingIntent
	if (pendingIntent?.type === 'schedule-group') {
		const groupName = await resolveChatGroupName(extractChatGroupName(userText) || userText)
		if (!groupName) {
			return 'Не нашел такую группу. Напишите номер группы в формате 241-114.'
		}

		state.chatPendingIntent = null
		setUserGroup(groupName)
		return executeChatIntent({...pendingIntent.intent, groupName})
	}

	let explicitGroupName = ''
	const explicitGroup = extractChatGroupName(userText)
	if (explicitGroup) {
		const groupName = await resolveChatGroupName(explicitGroup)
		if (groupName) {
			setUserGroup(groupName)
			explicitGroupName = groupName
		}
	}

	const intent = parseChatIntent(userText)
	if (!intent) {
		if (explicitGroupName) {
			return `Запомнил группу ${explicitGroupName}. Теперь могу отвечать по ее расписанию.`
		}
		return [
			'Я могу построить маршрут, найти аудиторию на карте и ответить по расписанию.',
			'Примеры: «как пройти из В-202 в Н-304», «какая следующая пара», «сколько пар завтра», «где Н-202».',
		]
	}

	if (intent.requiresGroup) {
		return executeScheduleChatIntent(intent, userText)
	}

	return executeChatIntent(intent)
}

function parseChatIntent(userText) {
	const text = normalizeChatText(userText)
	const roomRefs = extractChatRoomRefs(userText)

	if (roomRefs.length >= 2 && isRouteChatText(text)) {
		return {
			type: 'route',
			fromToken: roomRefs[0],
			toToken: roomRefs[1],
		}
	}

	if (roomRefs.length === 1 && isRoomLocationChatText(text)) {
		return {
			type: 'room-location',
			roomToken: roomRefs[0],
		}
	}

	if (isNextLessonRouteChatText(text)) {
		return {
			type: 'next-lesson-route',
			requiresGroup: true,
		}
	}

	if (isNextLessonChatText(text)) {
		return {
			type: 'next-lesson',
			requiresGroup: true,
		}
	}

	if (isLessonListChatText(text)) {
		return {
			type: text.includes('сколько') ? 'lesson-count' : 'lesson-list',
			dayRef: parseChatDayReference(text),
			requiresGroup: true,
		}
	}

	if (isSubjectTimeChatText(text)) {
		const dayRef = parseChatDayReference(text)
		return {
			type: 'subject-time',
			dayRef,
			subjectQuery: extractSubjectQuery(userText, dayRef),
			requiresGroup: true,
		}
	}

	return null
}

function isRouteChatText(text) {
	return /(^|\s)(из|от)\s/.test(text)
		|| /\s(в|до|к)\s/.test(text)
		|| /(маршрут|пройти|попасть|добраться|дойти|проведи|построи)/.test(text)
}

function isRoomLocationChatText(text) {
	return /(где|найди|покажи|находится|карте|аудитори)/.test(text)
}

function isNextLessonRouteChatText(text) {
	return /(где|куда|маршрут|пройти|попасть|добраться)/.test(text)
		&& /(следующ|ближайш)/.test(text)
		&& /(пара|занят|лекц|практик|семинар)/.test(text)
}

function isNextLessonChatText(text) {
	return /(какая|что|когда|следующ|ближайш)/.test(text)
		&& /(следующ|ближайш)/.test(text)
		&& /(пара|занят|лекц|практик|семинар)/.test(text)
}

function isLessonListChatText(text) {
	return /(сколько|какие|какая|расписание|пары|занятия)/.test(text)
		&& /(пар|пары|занят|расписание)/.test(text)
		&& (parseChatDayReference(text) || /(сегодня|завтра)/.test(text))
}

function isSubjectTimeChatText(text) {
	return /(во сколько|когда)/.test(text)
		&& !/(следующ|ближайш)/.test(text)
}

async function executeScheduleChatIntent(intent, userText) {
	const explicitGroup = extractChatGroupName(userText)
	let groupName = explicitGroup
		? await resolveChatGroupName(explicitGroup)
		: state.userGroup
	if (groupName) {
		groupName = await resolveChatGroupName(groupName)
	}

	if (!groupName) {
		state.chatPendingIntent = {
			type: 'schedule-group',
			intent,
		}
		return 'Для какой группы смотреть расписание? Напишите номер группы, например 241-114.'
	}

	return executeChatIntent({...intent, groupName})
}

async function executeChatIntent(intent) {
	switch (intent.type) {
		case 'route':
			return executeRouteChatIntent(intent)
		case 'room-location':
			return executeRoomLocationChatIntent(intent)
		case 'next-lesson':
			return executeNextLessonChatIntent(intent)
		case 'next-lesson-route':
			return executeNextLessonRouteChatIntent(intent)
		case 'lesson-count':
		case 'lesson-list':
			return executeDayLessonsChatIntent(intent)
		case 'subject-time':
			return executeSubjectTimeChatIntent(intent)
		default:
			return 'Я не понял запрос. Попробуйте написать проще: «как пройти из В-202 в Н-304» или «какая следующая пара».'
	}
}

function executeRouteChatIntent(intent) {
	const fromRoom = resolveChatRoom(intent.fromToken)
	const toRoom = resolveChatRoom(intent.toToken)

	if (!fromRoom || !toRoom) {
		return 'Не смог распознать одну из аудиторий. Напишите их как В-202, Н-304 или ПК-610.'
	}

	return buildChatRoute(fromRoom.id, toRoom.id)
}

function executeRoomLocationChatIntent(intent) {
	const room = resolveChatRoom(intent.roomToken)
	if (!room) return 'Не нашел такую аудиторию на карте. Попробуйте формат Н-202 или ПК-610.'

	activateMenuTab('navigation')
	showScheduleRoomOnMap(room.id)
	const plan = state.plansById.get(room.planId)
	return `${getRoomDisplayName(room)} показана на карте: ${getPlanFullLabel(plan)}.`
}

async function executeNextLessonChatIntent(intent) {
	const schedule = await fetchChatSchedule(intent.groupName)
	const slot = findNextScheduleSlot(schedule)
	if (!slot) return `В ближайшие дни у группы ${intent.groupName} пар не найдено.`

	const prefix = slot.startAt <= new Date() && slot.endAt > new Date()
		? 'Сейчас идет'
		: 'Следующая пара'
	return `${prefix} у группы ${intent.groupName}: ${formatScheduleSlot(slot)}.`
}

async function executeNextLessonRouteChatIntent(intent) {
	const schedule = await fetchChatSchedule(intent.groupName)
	const {previousSlot, nextSlot} = findPreviousAndNextScheduleSlots(schedule)
	if (!nextSlot) return `В ближайшие дни у группы ${intent.groupName} следующая пара не найдена.`

	const nextRoom = getPrimaryRoomFromSlot(nextSlot)
	if (!previousSlot) {
		if (nextRoom) {
			activateMenuTab('navigation')
			showScheduleRoomOnMap(nextRoom.id)
		}
		return `Следующая пара у группы ${intent.groupName}: ${formatScheduleSlot(nextSlot)}. Предыдущую пару для маршрута я не нашел.`
	}

	const previousRoom = getPrimaryRoomFromSlot(previousSlot)
	if (!previousRoom || !nextRoom) {
		return `Следующая пара: ${formatScheduleSlot(nextSlot)}. Не удалось распознать аудиторию предыдущей или следующей пары для маршрута.`
	}

	buildChatRoute(previousRoom.id, nextRoom.id)
	return `Построил маршрут от прошлой пары (${formatScheduleSlot(previousSlot)}) до следующей (${formatScheduleSlot(nextSlot)}).`
}

async function executeDayLessonsChatIntent(intent) {
	const schedule = await fetchChatSchedule(intent.groupName)
	const targetDate = getDateForChatDayReference(intent.dayRef)
	const slots = getScheduleSlotsForDate(schedule, targetDate)
	const dayLabel = formatChatDay(targetDate)

	if (!slots.length) return `${capitalizeFirst(dayLabel)} у группы ${intent.groupName} пар нет.`

	if (intent.type === 'lesson-count') {
		return `${capitalizeFirst(dayLabel)} у группы ${intent.groupName} ${slots.length} ${pluralizePairs(slots.length)}: ${slots.map(formatCompactScheduleSlot).join('; ')}.`
	}

	return `${capitalizeFirst(dayLabel)} у группы ${intent.groupName}: ${slots.map(formatCompactScheduleSlot).join('; ')}.`
}

async function executeSubjectTimeChatIntent(intent) {
	if (!intent.subjectQuery) {
		return 'Напишите название дисциплины, например: «Во сколько иностранный язык?»'
	}

	const schedule = await fetchChatSchedule(intent.groupName)
	const targetDate = getDateForChatDayReference(intent.dayRef)
	const slots = getScheduleSlotsForDate(schedule, targetDate)
	const query = normalizeChatText(intent.subjectQuery)
	const matches = slots.filter(slot => {
		return slot.entries.some(entry => normalizeChatText(entry.subject).includes(query))
	})
	const dayLabel = formatChatDay(targetDate)

	if (!matches.length) {
		return `${capitalizeFirst(dayLabel)} у группы ${intent.groupName} я не нашел дисциплину «${intent.subjectQuery}».`
	}

	return `${capitalizeFirst(intent.subjectQuery)} ${dayLabel}: ${matches.map(formatCompactScheduleSlot).join('; ')}.`
}

function buildChatRoute(fromRoomId, toRoomId) {
	state.routeSelection.fromId = fromRoomId
	state.routeSelection.toId = toRoomId
	updateRouteInputsFromSelection()
	buildRouteBetweenSelectedRooms()
	activateMenuTab('navigation')

	const fromRoom = state.roomsById.get(fromRoomId)
	const toRoom = state.roomsById.get(toRoomId)
	if (!state.currentRoute) {
		return `Не удалось построить маршрут из ${getRoomDisplayName(fromRoom)} в ${getRoomDisplayName(toRoom)}.`
	}

	return `Маршрут построен: ${getRoomDisplayName(fromRoom)} -> ${getRoomDisplayName(toRoom)}.`
}

async function fetchChatSchedule(groupName) {
	const resolvedGroupName = await resolveChatGroupName(groupName)
	if (!resolvedGroupName) throw new Error(`Unknown group: ${groupName}`)

	const schedule = await fetchScheduleApi('group', {
		group: resolvedGroupName,
		session: getScheduleSessionFlag(),
	})
	if (schedule.status === 'error') {
		throw new Error(schedule.message || 'Schedule not found')
	}
	return schedule
}

async function resolveChatGroupName(value) {
	await loadAvailableGroups()
	const group = resolveSelectedGroup(value)
	return group?.name || null
}

function extractChatGroupName(text) {
	const match = String(text || '').match(/\b(\d{3})\s*[-–—−]?\s*(\d{3})\b/u)
	return match ? `${match[1]}-${match[2]}` : ''
}

function extractChatRoomRefs(text) {
	const refs = []
	const pattern = /(?:^|[^\p{L}\p{N}])((?:ав|пр|пк|нд|av|pr|pk|nd|[абвнмabvnm])\s*[-–—−]?\s*\d{2,4}[a-zа-я]?)(?=$|[^\p{L}\p{N}])/giu
	for (const match of String(text || '').matchAll(pattern)) {
		refs.push(cleanScheduleText(match[1]))
	}
	return uniqueValues(refs)
}

function resolveChatRoom(roomToken) {
	for (const candidate of getChatRoomCandidates(roomToken)) {
		const scheduleRoom = resolveScheduleAuditory(candidate)
		if (scheduleRoom) return scheduleRoom

		const roomId = resolveRoomInput(candidate)
		if (roomId) return state.roomsById.get(roomId)
	}
	return null
}

function getChatRoomCandidates(roomToken) {
	const token = cleanScheduleText(roomToken).replace(/[–—−]/g, '-')
	const compact = token.replace(/\s+/g, '')
	const spaced = token.replace(/\s*-\s*/g, '-')
	const split = compact.match(/^([a-zа-я]+)-?(\d+[a-zа-я]?)$/iu)
	const candidates = [token, compact, spaced]
	if (split) {
		candidates.push(`${split[1]}-${split[2]}`, `${split[1]} ${split[2]}`)
	}
	return uniqueValues(candidates)
}

function normalizeChatText(value = '') {
	return String(value || '')
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[–—−]/g, '-')
		.replace(/[^\p{L}\p{N}-]+/giu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function parseChatDayReference(text) {
	const normalized = normalizeChatText(text)
	if (hasChatPhrase(normalized, 'сегодня')) return {type: 'today'}
	if (hasChatPhrase(normalized, 'завтра')) return {type: 'tomorrow'}

	const weekdays = [
		['понедельник', 'понедельника', 'пн'],
		['вторник', 'вторника', 'вт'],
		['среда', 'среду', 'ср'],
		['четверг', 'четверга', 'чт'],
		['пятница', 'пятницу', 'пт'],
		['суббота', 'субботу', 'сб'],
		['воскресенье', 'воскресение', 'вс'],
	]
	for (let index = 0; index < weekdays.length; index++) {
		if (weekdays[index].some(alias => new RegExp(`(^|\\s)${alias}(\\s|$)`, 'u').test(normalized))) {
			return {type: 'weekday', index}
		}
	}
	return null
}

function getDateForChatDayReference(dayRef, baseDate = new Date()) {
	const date = new Date(baseDate)
	date.setHours(0, 0, 0, 0)

	if (!dayRef || dayRef.type === 'today') return date
	if (dayRef.type === 'tomorrow') {
		date.setDate(date.getDate() + 1)
		return date
	}
	if (dayRef.type === 'weekday') {
		const currentIndex = getScheduleWeekdayIndex(date)
		const offset = (dayRef.index - currentIndex + 7) % 7
		date.setDate(date.getDate() + offset)
		return date
	}
	return date
}

function extractSubjectQuery(userText, dayRef) {
	let text = normalizeChatText(userText)
	text = text.replace(/\b\d{3}\s*-?\s*\d{3}\b/u, ' ')
	for (const phrase of [
		'во сколько',
		'когда',
		'у меня',
		'у группы',
		'будет',
		'начинается',
		'пара',
		'пары',
		'занятие',
		'занятия',
		'предмет',
		'дисциплина',
		'сегодня',
		'завтра',
		'в',
		'во',
		'на',
	]) {
		text = removeChatPhrase(text, phrase)
	}

	if (dayRef?.type === 'weekday') {
		for (const alias of getWeekdayAliases(dayRef.index)) {
			text = text.replace(new RegExp(`(^|\\s)${alias}(\\s|$)`, 'gu'), ' ')
		}
	}

	return text.replace(/\s+/g, ' ').trim()
}

function hasChatPhrase(text, phrase) {
	return new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, 'u').test(text)
}

function removeChatPhrase(text, phrase) {
	return text.replace(new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, 'gu'), ' ')
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getWeekdayAliases(index) {
	return [
		['понедельник', 'понедельника', 'пн'],
		['вторник', 'вторника', 'вт'],
		['среда', 'среду', 'ср'],
		['четверг', 'четверга', 'чт'],
		['пятница', 'пятницу', 'пт'],
		['суббота', 'субботу', 'сб'],
		['воскресенье', 'воскресение', 'вс'],
	][index] || []
}

function findNextScheduleSlot(schedule, baseDate = new Date()) {
	for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
		const date = new Date(baseDate)
		date.setDate(date.getDate() + dayOffset)
		const slots = getScheduleSlotsForDate(schedule, date)
		for (const slot of slots) {
			if (slot.endAt > baseDate) return slot
		}
	}
	return null
}

function findPreviousAndNextScheduleSlots(schedule, baseDate = new Date()) {
	const slots = []
	for (let dayOffset = -14; dayOffset <= 14; dayOffset++) {
		const date = new Date(baseDate)
		date.setDate(date.getDate() + dayOffset)
		slots.push(...getScheduleSlotsForDate(schedule, date))
	}

	const previousSlot = slots.filter(slot => slot.startAt <= baseDate).at(-1) || null
	const nextSlot = slots.find(slot => slot.startAt > baseDate) || null
	return {previousSlot, nextSlot}
}

function getScheduleSlotsForDate(schedule, date) {
	const group = schedule.group || {}
	const grid = schedule.grid || {}
	const isSessionGrid = Boolean(schedule.isSession) || getScheduleSessionFlag() === 1
	const dayKey = isSessionGrid ? formatDateKey(date) : String(getScheduleWeekdayIndex(date) + 1)
	const entries = collectScheduleEntries(grid?.[dayKey], group)
		.filter(entry => isScheduleEntryActiveOnDate(entry, date))
	const slotsByLesson = new Map()

	for (const entry of entries) {
		const timeRange = parseLessonTimeRange(entry.time)
		if (!timeRange) continue

		const key = `${entry.lessonNumber}|${entry.time}`
		if (!slotsByLesson.has(key)) {
			slotsByLesson.set(key, {
				date: normalizeDateOnly(date),
				lessonNumber: entry.lessonNumber,
				time: entry.time,
				startAt: createDateWithMinutes(date, timeRange.start),
				endAt: createDateWithMinutes(date, timeRange.end),
				entries: [],
			})
		}
		slotsByLesson.get(key).entries.push(entry)
	}

	return [...slotsByLesson.values()].sort((slotA, slotB) => slotA.startAt - slotB.startAt)
}

function isScheduleEntryActiveOnDate(entry, date) {
	const range = parseScheduleDateRange(entry.dateRange, date)
	if (!range) return true
	const day = normalizeDateOnly(date).getTime()
	return day >= range.start.getTime() && day <= range.end.getTime()
}

function parseScheduleDateRange(dateRange, referenceDate) {
	const text = normalizeChatText(dateRange)
	if (!text) return null

	const matches = [...text.matchAll(/(\d{1,2})(?:\s+|\.)([а-я]+|\d{1,2})(?:\s+|\.|-)?(\d{4})?/giu)]
	if (matches.length < 2) return null

	const start = parseScheduleDateMatch(matches[0], referenceDate)
	const end = parseScheduleDateMatch(matches[1], referenceDate)
	if (!start || !end) return null
	if (end < start) end.setFullYear(end.getFullYear() + 1)

	return {start, end}
}

function parseScheduleDateMatch(match, referenceDate) {
	const day = Number(match[1])
	const monthValue = match[2]
	const month = /^\d+$/.test(monthValue)
		? Number(monthValue) - 1
		: RUSSIAN_MONTH_INDEX[monthValue.slice(0, 3)] ?? RUSSIAN_MONTH_INDEX[monthValue]
	const year = Number(match[3]) || referenceDate.getFullYear()

	if (!Number.isFinite(day) || !Number.isFinite(month) || month < 0 || month > 11) return null
	return normalizeDateOnly(new Date(year, month, day))
}

function parseLessonTimeRange(time) {
	const match = String(time || '').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
	if (!match) return null

	return {
		start: Number(match[1]) * 60 + Number(match[2]),
		end: Number(match[3]) * 60 + Number(match[4]),
	}
}

function createDateWithMinutes(date, minutes) {
	const result = normalizeDateOnly(date)
	result.setMinutes(minutes)
	return result
}

function normalizeDateOnly(date) {
	const result = new Date(date)
	result.setHours(0, 0, 0, 0)
	return result
}

function getScheduleWeekdayIndex(date) {
	return (date.getDay() + 6) % 7
}

function formatDateKey(date) {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function getPrimaryRoomFromSlot(slot) {
	for (const entry of slot?.entries || []) {
		for (const auditory of entry.auditories || []) {
			if (auditory.roomId) return state.roomsById.get(auditory.roomId)
		}
	}
	return null
}

function formatScheduleSlot(slot) {
	const subjects = uniqueValues(slot.entries.map(entry => entry.subject)).join(', ')
	const rooms = getSlotRoomLabels(slot)
	const roomText = rooms.length
		? `, ${rooms.length === 1 ? 'кабинет' : 'кабинеты'} ${rooms.join(', ')}`
		: ''
	return `${formatChatDay(slot.date)}, ${slot.lessonNumber} пара (${slot.time}) - ${subjects}${roomText}`
}

function formatCompactScheduleSlot(slot) {
	const subjects = uniqueValues(slot.entries.map(entry => entry.subject)).join(', ')
	return `${slot.lessonNumber} пара ${slot.time} - ${subjects}`
}

function getSlotRoomLabels(slot) {
	const labels = []
	for (const entry of slot.entries || []) {
		for (const auditory of entry.auditories || []) {
			labels.push(auditory.roomTitle || auditory.label)
		}
	}
	return uniqueValues(labels.filter(Boolean))
}

function formatChatDay(date, baseDate = new Date()) {
	const target = normalizeDateOnly(date).getTime()
	const today = normalizeDateOnly(baseDate).getTime()
	const tomorrow = today + 24 * 60 * 60 * 1000
	if (target === today) return 'сегодня'
	if (target === tomorrow) return 'завтра'
	return SCHEDULE_DAY_LABELS[getScheduleWeekdayIndex(date)].toLowerCase()
}

function pluralizePairs(count) {
	const mod10 = count % 10
	const mod100 = count % 100
	if (mod10 === 1 && mod100 !== 11) return 'пара'
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'пары'
	return 'пар'
}

function capitalizeFirst(value = '') {
	return value ? value[0].toUpperCase() + value.slice(1) : ''
}

function setupRouteInputs() {
	const datalist = document.createElement('datalist')
	datalist.id = 'room-suggestions'
	document.body.appendChild(datalist)

	for (const room of state.availableRooms) {
		const label = getRoomInputLabel(room)
		const option = document.createElement('option')
		option.value = label
		datalist.appendChild(option)
		state.routeInputIndex.set(normalizeSearch(label), room.id)
		state.routeInputIndex.set(normalizeSearch(room.id), room.id)
	}

	for (const input of [dom.inputFrom, dom.inputTo]) {
		input.setAttribute('list', 'room-suggestions')
		input.removeAttribute('readonly')
		input.addEventListener('change', () => {
			if (applyRouteInput(input)) buildRouteIfReady()
		})
		input.addEventListener('input', () => {
			const roomId = resolveRoomInput(input.value)
			if (!roomId) return
			if (applyRouteInput(input)) buildRouteIfReady()
		})
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault()
				if (applyRouteInput(input)) buildRouteIfReady()
			}
		})
	}
	updateRouteControlsState()
}

function prepareNavigationData() {
	state.locationsById = byId(state.data.locations)
	state.corpusesById = byId(state.data.corpuses)
	state.plansById = byId(state.data.plans)
	state.roomsById = byId(state.data.rooms)

	for (const corpus of state.data.corpuses) {
		corpus.location = state.locationsById.get(corpus.locationId)
	}

	for (const plan of state.data.plans) {
		plan.corpus = state.corpusesById.get(plan.corpusId)
		plan.location = plan.corpus?.location
		plan.rooms = state.data.rooms.filter(room => room.planId === plan.id)
	}

	state.graph = new NavigationGraph(state.data)
	state.availableRooms = state.data.rooms
		.filter(room => room.available !== false)
		.filter(room => state.plansById.get(room.planId)?.available !== false)
		.filter(room => state.graph.findVertexById(room.id))
		.sort((a, b) => getRoomInputLabel(a).localeCompare(getRoomInputLabel(b), 'ru'))
}

function byId(items) {
	return new Map(items.map(item => [item.id, item]))
}

async function fetchFirstJson(urls) {
	let lastError
	for (const url of urls) {
		try {
			const response = await fetch(url)
			if (!response.ok) throw new Error(`${url}: ${response.status}`)
			return await response.json()
		} catch (error) {
			lastError = error
		}
	}
	throw lastError || new Error('No data urls configured')
}

function populateMapSelect() {
	dom.mapSelect.replaceChildren()

	for (const location of state.data.locations.filter(location => location.available !== false)) {
		const corpuses = state.data.corpuses
			.filter(corpus => corpus.available !== false && corpus.location?.id === location.id)
			.filter(corpus => getAvailablePlansForCorpus(corpus.id).length)
		if (!corpuses.length) continue

		const group = document.createElement('optgroup')
		group.label = `${location.short} · ${location.title}`
		for (const corpus of corpuses) {
			const option = document.createElement('option')
			option.value = corpus.id
			option.textContent = getCorpusLabel(corpus)
			group.appendChild(option)
		}
		dom.mapSelect.appendChild(group)
	}
}

function populateRoomSuggestions() {
	state.routeInputIndex.clear()
}

function switchCorpus(corpusId) {
	const plan = getPreferredPlanForCorpus(corpusId)
	if (plan) switchPlan(plan.id)
}

function switchPlan(planId) {
	const plan = state.plansById.get(planId)
	if (!plan) return

	state.currentPlan = plan
	dom.mapSelect.value = plan.corpusId
	renderFloorSwitcher()
	hideRoomSelector()
	clearPlanRender()
	setRouteStatus(`Загрузка карты: ${getPlanLabel(plan)}`)
	dom.planObject.data = `${PLAN_BASE_URL}${plan.wayToSvg}`
}

function renderFloorSwitcher() {
	dom.floorSwitcher.replaceChildren()

	if (!state.currentPlan) {
		dom.floorSwitcher.hidden = true
		return
	}

	const plans = getAvailablePlansForCorpus(state.currentPlan.corpusId)
	dom.floorSwitcher.hidden = !plans.length

	for (const plan of plans) {
		const button = document.createElement('button')
		button.type = 'button'
		button.className = 'floor-button'
		button.classList.toggle('active-floor', plan.id === state.currentPlan.id)
		button.textContent = getFloorButtonLabel(plan)
		button.title = getPlanFullLabel(plan)
		button.setAttribute('aria-label', getPlanFullLabel(plan))
		button.addEventListener('click', () => switchPlan(plan.id))
		dom.floorSwitcher.appendChild(button)
	}
}

function onPlanObjectLoad() {
	if (!state.currentPlan || !dom.planObject.contentDocument?.documentElement) return

	const planDocument = dom.planObject.contentDocument
	const svgPlan = planDocument.documentElement.cloneNode(true)
	for (const oldPlan of document.querySelectorAll('.plan')) oldPlan.remove()

	svgPlan.removeAttribute('width')
	svgPlan.removeAttribute('height')
	svgPlan.classList.add('plan')
	dom.planObject.before(svgPlan)
	planDocument.documentElement.remove()

	setupWaySvg(svgPlan)
	state.planModel = new PlanModel(state.currentPlan, svgPlan)
	state.planModel.syncSelection()
	drawCurrentRouteSegments()

	if (!state.currentRoute) {
		setRouteStatus('Выберите аудитории на карте или через поля поиска')
	}
}

function clearPlanRender() {
	for (const oldPlan of document.querySelectorAll('.plan')) oldPlan.remove()
	const defs = dom.waySvg.querySelector('defs')
	if (defs) dom.waySvg.replaceChildren(defs)
	else dom.waySvg.replaceChildren()
	dom.graphMarkers.replaceChildren()
}

function setupWaySvg(svgPlan) {
	const viewBox = svgPlan.getAttribute('viewBox')
	if (viewBox) {
		dom.waySvg.setAttribute('viewBox', viewBox)
		dom.graphMarkers.setAttribute('viewBox', viewBox)
	}
}

function onRoomClicked(roomId, event) {
	state.currentClickedRoomId = roomId
	state.planModel?.syncSelection(roomId)
	showRoomSelector(event, roomId)
}

function showRoomSelector(event, roomId) {
	if (!event) return

	const room = state.roomsById.get(roomId)
	dom.selector.style.left = `${event.clientX}px`
	dom.selector.style.top = `${event.clientY}px`
	dom.selector.classList.remove('hidden-selector')
	dom.selector.classList.add('showing-selector')
	dom.selector.setAttribute('auID', roomId)
	dom.buttonFrom.classList.toggle('non-active-button', state.routeSelection.fromId === roomId)
	dom.buttonTo.classList.toggle('non-active-button', state.routeSelection.toId === roomId)
	dom.buttonFrom.title = room ? `Отсюда: ${getRoomDisplayName(room)}` : ''
	dom.buttonTo.title = room ? `Сюда: ${getRoomDisplayName(room)}` : ''
}

function hideRoomSelector() {
	dom.selector.classList.remove('showing-selector')
	dom.selector.classList.add('hidden-selector')
}

function selectClickedRoomAs(direction) {
	const roomId = state.currentClickedRoomId
	if (!roomId) return

	setRouteRoom(roomId, direction, {switchToRoomPlan: false})
}

function setRouteRoom(roomId, direction, options = {}) {
	if (direction === 'from') state.routeSelection.fromId = roomId
	if (direction === 'to') state.routeSelection.toId = roomId

	updateRouteInputsFromSelection()
	hideRoomSelector()
	const room = state.roomsById.get(roomId)
	if (options.switchToRoomPlan !== false && room?.planId && room.planId !== state.currentPlan?.id) {
		switchPlan(room.planId)
	} else {
		state.planModel?.syncSelection()
	}
	updateRouteControlsState()

	if (options.source === 'schedule') {
		dom.scheduleStatus.textContent = `${getRoomDisplayName(room)} выбрана как ${direction === 'from' ? 'точка отправления' : 'точка назначения'}`
	}

	buildRouteIfReady()
}

function applyRouteInput(input) {
	const direction = input === dom.inputFrom ? 'fromId' : 'toId'
	if (!input.value.trim()) {
		state.routeSelection[direction] = undefined
		state.currentRoute = null
		state.currentRouteStepIndex = 0
		clearRouteDrawing()
		updateRoutePager()
		state.planModel?.syncSelection()
		updateRouteControlsState()
		return false
	}

	const roomId = resolveRoomInput(input.value)
	if (!roomId) {
		updateRouteControlsState()
		return false
	}

	state.routeSelection[direction] = roomId
	updateRouteInputsFromSelection()
	state.planModel?.syncSelection()
	updateRouteControlsState()
	return true
}

function resolveRoomInput(value) {
	const normalized = normalizeSearch(value)
	if (!normalized) return undefined
	if (state.routeInputIndex.has(normalized)) return state.routeInputIndex.get(normalized)

	const matches = state.availableRooms.filter(room => {
		return normalizeSearch(getRoomDisplayName(room)) === normalized
			|| normalizeSearch(room.id) === normalized
			|| normalizeSearch(getRoomInputLabel(room)).includes(normalized)
	})
	return matches.length === 1 ? matches[0].id : undefined
}

function updateRouteInputsFromSelection() {
	dom.inputFrom.value = state.routeSelection.fromId
		? getRoomInputLabel(state.roomsById.get(state.routeSelection.fromId))
		: ''
	dom.inputTo.value = state.routeSelection.toId
		? getRoomInputLabel(state.roomsById.get(state.routeSelection.toId))
		: ''
}

function updateRouteControlsState() {
	const hasFrom = Boolean(state.routeSelection.fromId)
	const hasTo = Boolean(state.routeSelection.toId)
	dom.buildButton.classList.toggle('non-active-button', !(hasFrom && hasTo))
	dom.eraseButton.classList.toggle('non-active-button', !(hasFrom || hasTo || state.currentRoute))
	refreshScheduleRouteButtons()
}

function buildRouteIfReady() {
	if (state.routeSelection.fromId && state.routeSelection.toId) {
		buildRouteBetweenSelectedRooms()
	}
}

function buildRouteBetweenSelectedRooms() {
	applyRouteInput(dom.inputFrom)
	applyRouteInput(dom.inputTo)

	const fromId = state.routeSelection.fromId
	const toId = state.routeSelection.toId

	if (!fromId || !toId) {
		state.currentRoute = null
		state.currentRouteStepIndex = 0
		setRouteStatus('Выберите две аудитории')
		clearRouteDrawing()
		updateRoutePager()
		updateRouteControlsState()
		return
	}
	if (fromId === toId) {
		state.currentRoute = null
		state.currentRouteStepIndex = 0
		setRouteStatus('Выбрана одна и та же аудитория')
		clearRouteDrawing()
		updateRoutePager()
		updateRouteControlsState()
		return
	}

	const result = state.graph.getShortestWayFromTo(fromId, toId)
	if (!result.way.length || !Number.isFinite(result.distance)) {
		state.currentRoute = null
		state.currentRouteStepIndex = 0
		setRouteStatus('Маршрут не найден')
		clearRouteDrawing()
		updateRoutePager()
		updateRouteControlsState()
		return
	}

	state.currentRoute = {
		fromId,
		toId,
		distance: result.distance,
		way: result.way,
		steps: buildRouteSteps(result.way),
	}
	state.currentRouteStepIndex = 0

	renderRouteSummary()
	showRouteStep(0)
	updateRouteControlsState()
}

function buildRouteSteps(way) {
	const steps = []
	let currentStep = null

	for (const vertex of way) {
		if (!vertex.plan) continue
		if (!currentStep || currentStep.plan.id !== vertex.plan.id) {
			currentStep = {
				plan: vertex.plan,
				way: [vertex],
				distance: 0,
			}
			steps.push(currentStep)
			continue
		}

		const previousVertex = currentStep.way[currentStep.way.length - 1]
		currentStep.distance += state.graph.getDistanceBetween2Vertexes(previousVertex, vertex.id) || getEuclideanDistance(previousVertex, vertex)
		currentStep.way.push(vertex)
	}

	const visibleSteps = steps.filter((step, index) => shouldShowRouteStep(step, index, steps))
	return visibleSteps.length ? visibleSteps : steps.filter(step => step.way.length > 0)
}

function shouldShowRouteStep(step, index, steps) {
	if (!step?.way?.length) return false
	if (index === 0 || index === steps.length - 1) return true
	if (step.way.length < 2) return false

	return getPolylineDistance(step.way) > 1
}

function renderRouteSummary() {
	const fromRoom = state.roomsById.get(state.currentRoute.fromId)
	const toRoom = state.roomsById.get(state.currentRoute.toId)
	dom.outputWay.textContent = `${getRoomDisplayName(fromRoom)} -> ${getRoomDisplayName(toRoom)} · длина: ${state.currentRoute.distance}`
	dom.routeDetails.replaceChildren()

	state.currentRoute.steps.forEach((step, index) => {
		const button = document.createElement('button')
		button.type = 'button'
		button.className = 'route-step'
		button.classList.toggle('active-route-step', index === state.currentRouteStepIndex)
		button.textContent = `${index + 1}. ${getPlanFullLabel(step.plan)} · ${Math.floor(step.distance)}`
		button.addEventListener('click', () => showRouteStep(index))
		dom.routeDetails.appendChild(button)
	})

	updateRoutePager()
}

function drawCurrentRouteSegments() {
	clearRouteDrawing()
	if (!state.currentRoute || !state.currentPlan) return

	syncRouteStepIndexWithCurrentPlan()

	const activeStep = state.currentRoute.steps[state.currentRouteStepIndex]
	const steps = activeStep?.plan.id === state.currentPlan.id
		? [activeStep]
		: state.currentRoute.steps.filter(step => step.plan.id === state.currentPlan.id)
	for (const step of steps) {
		if (step.way.length < 2) continue

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
		path.classList.add('way-path')
		path.setAttribute('d', verticesToPathD(step.way))
		path.setAttribute('fill', 'none')
		path.setAttribute('stroke', WAY_COLOR)
		path.setAttribute('stroke-width', WAY_WIDTH)
		path.setAttribute('stroke-linecap', 'round')
		path.setAttribute('stroke-linejoin', 'round')
		path.setAttribute('marker-start', 'url(#start-dot)')
		path.setAttribute('marker-end', 'url(#end-arrow)')
		const distance = Math.max(1, Math.floor(step.distance || getPolylineDistance(step.way)))
		path.style.strokeDasharray = `${distance}`
		path.style.strokeDashoffset = `${distance}`
		dom.waySvg.prepend(path)
	}

	if (state.currentRoute) renderRouteSummary()
}

function showRouteStep(index) {
	if (!state.currentRoute?.steps.length) {
		updateRoutePager()
		return
	}

	const nextIndex = Math.max(0, Math.min(index, state.currentRoute.steps.length - 1))
	state.currentRouteStepIndex = nextIndex
	const step = state.currentRoute.steps[nextIndex]
	if (!step) return

	if (step.plan.id !== state.currentPlan?.id) {
		switchPlan(step.plan.id)
	} else {
		drawCurrentRouteSegments()
	}
	renderRouteSummary()
	updateRoutePager()
}

function syncRouteStepIndexWithCurrentPlan() {
	if (!state.currentRoute || !state.currentPlan) return

	const activeStep = state.currentRoute.steps[state.currentRouteStepIndex]
	if (activeStep?.plan.id === state.currentPlan.id) return

	const matchingIndex = state.currentRoute.steps.findIndex(step => step.plan.id === state.currentPlan.id)
	if (matchingIndex >= 0) state.currentRouteStepIndex = matchingIndex
}

function updateRoutePager() {
	if (!dom.routePager) return

	const steps = state.currentRoute?.steps || []
	const shouldShow = steps.length > 1
	dom.routePager.hidden = !shouldShow
	if (!shouldShow) return

	const index = Math.max(0, Math.min(state.currentRouteStepIndex, steps.length - 1))
	state.currentRouteStepIndex = index
	const step = steps[index]

	dom.routePagerPrev.disabled = index === 0
	dom.routePagerNext.disabled = index === steps.length - 1
	dom.routePagerStatus.textContent = `${index + 1} / ${steps.length}`
	dom.routePagerStatus.title = getPlanFullLabel(step.plan)
}

function verticesToPathD(vertices) {
	return vertices.map((vertex, index) => `${index === 0 ? 'M' : 'L'}${vertex.x} ${vertex.y}`).join('')
}

function clearRouteDrawing() {
	for (const path of dom.waySvg.querySelectorAll('.way-path')) path.remove()
}

function clearRoute() {
	state.currentRoute = null
	state.currentRouteStepIndex = 0
	state.routeSelection.fromId = undefined
	state.routeSelection.toId = undefined
	state.currentClickedRoomId = null
	updateRouteInputsFromSelection()
	setRouteStatus('Выберите аудитории на карте или через поля поиска')
	dom.routeDetails.replaceChildren()
	clearRouteDrawing()
	updateRoutePager()
	state.planModel?.syncSelection()
	updateRouteControlsState()
}

function setRouteStatus(text) {
	dom.outputWay.textContent = text
	if (dom.routeDetails) dom.routeDetails.replaceChildren()
	if (!state.currentRoute) updateRoutePager()
}

function getAvailablePlansForCorpus(corpusId) {
	return state.data.plans
		.filter(plan => plan.available !== false && plan.corpusId === corpusId)
		.sort(comparePlansByFloor)
}

function getPreferredPlanForCorpus(corpusId) {
	const plans = getAvailablePlansForCorpus(corpusId)
	if (!plans.length) return undefined
	if (!state.currentPlan) return plans[0]

	const currentFloorKey = getFloorKey(state.currentPlan)
	return plans.find(plan => getFloorKey(plan) === currentFloorKey)
		|| plans.find(plan => Number(plan.floor) === Number(state.currentPlan.floor))
		|| plans[0]
}

function getFloorKey(plan) {
	const planId = String(plan?.id || '').toLowerCase()
	if (planId.includes('basement')) return 'basement'
	if (planId.includes('cokol')) return 'cokol'
	if (planId.includes('atresol')) return 'atresol'
	return `floor:${plan?.floor}`
}

function getFloorButtonLabel(plan) {
	const planId = String(plan.id).toLowerCase()
	if (planId.includes('cokol')) return 'Ц'
	if (planId.includes('basement')) return 'П'
	if (planId.includes('atresol')) return 'А'
	return String(plan.floor)
}

function comparePlansByFloor(planA, planB) {
	const orderDifference = getFloorSortValue(planA) - getFloorSortValue(planB)
	if (orderDifference) return orderDifference
	return String(planA.id).localeCompare(String(planB.id), 'ru')
}

function getFloorSortValue(plan) {
	const planId = String(plan.id).toLowerCase()
	if (planId.includes('basement')) return -2
	if (planId.includes('cokol')) return -1
	if (planId.includes('atresol')) return Number(plan.floor) + 0.5

	const numericFloor = Number(plan.floor)
	return Number.isFinite(numericFloor) ? numericFloor : 1000
}

function getRoomDisplayName(room) {
	if (!room) return ''
	const numberOrTitle = cleanText(room.numberOrTitle)
	if (numberOrTitle) return numberOrTitle

	const tabletText = cleanText(room.tabletText).replace(/^\[EVENT\]\s*/i, '')
	if (tabletText) return tabletText

	const type = cleanText(room.type)
	return type || room.id
}

function getRoomInputLabel(room) {
	if (!room) return ''
	const plan = state.plansById.get(room.planId)
	return `${getRoomDisplayName(room)} · ${getPlanFullLabel(plan)} · ${room.id}`
}

function getPlanLabel(plan, includeLocation = true) {
	if (!plan) return ''
	const floor = getFloorLabel(plan)
	const corpus = plan.corpus ? getCorpusLabel(plan.corpus) : plan.corpusId
	return includeLocation && plan.location
		? `${plan.location.short} · ${corpus} · ${floor}`
		: `${corpus} · ${floor}`
}

function getPlanFullLabel(plan) {
	return getPlanLabel(plan, true)
}

function getCorpusLabel(corpus) {
	if (!corpus) return ''
	if (corpus.locationId === 'BS') return `Корпус ${corpus.title}`
	return getReadableCorpusCode(corpus)
}

function getReadableCorpusCode(corpus) {
	return String(corpus.id || '')
		.replace(/_/g, '-')
		.replace(/^(AV)(?=-|$)/, 'АВ')
		.replace(/^(PR)(?=-|$)/, 'ПР')
		.replace(/^(PK)(?=-|$)/, 'ПК')
		.replace(/^(M)(?=-|$)/, 'М')
		.replace(/SPORT/g, 'Спорткомплекс')
}

function getFloorLabel(plan) {
	const planId = String(plan.id).toLowerCase()
	if (planId.includes('cokol')) return 'цоколь'
	if (planId.includes('basement')) return 'подвал'
	if (planId.includes('atresol')) return 'антресоль'
	return `${plan.floor} этаж`
}

function cleanText(value) {
	const text = String(value || '').trim()
	return text && !/^[\s\-–—]+$/.test(text) ? text : ''
}

function normalizeSearch(value) {
	return String(value || '')
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[^a-zа-я0-9]+/giu, '')
}

function getEuclideanDistance(vertex1, vertex2) {
	return Math.sqrt((vertex2.x - vertex1.x) ** 2 + (vertex2.y - vertex1.y) ** 2)
}

function getPolylineDistance(vertices) {
	let distance = 0
	for (let index = 1; index < vertices.length; index++) {
		distance += getEuclideanDistance(vertices[index - 1], vertices[index])
	}
	return distance
}

class PlanModel {
	constructor(plan, svgPlan) {
		this.plan = plan
		this.svgPlan = svgPlan
		this.rooms = new Map()
		this.entrances = new Map()
		this.roomEntrances = new Map(plan.entrances || [])
		this.processRooms()
		this.processEntrances()
		this.assignEntrancesToRooms()
		this.setupRoomClickHandlers()
	}

	processRooms() {
		const spaces = this.svgPlan.getElementById('Spaces')
		const elements = spaces
			? Array.from(spaces.querySelectorAll('[id]'))
			: Array.from(this.svgPlan.querySelectorAll('[id]'))

		for (const element of elements) {
			const room = state.roomsById.get(element.id)
			if (!room || room.planId !== this.plan.id || room.available === false) continue
			if (!state.graph.findVertexById(room.id)) continue

			element.classList.add('auditorium', 'room-space')
			this.rooms.set(room.id, {
				room,
				roomEl: element,
				entranceEl: null,
			})
		}
	}

	processEntrances() {
		const entrances = this.svgPlan.getElementById('Entrances')
		if (!entrances) return

		for (const element of Array.from(entrances.children)) {
			if (!element.id) continue
			element.classList.add('entrance')
			element.setAttribute('fill-opacity', '0')
			this.entrances.set(element.id, element)
		}
	}

	assignEntrancesToRooms() {
		for (const [roomId, roomModel] of this.rooms) {
			const entranceId = this.roomEntrances.get(roomId)
			if (entranceId && this.entrances.has(entranceId)) {
				roomModel.entranceEl = this.entrances.get(entranceId)
				continue
			}

			for (const entrance of this.entrances.values()) {
				if (this.isEntranceInsideRoom(entrance, roomModel.roomEl)) {
					roomModel.entranceEl = entrance
					break
				}
			}
		}
	}

	isEntranceInsideRoom(entrance, roomElement) {
		const cx = Number(entrance.getAttribute('cx'))
		const cy = Number(entrance.getAttribute('cy'))
		if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false

		try {
			const box = roomElement.getBBox()
			return cx >= box.x && cx <= box.x + box.width && cy >= box.y && cy <= box.y + box.height
		} catch (error) {
			return false
		}
	}

	setupRoomClickHandlers() {
		for (const [roomId, roomModel] of this.rooms) {
			roomModel.roomEl.addEventListener('click', event => {
				event.preventDefault()
				event.stopPropagation()
				onRoomClicked(roomId, event)
			})
		}
	}

	syncSelection(transientRoomId = state.currentClickedRoomId) {
		for (const [roomId, roomModel] of this.rooms) {
			const selected = roomId === transientRoomId
				|| roomId === state.routeSelection.fromId
				|| roomId === state.routeSelection.toId
			roomModel.roomEl.classList.toggle('selected', selected)
			if (roomModel.entranceEl) {
				roomModel.entranceEl.classList.toggle('selected-entrance', selected)
			}
		}
	}
}

class NavigationGraph {
	constructor(data) {
		this.data = data
		this.vertexes = []
		this.vertexMap = new Map()
		this.fillVertexesByRawVertexes()
		this.addStairs()
		this.addCrossings()
	}

	fillVertexesByRawVertexes() {
		for (const plan of this.data.plans.filter(plan => plan.available !== false)) {
			for (const rawVertex of plan.graph || []) {
				const vertex = new NavigationVertex(rawVertex, plan)
				this.vertexes.push(vertex)
				this.vertexMap.set(vertex.id, vertex)
			}
		}
	}

	addStairs() {
		for (const corpus of this.data.corpuses.filter(corpus => corpus.available !== false)) {
			for (const stairLine of corpus.stairs || []) {
				for (let index = 1; index < stairLine.length; index++) {
					const previous = this.findVertexById(stairLine[index - 1])
					const current = this.findVertexById(stairLine[index])
					if (previous && current) {
						this.addNeighborBoth(previous, current, STAIR_UP_WEIGHT, STAIR_DOWN_WEIGHT)
					}
				}
			}
		}
	}

	addCrossings() {
		for (const location of this.data.locations.filter(location => location.available !== false)) {
			for (const crossing of location.crossings || []) {
				const [fromId, toId, weight] = crossing
				const from = this.findVertexById(fromId)
				const to = this.findVertexById(toId)
				if (from && to) this.addNeighborBoth(from, to, weight, weight)
			}
		}
	}

	findVertexById(id) {
		return this.vertexMap.get(id)
	}

	addNeighborBoth(vertex1, vertex2, weight12, weight21) {
		this.addNeighbor(vertex1, vertex2.id, weight12)
		this.addNeighbor(vertex2, vertex1.id, weight21)
	}

	addNeighbor(vertex, neighborId, weight) {
		const oldNeighbor = vertex.neighborData.find(neighbor => neighbor[0] === neighborId)
		if (oldNeighbor) {
			oldNeighbor[1] = Math.min(Number(oldNeighbor[1]), Number(weight))
			return
		}
		vertex.neighborData.push([neighborId, Number(weight)])
	}

	getShortestWayFromTo(fromId, toId) {
		const from = this.findVertexById(fromId)
		const to = this.findVertexById(toId)
		if (!from || !to) return {way: [], distance: Infinity}

		const allowedVertexes = this.vertexes.filter(vertex => this.isRouteableVertex(vertex, fromId, toId))
		const allowedIds = new Set(allowedVertexes.map(vertex => vertex.id))
		const distances = new Map()
		const previous = new Map()
		const unvisited = new Set(allowedIds)

		for (const vertex of allowedVertexes) distances.set(vertex.id, Infinity)
		distances.set(fromId, 0)

		while (unvisited.size) {
			let currentId = undefined
			let currentDistance = Infinity
			for (const id of unvisited) {
				const distance = distances.get(id)
				if (distance < currentDistance) {
					currentDistance = distance
					currentId = id
				}
			}

			if (!currentId || currentDistance === Infinity) break
			unvisited.delete(currentId)
			if (currentId === toId) break

			const current = this.findVertexById(currentId)
			for (const [neighborId, weight] of current.neighborData) {
				if (!allowedIds.has(neighborId) || !unvisited.has(neighborId)) continue
				const nextDistance = currentDistance + Number(weight)
				if (nextDistance < distances.get(neighborId)) {
					distances.set(neighborId, nextDistance)
					previous.set(neighborId, currentId)
				}
			}
		}

		const distance = distances.get(toId)
		if (!Number.isFinite(distance)) return {way: [], distance: Infinity}

		const way = []
		let currentId = toId
		while (currentId) {
			const vertex = this.findVertexById(currentId)
			if (vertex) way.unshift(vertex)
			if (currentId === fromId) break
			currentId = previous.get(currentId)
		}

		if (!way.length || way[0].id !== fromId) return {way: [], distance: Infinity}
		return {way, distance: Math.floor(distance)}
	}

	isRouteableVertex(vertex, fromId, toId) {
		return vertex.id === fromId
			|| vertex.id === toId
			|| ROUTEABLE_VERTEX_TYPES.has(vertex.type)
			|| vertex.id.includes('crossing')
	}

	getDistanceBetween2Vertexes(vertex, neighborId) {
		const neighbor = vertex.neighborData.find(item => item[0] === neighborId)
		return neighbor ? Number(neighbor[1]) : undefined
	}
}

class NavigationVertex {
	constructor(rawVertex, plan) {
		this.id = rawVertex.id
		this.x = Number(rawVertex.x)
		this.y = Number(rawVertex.y)
		this.type = rawVertex.type
		this.neighborData = (rawVertex.neighborData || []).map(([id, weight]) => [id, Number(weight)])
		this.plan = plan
	}
}

class DragHandler {
	constructor(dragAble, scaleAble, wrapper, buttonPlus, buttonMinus) {
		this.dragAble = dragAble
		this.scaleAble = scaleAble
		this.wrapper = wrapper
		this.scale = 1

		wrapper.addEventListener('mousedown', event => this.startMove(event))
		wrapper.addEventListener('touchstart', event => this.startMove(event), {passive: true})
		buttonPlus.addEventListener('click', () => this.applyScale(1.8))
		buttonMinus.addEventListener('click', () => this.applyScale(1 / 1.8))

		let wheelSum = 0
		wrapper.addEventListener('wheel', event => {
			wheelSum += event.deltaY
			if (Math.abs(wheelSum) < 80) return
			this.applyScale(wheelSum < 0 ? 1.15 : 1 / 1.15)
			wheelSum = 0
		}, {passive: true})
	}

	startMove(startEvent) {
		const startLeft = this.dragAble.offsetLeft
		const startTop = this.dragAble.offsetTop
		const startPoint = getPointerPoint(startEvent)
		if (!startPoint) return

		const onMove = moveEvent => {
			const point = getPointerPoint(moveEvent)
			if (!point) return
			this.dragAble.style.pointerEvents = 'none'
			this.dragAble.style.left = `${(point.x - startPoint.x) / this.scale + startLeft}px`
			this.dragAble.style.top = `${(point.y - startPoint.y) / this.scale + startTop}px`
		}
		const onEnd = () => {
			this.dragAble.style.pointerEvents = 'auto'
			document.removeEventListener('mousemove', onMove)
			document.removeEventListener('touchmove', onMove)
			document.removeEventListener('mouseup', onEnd)
			document.removeEventListener('touchend', onEnd)
			document.removeEventListener('touchcancel', onEnd)
		}

		document.addEventListener('mousemove', onMove)
		document.addEventListener('touchmove', onMove, {passive: true})
		document.addEventListener('mouseup', onEnd)
		document.addEventListener('touchend', onEnd)
		document.addEventListener('touchcancel', onEnd)
	}

	applyScale(scaleValue) {
		this.scale = Math.max(0.15, Math.min(12, Math.round(this.scale * scaleValue * 100) / 100))
		this.scaleAble.style.transform = `scale(${this.scale})`
	}
}

function getPointerPoint(event) {
	if (event.touches?.length) return {x: event.touches[0].clientX, y: event.touches[0].clientY}
	if (Number.isFinite(event.clientX)) return {x: event.clientX, y: event.clientY}
	return null
}

function activateMenuTab(tabName) {
	const expandedPanel = tabName === 'schedule' || tabName === 'chat'
	dom.sectionMain?.classList.toggle('schedule-layout-active', expandedPanel)
	dom.menu?.classList.toggle('schedule-menu-active', tabName === 'schedule')
	dom.menu?.classList.toggle('chat-menu-active', tabName === 'chat')
	dom.menuTabs.forEach(tab => {
		tab.classList.toggle('active-tab', tab.dataset.tab === tabName)
	})
	dom.menuPanels.forEach(panel => {
		panel.classList.toggle('active-panel', panel.dataset.panel === tabName)
	})
	if (tabName === 'schedule' && !state.groupsLoaded) {
		loadAvailableGroups().catch(() => {
			dom.scheduleStatus.textContent = 'Не удалось загрузить список групп'
		})
	}
}

function setupScheduleHandlers() {
	dom.groupScheduleButton.addEventListener('click', () => loadGroupSchedule())
	dom.refreshGroupListButton.addEventListener('click', () => {
		state.groupsLoaded = false
		state.scheduleDatasetsCache.clear()
		loadAvailableGroups(true).catch(() => {
			dom.scheduleStatus.textContent = 'Не удалось обновить список групп'
		})
	})
	dom.groupScheduleInput.addEventListener('focus', () => {
		if (!state.groupsLoaded) {
			loadAvailableGroups().catch(() => {
				dom.scheduleStatus.textContent = 'Не удалось загрузить список групп'
			})
		}
	})
	dom.groupScheduleInput.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault()
			loadGroupSchedule()
		}
	})
}

async function fetchScheduleDataset(datasetName) {
	if (state.scheduleDatasetsCache.has(datasetName)) {
		return state.scheduleDatasetsCache.get(datasetName)
	}

	const data = await fetchFirstJson([
		`https://rasp.dmami.ru/${datasetName}.json`,
		`./polydroid-api-master/schedule_parser/json/${datasetName}.json`,
	])
	state.scheduleDatasetsCache.set(datasetName, data)
	return data
}

async function loadAvailableGroups(forceReload = false) {
	if (state.groupsLoaded && !forceReload) return state.availableGroups

	dom.scheduleStatus.textContent = 'Загрузка списка групп...'
	const groupSet = new Set()
	const datasets = [
		await fetchScheduleDataset('semester'),
		await fetchScheduleDataset('session'),
	]

	for (const dataset of datasets) {
		for (const content of dataset.contents || []) {
			const title = content.group?.title?.trim()
			if (title) groupSet.add(title)
		}
	}

	state.availableGroups = Array.from(groupSet).sort((a, b) => a.localeCompare(b, 'ru'))
	dom.groupSuggestions.replaceChildren()
	for (const groupName of state.availableGroups) {
		const option = document.createElement('option')
		option.value = groupName
		dom.groupSuggestions.appendChild(option)
	}

	state.groupsLoaded = true
	dom.scheduleStatus.textContent = `Доступно групп: ${state.availableGroups.length}`
	return state.availableGroups
}

async function loadGroupSchedule() {
	const rawGroupName = dom.groupScheduleInput.value.trim()
	if (!rawGroupName) {
		state.currentSchedule = null
		dom.scheduleStatus.textContent = 'Введите номер группы'
		dom.scheduleOutput.replaceChildren()
		return
	}

	try {
		await loadAvailableGroups()
		const groupName = resolveSelectedGroupName(rawGroupName)
		if (!groupName) {
			dom.scheduleStatus.textContent = 'Группа не найдена. Выберите вариант из подсказок'
			dom.scheduleOutput.replaceChildren()
			return
		}

		dom.groupScheduleInput.value = groupName
		dom.scheduleStatus.textContent = 'Загрузка расписания...'
		dom.scheduleOutput.replaceChildren()

		const semesterDataset = await fetchScheduleDataset('semester')
		const semesterGroup = findGroupContent(semesterDataset, groupName)
		if (semesterGroup) {
			renderGroupSchedule(semesterGroup, 'семестр')
			return
		}

		const sessionDataset = await fetchScheduleDataset('session')
		const sessionGroup = findGroupContent(sessionDataset, groupName)
		if (sessionGroup) {
			renderGroupSchedule(sessionGroup, 'сессия')
			return
		}

		dom.scheduleStatus.textContent = 'Группа не найдена'
	} catch (error) {
		console.error(error)
		dom.scheduleStatus.textContent = 'Не удалось загрузить расписание'
	}
}

function resolveSelectedGroupName(inputValue) {
	const normalizedInput = normalizeGroupName(inputValue)
	if (!normalizedInput) return null

	const exactMatch = state.availableGroups.find(groupName => normalizeGroupName(groupName) === normalizedInput)
	if (exactMatch) return exactMatch

	const partialMatches = state.availableGroups.filter(groupName => normalizeGroupName(groupName).includes(normalizedInput))
	return partialMatches.length === 1 ? partialMatches[0] : null
}

function findGroupContent(dataset, groupName) {
	const normalizedGroup = normalizeGroupName(groupName)
	return (dataset.contents || []).find(content => normalizeGroupName(content.group?.title || '') === normalizedGroup)
}

function renderGroupSchedule(groupContent, datasetLabel) {
	const dayLabels = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
	dom.scheduleOutput.replaceChildren()
	const dayEntries = Object.entries(groupContent.grid || {})
	const isSessionGrid = dayEntries.some(([dayKey]) => /^\d{4}-\d{2}-\d{2}$/.test(dayKey))
	dayEntries.sort((a, b) => isSessionGrid ? a[0].localeCompare(b[0]) : Number(a[0]) - Number(b[0]))

	for (const [dayKey, dayGrid] of dayEntries) {
		const entries = []
		for (let lessonNumber = 1; lessonNumber <= 7; lessonNumber++) {
			for (const lesson of dayGrid?.[String(lessonNumber)] || []) {
				entries.push({
					lessonNumber,
					subject: lesson.sbj || 'Без названия',
					teacher: lesson.teacher || 'Преподаватель не указан',
					type: lesson.type || 'Тип не указан',
					dateRange: lesson.dts || '',
					classrooms: (lesson.auditories || []).map(auditory => stripHtml(auditory.title || '')).filter(Boolean),
				})
			}
		}
		if (!entries.length) continue

		const day = document.createElement('section')
		day.className = 'schedule-day'

		const title = document.createElement('h4')
		if (isSessionGrid) {
			const date = new Date(`${dayKey}T00:00:00`)
			const weekday = dayLabels[(date.getDay() + 6) % 7]
			title.textContent = `${weekday} · ${dayKey}`
		} else {
			title.textContent = dayLabels[Number(dayKey) - 1] || dayKey
		}
		day.appendChild(title)

		for (const entry of entries) {
			const item = document.createElement('div')
			item.className = 'schedule-item'
			const classroomText = entry.classrooms.length ? ` · ${entry.classrooms.join(', ')}` : ''
			item.textContent = `${entry.lessonNumber} пара · ${entry.subject} · ${entry.type} · ${entry.teacher}${classroomText}${entry.dateRange ? ` · ${entry.dateRange}` : ''}`
			day.appendChild(item)
		}

		dom.scheduleOutput.appendChild(day)
	}

	dom.scheduleStatus.textContent = `${groupContent.group.title} · ${datasetLabel}`
	if (!dom.scheduleOutput.childElementCount) {
		dom.scheduleStatus.textContent += ' · занятий не найдено'
	}
}

function normalizeGroupName(value = '') {
	return value.trim().toLowerCase().replace(/\s+/g, '').replace(/[–—−]/g, '-')
}

function stripHtml(html = '') {
	const container = document.createElement('div')
	container.innerHTML = html
	return (container.textContent || container.innerText || '').trim()
}

function setupScheduleHandlers() {
	createScheduleModeControls()
	dom.groupScheduleButton.addEventListener('click', () => loadGroupSchedule())
	dom.refreshGroupListButton.addEventListener('click', () => {
		state.groupsLoaded = false
		state.scheduleApiCache.clear()
		loadAvailableGroups(true).catch(error => {
			console.error(error)
			showScheduleError('Не удалось обновить список групп')
		})
	})
	dom.groupScheduleInput.addEventListener('focus', () => {
		if (!state.groupsLoaded) {
			loadAvailableGroups().catch(error => {
				console.error(error)
				showScheduleError('Не удалось загрузить список групп')
			})
		}
	})
	dom.groupScheduleInput.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault()
			loadGroupSchedule()
		}
	})
}

function createScheduleModeControls() {
	const inputRow = dom.groupScheduleInput.closest('.input-row')
	if (!inputRow) return

	dom.scheduleModeButtons = document.createElement('div')
	dom.scheduleModeButtons.className = 'schedule-mode'
	for (const mode of [
		{value: 'semester', label: 'Занятия'},
		{value: 'session', label: 'Сессия'},
	]) {
		const button = document.createElement('button')
		button.type = 'button'
		button.className = 'schedule-mode-button'
		button.dataset.mode = mode.value
		button.textContent = mode.label
		button.addEventListener('click', () => setScheduleMode(mode.value))
		dom.scheduleModeButtons.appendChild(button)
	}
	inputRow.after(dom.scheduleModeButtons)
	createScheduleDateControl(dom.scheduleModeButtons)
	updateScheduleModeButtons()
}

function createScheduleDateControl(anchorElement) {
	dom.scheduleDateControl = document.createElement('label')
	dom.scheduleDateControl.className = 'schedule-date-control'
	dom.scheduleDateControl.textContent = 'Неделя'

	dom.scheduleDateInput = document.createElement('input')
	dom.scheduleDateInput.type = 'date'
	dom.scheduleDateInput.value = state.scheduleViewDate
	dom.scheduleDateInput.addEventListener('change', () => {
		if (!dom.scheduleDateInput.value) return
		state.scheduleViewDate = dom.scheduleDateInput.value
		if (state.currentSchedule) renderGroupSchedule(state.currentSchedule)
	})

	dom.scheduleDateControl.appendChild(dom.scheduleDateInput)
	anchorElement.after(dom.scheduleDateControl)
}

function setScheduleMode(mode) {
	if (state.scheduleMode === mode) return
	state.scheduleMode = mode
	state.groupsLoaded = false
	state.availableGroups = []
	state.scheduleGroupsMeta = null
	state.currentSchedule = null
	updateScheduleModeButtons()
	dom.scheduleOutput.replaceChildren()
	loadAvailableGroups(true).catch(error => {
		console.error(error)
		showScheduleError('Не удалось загрузить список групп')
	})
}

function updateScheduleModeButtons() {
	dom.scheduleModeButtons?.querySelectorAll('.schedule-mode-button').forEach(button => {
		button.classList.toggle('active-schedule-mode', button.dataset.mode === state.scheduleMode)
	})
}

async function fetchScheduleApi(path, params = {}, options = {}) {
	const url = new URL(`${SCHEDULE_API_BASE}/${path}`, window.location.href)
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null) url.searchParams.set(key, value)
	}
	if (options.forceReload) url.searchParams.set('_', Date.now())

	const response = await fetch(url, {
		headers: {Accept: 'application/json'},
		cache: options.forceReload ? 'no-store' : 'default',
	})
	const payload = await response.json().catch(() => null)
	if (!response.ok) {
		throw new Error(payload?.message || payload?.error || `Schedule API ${response.status}`)
	}
	return payload
}

async function loadAvailableGroups(forceReload = false) {
	if (state.groupsLoaded && !forceReload) return state.availableGroups

	dom.scheduleStatus.textContent = 'Загрузка актуального списка групп...'
	const payload = await fetchScheduleApi('groups', {session: getScheduleSessionFlag()}, {forceReload})
	state.availableGroups = (payload.groups || [])
		.map(group => typeof group === 'string' ? {name: group, isDpo: false} : group)
		.filter(group => group.name)
		.sort(compareScheduleGroups)
	state.scheduleGroupsMeta = payload.meta || null
	renderGroupSuggestions()
	prefillFavoriteScheduleGroup()

	state.groupsLoaded = true
	const actualDate = state.scheduleGroupsMeta?.date ? ` · обновлено ${state.scheduleGroupsMeta.date}` : ''
	dom.scheduleStatus.textContent = `Доступно групп: ${state.availableGroups.length}${actualDate}`
	return state.availableGroups
}

function renderGroupSuggestions() {
	dom.groupSuggestions.replaceChildren()
	for (const group of state.availableGroups) {
		const option = document.createElement('option')
		option.value = group.name
		const views = getFavoriteGroupCount(group.name)
		const dpoLabel = group.isDpo ? ' · ДПО' : ''
		const viewsLabel = views ? ` · часто используется: ${views}` : ''
		option.label = `${group.name}${dpoLabel}${viewsLabel}`
		dom.groupSuggestions.appendChild(option)
	}
}

function loadFavoriteGroups() {
	try {
		state.favoriteGroups = JSON.parse(localStorage.getItem(FAVORITE_GROUPS_STORAGE_KEY) || '{}')
	} catch (error) {
		state.favoriteGroups = {}
	}
}

function loadUserGroup() {
	try {
		state.userGroup = localStorage.getItem(USER_GROUP_STORAGE_KEY) || getLastViewedScheduleGroup() || ''
	} catch (error) {
		state.userGroup = getLastViewedScheduleGroup() || ''
	}
}

function setUserGroup(groupName) {
	const normalizedGroup = normalizeGroupName(groupName)
	if (!normalizedGroup) return

	state.userGroup = groupName
	try {
		localStorage.setItem(USER_GROUP_STORAGE_KEY, groupName)
	} catch (error) {
		console.warn('Не удалось сохранить группу пользователя', error)
	}
}

function rememberScheduleGroup(groupName) {
	const normalizedGroup = normalizeGroupName(groupName)
	if (!normalizedGroup) return

	setUserGroup(groupName)
	const current = state.favoriteGroups[normalizedGroup] || {
		name: groupName,
		count: 0,
		lastUsedAt: 0,
	}
	state.favoriteGroups[normalizedGroup] = {
		name: groupName,
		count: Number(current.count || 0) + 1,
		lastUsedAt: Date.now(),
	}
	saveFavoriteGroups()
	state.availableGroups.sort(compareScheduleGroups)
	renderGroupSuggestions()
}

function saveFavoriteGroups() {
	try {
		localStorage.setItem(FAVORITE_GROUPS_STORAGE_KEY, JSON.stringify(state.favoriteGroups))
	} catch (error) {
		console.warn('Не удалось сохранить часто используемую группу', error)
	}
}

function getFavoriteGroup(groupName) {
	return state.favoriteGroups[normalizeGroupName(groupName)]
}

function getFavoriteGroupCount(groupName) {
	return Number(getFavoriteGroup(groupName)?.count || 0)
}

function getMostUsedScheduleGroup() {
	return Object.values(state.favoriteGroups)
		.filter(item => item?.name)
		.sort((itemA, itemB) => {
			const countDifference = Number(itemB.count || 0) - Number(itemA.count || 0)
			if (countDifference) return countDifference
			return Number(itemB.lastUsedAt || 0) - Number(itemA.lastUsedAt || 0)
		})[0]?.name
}

function getLastViewedScheduleGroup() {
	return Object.values(state.favoriteGroups)
		.filter(item => item?.name)
		.sort((itemA, itemB) => {
			const lastUsedDifference = Number(itemB.lastUsedAt || 0) - Number(itemA.lastUsedAt || 0)
			if (lastUsedDifference) return lastUsedDifference
			return Number(itemB.count || 0) - Number(itemA.count || 0)
		})[0]?.name
}

function prefillFavoriteScheduleGroup() {
	if (dom.groupScheduleInput.value.trim()) return

	const lastViewedGroup = getLastViewedScheduleGroup()
	if (!lastViewedGroup) return

	const exists = state.availableGroups.some(group => normalizeGroupName(group.name) === normalizeGroupName(lastViewedGroup))
	if (exists) dom.groupScheduleInput.value = lastViewedGroup
}

function compareScheduleGroups(groupA, groupB) {
	const favoriteA = getFavoriteGroup(groupA.name)
	const favoriteB = getFavoriteGroup(groupB.name)
	const countDifference = Number(favoriteB?.count || 0) - Number(favoriteA?.count || 0)
	if (countDifference) return countDifference

	const lastUsedDifference = Number(favoriteB?.lastUsedAt || 0) - Number(favoriteA?.lastUsedAt || 0)
	if (lastUsedDifference) return lastUsedDifference

	return groupA.name.localeCompare(groupB.name, 'ru', {numeric: true})
}

async function showFavoriteScheduleOnStartup() {
	const lastViewedGroup = getLastViewedScheduleGroup()
	if (!lastViewedGroup) return

	dom.groupScheduleInput.value = lastViewedGroup
	await loadAvailableGroups()

	const group = resolveSelectedGroup(lastViewedGroup)
	if (!group) return

	dom.groupScheduleInput.value = group.name
	activateMenuTab('schedule')
	await loadGroupSchedule({rememberUsage: false})
}

async function loadGroupSchedule(options = {}) {
	const shouldRememberUsage = options.rememberUsage !== false
	const rawGroupName = dom.groupScheduleInput.value.trim()
	if (!rawGroupName) {
		dom.scheduleStatus.textContent = 'Введите номер группы'
		dom.scheduleOutput.replaceChildren()
		return
	}

	try {
		await loadAvailableGroups()
		const group = resolveSelectedGroup(rawGroupName)
		if (!group) {
			state.currentSchedule = null
			dom.scheduleStatus.textContent = 'Группа не найдена. Выберите вариант из актуальных подсказок'
			dom.scheduleOutput.replaceChildren()
			return
		}

		dom.groupScheduleInput.value = group.name
		dom.scheduleStatus.textContent = 'Загрузка расписания...'
		dom.scheduleOutput.replaceChildren()

		const schedule = await fetchScheduleApi('group', {
			group: group.name,
			session: getScheduleSessionFlag(),
		})
		if (schedule.status === 'error') {
			dom.scheduleStatus.textContent = schedule.message || 'Расписание для группы не найдено'
			return
		}

		state.currentSchedule = schedule
		if (shouldRememberUsage) rememberScheduleGroup(group.name)
		renderGroupSchedule(schedule)
	} catch (error) {
		console.error(error)
		showScheduleError('Не удалось загрузить расписание')
	}
}

function showScheduleError(message) {
	state.currentSchedule = null
	dom.scheduleStatus.textContent = `${message}. Проверьте, что приложение запущено через node server.js`
	dom.scheduleOutput.replaceChildren()
}

function getScheduleSessionFlag() {
	return state.scheduleMode === 'session' ? 1 : 0
}

function resolveSelectedGroup(inputValue) {
	const normalizedInput = normalizeGroupName(inputValue)
	if (!normalizedInput) return null

	const exactMatch = state.availableGroups.find(group => normalizeGroupName(group.name) === normalizedInput)
	if (exactMatch) return exactMatch

	const partialMatches = state.availableGroups.filter(group => normalizeGroupName(group.name).includes(normalizedInput))
	return partialMatches.length === 1 ? partialMatches[0] : null
}

function renderGroupSchedule(schedule) {
	dom.scheduleOutput.replaceChildren()
	const group = schedule.group || {}
	const grid = schedule.grid || {}
	const isSessionGrid = Boolean(schedule.isSession) || getScheduleSessionFlag() === 1
	const viewWeekStart = getScheduleViewWeekStart()
	const viewWeekEnd = addDays(viewWeekStart, 6)
	const dayEntries = Object.entries(grid)
		.filter(([dayKey]) => shouldRenderScheduleDayInSelectedWeek(dayKey, isSessionGrid, viewWeekStart))
		.sort((a, b) => sortScheduleDays(a[0], b[0], isSessionGrid))

	for (const [dayKey, dayGrid] of dayEntries) {
		const dayDate = getScheduleDateForDayKey(dayKey, isSessionGrid, viewWeekStart)
		const entries = filterScheduleEntriesForDisplay(
			collectScheduleEntries(dayGrid, group),
			isSessionGrid,
			dayDate,
		)
		if (!entries.length) continue

		const day = document.createElement('section')
		day.className = 'schedule-day'

		const title = document.createElement('h4')
		title.textContent = getScheduleDayTitle(dayKey, isSessionGrid, dayDate)
		day.appendChild(title)

		for (const entry of entries) {
			day.appendChild(renderScheduleEntry(entry))
		}

		dom.scheduleOutput.appendChild(day)
	}

	const modeLabel = state.scheduleMode === 'session' ? 'сессия' : 'занятия'
	dom.scheduleStatus.textContent = `${group.title || dom.groupScheduleInput.value} · ${modeLabel} · неделя ${formatScheduleDate(viewWeekStart)} - ${formatScheduleDate(viewWeekEnd)}`
	if (!dom.scheduleOutput.childElementCount) {
		dom.scheduleStatus.textContent += ' · занятий не найдено'
	}
}

function filterScheduleEntriesForDisplay(entries, isSessionGrid, date) {
	if (isSessionGrid) return entries
	return entries.filter(entry => isScheduleEntryActiveOnDate(entry, date))
}

function getScheduleViewWeekStart() {
	const selectedDate = parseDateInputValue(state.scheduleViewDate) || new Date()
	const weekStart = normalizeDateOnly(selectedDate)
	weekStart.setDate(weekStart.getDate() - getScheduleWeekdayIndex(weekStart))
	return weekStart
}

function shouldRenderScheduleDayInSelectedWeek(dayKey, isSessionGrid, weekStart) {
	if (!isSessionGrid) return true

	const date = parseScheduleDayKeyDate(dayKey)
	if (!date) return false
	const weekEnd = addDays(weekStart, 6)
	return date >= weekStart && date <= weekEnd
}

function getScheduleDateForDayKey(dayKey, isSessionGrid, weekStart) {
	if (isSessionGrid) return parseScheduleDayKeyDate(dayKey) || weekStart

	const weekdayIndex = Number(dayKey) - 1
	return addDays(weekStart, Number.isFinite(weekdayIndex) ? weekdayIndex : 0)
}

function parseDateInputValue(value) {
	const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (!match) return null

	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
	return Number.isNaN(date.getTime()) ? null : date
}

function parseScheduleDayKeyDate(dayKey) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey))) return null

	const date = new Date(`${dayKey}T00:00:00`)
	return Number.isNaN(date.getTime()) ? null : normalizeDateOnly(date)
}

function addDays(date, days) {
	const result = normalizeDateOnly(date)
	result.setDate(result.getDate() + days)
	return result
}

function collectScheduleEntries(dayGrid, group) {
	const entries = []
	for (let lessonNumber = 1; lessonNumber <= 7; lessonNumber++) {
		for (const lesson of dayGrid?.[String(lessonNumber)] || []) {
			entries.push(normalizeScheduleLesson(lesson, lessonNumber, group))
		}
	}
	return entries
}

function normalizeScheduleLesson(lesson, lessonNumber, group) {
	return {
		lessonNumber,
		time: LESSON_TIMES[group?.evening ? 1 : 0]?.[lessonNumber] || '',
		subject: cleanScheduleText(lesson.sbj) || 'Без названия',
		teacher: cleanScheduleText(lesson.teacher) || 'Преподаватель не указан',
		type: cleanScheduleText(lesson.type),
		dateRange: cleanScheduleText(lesson.dts),
		auditories: normalizeAuditories(lesson),
		link: cleanScheduleText(lesson.e_link),
	}
}

function normalizeAuditories(lesson) {
	const auditories = (lesson.auditories || [])
		.map(auditory => stripHtml(auditory.title || ''))
		.map(cleanScheduleText)
		.filter(Boolean)
	const fallbackAuditories = [
		...(lesson.shortRooms || []),
		lesson.location,
	].map(cleanScheduleText).filter(Boolean)
	const labels = auditories.length ? auditories : fallbackAuditories

	return uniqueValues(labels).map(label => {
		const room = resolveScheduleAuditory(label)
		return {
			label,
			roomId: room?.id,
			roomTitle: room ? getRoomDisplayName(room) : '',
		}
	})
}

function renderScheduleAuditories(auditories) {
	const container = document.createElement('div')
	container.className = 'schedule-auditories'

	for (const auditory of auditories) {
		container.appendChild(renderScheduleAuditory(auditory))
	}

	return container
}

function renderScheduleAuditory(auditory) {
	if (!auditory.roomId) {
		const text = document.createElement('span')
		text.className = 'schedule-auditory-text'
		text.textContent = auditory.label
		return text
	}

	const chip = document.createElement('span')
	chip.className = 'schedule-auditory-chip'

	const roomButton = document.createElement('button')
	roomButton.type = 'button'
	roomButton.className = 'schedule-auditory-room'
	roomButton.textContent = auditory.roomTitle || auditory.label
	roomButton.title = 'Показать аудиторию на карте'
	roomButton.addEventListener('click', () => showScheduleRoomOnMap(auditory.roomId))
	chip.appendChild(roomButton)

	chip.appendChild(createScheduleRouteAction(auditory.roomId, 'from', 'Отсюда'))
	chip.appendChild(createScheduleRouteAction(auditory.roomId, 'to', 'Сюда'))

	return chip
}

function createScheduleRouteAction(roomId, direction, label) {
	const button = document.createElement('button')
	button.type = 'button'
	button.className = 'schedule-route-action'
	button.dataset.roomId = roomId
	button.dataset.direction = direction
	button.textContent = label
	button.addEventListener('click', () => setRouteRoom(roomId, direction, {source: 'schedule'}))
	return button
}

function showScheduleRoomOnMap(roomId) {
	const room = state.roomsById.get(roomId)
	if (!room) return

	state.currentClickedRoomId = roomId
	if (room.planId && room.planId !== state.currentPlan?.id) {
		switchPlan(room.planId)
	} else {
		state.planModel?.syncSelection(roomId)
	}
}

function resolveScheduleAuditory(label) {
	const roomIndex = getScheduleRoomIndex()
	for (const candidate of getScheduleAuditoryCandidates(label)) {
		const roomId = roomIndex.get(normalizeScheduleAuditoryKey(candidate))
		if (roomId) return state.roomsById.get(roomId)
	}
	return null
}

function getScheduleRoomIndex() {
	if (state.scheduleRoomIndex?.size) return state.scheduleRoomIndex

	state.scheduleRoomIndex = new Map()
	for (const room of state.availableRooms) {
		addScheduleRoomIndexKey(room.id, room)
		addScheduleRoomIndexKey(room.numberOrTitle, room)
		addScheduleRoomIndexKey(getRoomDisplayName(room), room)
	}
	return state.scheduleRoomIndex
}

function addScheduleRoomIndexKey(value, room) {
	const key = normalizeScheduleAuditoryKey(value)
	if (!key || state.scheduleRoomIndex.has(key)) return
	state.scheduleRoomIndex.set(key, room.id)
}

function getScheduleAuditoryCandidates(label) {
	const text = cleanScheduleText(label).replace(/[№#]/g, ' ')
	const candidates = [text]
	const prefix = extractScheduleCorpusPrefix(text)
	const numbers = [...text.matchAll(/\d+[a-zа-я]?/giu)].map(match => match[0])

	if (prefix) {
		for (const number of numbers) {
			candidates.push(`${prefix}${number}`, `${prefix}-${number}`)
		}
	}

	return uniqueValues(candidates)
}

function extractScheduleCorpusPrefix(label) {
	const text = String(label || '').trim().toLowerCase()
	const startMatch = text.match(/^-?\s*(ав|av|пр|pr|пк|pk|нд|nd|[абвнм]|a|b|v|n|m)(?=\s*[-\d]|\s+)/iu)
	if (startMatch) return normalizeScheduleCorpusPrefix(startMatch[1])

	const anywhereMatch = text.match(/(?:^|[^\p{L}\p{N}])(ав|av|пр|pr|пк|pk|нд|nd|[абвнм]|a|b|v|n|m)\s*-?\s*\d/iu)
	return anywhereMatch ? normalizeScheduleCorpusPrefix(anywhereMatch[1]) : ''
}

function normalizeScheduleCorpusPrefix(prefix) {
	const value = String(prefix || '').toLowerCase()
	if (value === 'av') return 'ав'
	if (value === 'pr') return 'пр'
	if (value === 'pk') return 'пк'
	if (value === 'nd') return 'нд'
	if (value === 'a') return 'а'
	if (value === 'b') return 'б'
	if (value === 'v') return 'в'
	if (value === 'n') return 'н'
	if (value === 'm') return 'м'
	return value
}

function normalizeScheduleAuditoryKey(value = '') {
	let key = String(value || '')
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[–—−]/g, '-')
		.replace(/[№#]/g, '')
		.replace(/[^a-zа-я0-9]+/giu, '')

	key = key
		.replace(/^av(?=\d)/, 'ав')
		.replace(/^pr(?=\d)/, 'пр')
		.replace(/^pk(?=\d)/, 'пк')
		.replace(/^nd(?=\d)/, 'нд')
		.replace(/^a(?=\d)/, 'а')
		.replace(/^b(?=\d)/, 'б')
		.replace(/^v(?=\d)/, 'в')
		.replace(/^n(?=\d)/, 'н')
		.replace(/^m(?=\d)/, 'м')

	return key
}

function refreshScheduleRouteButtons() {
	document.querySelectorAll('.schedule-route-action').forEach(button => {
		const selectedRoomId = button.dataset.direction === 'from'
			? state.routeSelection.fromId
			: state.routeSelection.toId
		button.classList.toggle('active-schedule-route-action', button.dataset.roomId === selectedRoomId)
	})
}

function renderScheduleEntry(entry) {
	const item = document.createElement('article')
	item.className = 'schedule-item'

	const meta = document.createElement('div')
	meta.className = 'schedule-item-meta'
	meta.textContent = [
		`${entry.lessonNumber} пара`,
		entry.time,
		entry.type,
		entry.dateRange,
	].filter(Boolean).join(' · ')
	item.appendChild(meta)

	const subject = document.createElement('div')
	subject.className = 'schedule-item-subject'
	subject.textContent = entry.subject
	item.appendChild(subject)

	const details = document.createElement('div')
	details.className = 'schedule-item-details'
	details.textContent = entry.teacher
	item.appendChild(details)

	if (entry.auditories.length) {
		item.appendChild(renderScheduleAuditories(entry.auditories))
	}

	if (entry.link) {
		const link = document.createElement('a')
		link.className = 'schedule-item-link'
		link.href = entry.link
		link.target = '_blank'
		link.rel = 'noopener noreferrer'
		link.textContent = 'Материалы'
		item.appendChild(link)
	}

	return item
}

function getScheduleDayTitle(dayKey, isSessionGrid, date) {
	if (!isSessionGrid) {
		const dayLabel = SCHEDULE_DAY_LABELS[Number(dayKey) - 1] || dayKey
		return date ? `${dayLabel} · ${formatScheduleDayDate(date)}` : dayLabel
	}

	const scheduleDate = date || parseScheduleDayKeyDate(dayKey)
	if (!scheduleDate) return dayKey
	const weekday = SCHEDULE_DAY_LABELS[(scheduleDate.getDay() + 6) % 7]
	return `${weekday} · ${formatScheduleDate(scheduleDate)}`
}

function sortScheduleDays(dayA, dayB, isSessionGrid) {
	if (isSessionGrid) return dayA.localeCompare(dayB)
	return Number(dayA) - Number(dayB)
}

function formatScheduleDate(date) {
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
	}).format(date)
}

function formatScheduleDayDate(date) {
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: 'long',
	}).format(date)
}

function normalizeGroupName(value = '') {
	return value.trim().toLowerCase().replace(/\s+/g, '').replace(/[–—−]/g, '-')
}

function cleanScheduleText(value = '') {
	return String(value || '').replace(/\s+/g, ' ').trim()
}

function stripHtml(html = '') {
	const container = document.createElement('div')
	container.innerHTML = html
	return cleanScheduleText(container.textContent || container.innerText || '')
}

function uniqueValues(values) {
	return [...new Set(values)]
}
