const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')

const PORT = Number(process.env.PORT || 8765)
const HOST = process.env.HOST || '127.0.0.1'
const ROOT = __dirname
const RASP_BASE_URL = 'https://rasp.dmami.ru'
const CACHE_TTL_MS = Number(process.env.SCHEDULE_CACHE_TTL_MS || 5 * 60 * 1000)

const cache = new Map()

const contentTypes = {
	'.css': 'text/css; charset=UTF-8',
	'.html': 'text/html; charset=UTF-8',
	'.ico': 'image/x-icon',
	'.js': 'text/javascript; charset=UTF-8',
	'.json': 'application/json; charset=UTF-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml; charset=UTF-8',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
}

const server = http.createServer(async (request, response) => {
	try {
		const requestUrl = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`)
		if (requestUrl.pathname.startsWith('/api/schedule/')) {
			await handleScheduleApi(requestUrl, response)
			return
		}

		await serveStaticFile(requestUrl, response)
	} catch (error) {
		console.error(error)
		sendJson(response, 500, {error: 'internal_error', message: 'Внутренняя ошибка сервера'})
	}
})

server.listen(PORT, HOST, () => {
	console.log(`Navigation app: http://${HOST}:${PORT}/index.html`)
})

async function handleScheduleApi(requestUrl, response) {
	const endpoint = requestUrl.pathname.replace('/api/schedule/', '')
	const session = requestUrl.searchParams.get('session') === '1' ? 1 : 0
	const forceReload = requestUrl.searchParams.has('_')

	if (endpoint === 'groups') {
		const payload = await cached(`groups:${session}`, forceReload, () => fetchScheduleGroups(session))
		sendJson(response, 200, payload)
		return
	}

	if (endpoint === 'group') {
		const group = normalizeRequestedGroup(requestUrl.searchParams.get('group') || '')
		if (!group) {
			sendJson(response, 400, {error: 'bad_group', message: 'Некорректный номер группы'})
			return
		}

		const payload = await cached(`group:${session}:${group}`, forceReload, () => fetchGroupSchedule(group, session))
		sendJson(response, 200, payload)
		return
	}

	sendJson(response, 404, {error: 'not_found', message: 'Метод расписания не найден'})
}

async function fetchScheduleGroups(session) {
	const pageUrl = `${RASP_BASE_URL}${session ? '/session' : '/'}`
	const html = await fetchText(pageUrl, {
		headers: {
			Accept: 'text/html',
			'User-Agent': 'navigation-master schedule proxy',
		},
	})
	const match = html.match(/var\s+globalListGroups\s*=\s*(\{[\s\S]*?\})\.groups\s*;/)
	if (!match) throw new Error('Не удалось найти список групп на странице расписания')

	const parsed = JSON.parse(match[1])
	const groups = Object.entries(parsed.groups || {}).map(([name, isDpo]) => ({
		name,
		isDpo: Boolean(isDpo),
	}))

	return {
		meta: {
			date: parsed.date,
			time: parsed.time,
			source: pageUrl,
		},
		groups,
	}
}

async function fetchGroupSchedule(group, session) {
	const scheduleUrl = new URL('/site/group', RASP_BASE_URL)
	scheduleUrl.searchParams.set('group', group)
	scheduleUrl.searchParams.set('session', String(session))

	return fetchJson(scheduleUrl, {
		headers: {
			Accept: 'application/json, text/javascript, */*; q=0.01',
			Referer: `${RASP_BASE_URL}${session ? '/session' : '/'}`,
			'User-Agent': 'navigation-master schedule proxy',
			'X-Requested-With': 'XMLHttpRequest',
		},
	})
}

async function cached(key, forceReload, loader) {
	const cachedValue = cache.get(key)
	if (!forceReload && cachedValue && Date.now() - cachedValue.createdAt < CACHE_TTL_MS) {
		return cachedValue.payload
	}

	const payload = await loader()
	cache.set(key, {createdAt: Date.now(), payload})
	return payload
}

async function fetchText(url, options) {
	const response = await fetch(url, options)
	if (!response.ok) {
		throw new Error(`${url}: ${response.status}`)
	}
	return response.text()
}

async function fetchJson(url, options) {
	const response = await fetch(url, options)
	const text = await response.text()
	if (!response.ok) {
		throw new Error(`${url}: ${response.status} ${text.slice(0, 300)}`)
	}
	return JSON.parse(text)
}

function normalizeRequestedGroup(value) {
	const group = String(value || '').trim()
	if (!group || group.length > 60) return ''
	return /^[\p{L}\p{N}_-]+$/u.test(group) ? group : ''
}

async function serveStaticFile(requestUrl, response) {
	const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname
	const decodedPath = decodeURIComponent(pathname)
	const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '')
	const filePath = path.join(ROOT, normalizedPath)

	if (!filePath.startsWith(ROOT)) {
		response.writeHead(403)
		response.end('Forbidden')
		return
	}

	try {
		const stat = await fs.stat(filePath)
		if (stat.isDirectory()) {
			response.writeHead(403)
			response.end('Forbidden')
			return
		}

		const content = await fs.readFile(filePath)
		response.writeHead(200, {
			'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
		})
		response.end(content)
	} catch (error) {
		if (error.code === 'ENOENT') {
			response.writeHead(404)
			response.end('Not found')
			return
		}
		throw error
	}
}

function sendJson(response, statusCode, payload) {
	response.writeHead(statusCode, {
		'Access-Control-Allow-Origin': '*',
		'Content-Type': 'application/json; charset=UTF-8',
	})
	response.end(JSON.stringify(payload))
}
