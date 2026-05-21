class Settings {
	static auditoriumsColors = ['#3B3C41', '#23242B']
	static entrancesColors = ['#9CBBFF']
	static entrancesTag = 'circle'
	static auditoriumsEntrances = new Map()
	static auditoriumsRusNames = new Map()
	static auditoriumsEngNames = new Map()
	static planStyleLink = '../css/plan-style.css'
	static maps = new Map([
		['a-2', {
			label: 'Корпус А · 2 этаж',
			planName: 'resources/plans/a/A-2.svg',
			graphName: 'resources/plans/a/A-2-GRAPH.svg'
		}],
		['a-1', {
			label: 'Корпус А · 1 этаж',
			planName: 'resources/plans/a/A-1.svg',
			graphName: 'resources/plans/a/A-1-GRAPH.svg'
		}],
		['pk-24', {
			label: 'ПК-24',
			planName: 'resources/plans/PK-24.svg',
			graphName: 'resources/plans/PK-24-GRAPH.svg'
		}]
	])
	static currentMapKey = 'a-2'
	static planName = Settings.maps.get('a-2').planName
	static graphName = Settings.maps.get('a-2').graphName
	static wayColor = '#3CD288'
	static wayWidth = '4px'
}

let auditoriumsEntrances = [
	["a-112a", "8"], ["a-108", "6"], ["a-112v", "9"], ["a-1-stair-2", "20"], ["a-100", "33"], ["a-1-stair-1", "32"], ["a-112", "21"], ["a-113", "22"], ["a-114", "23"], ["a-115", "24"], ["a-116", "26"], ["a-117", "27"], ["a-118", "28"], ["a-119", "30"], ["a-120", "31"], ["a-1-wc-2", "29"], ["a-1-stair-5", "25"],
	["a-200", "27"], ["a-205", "8"], ["a-211", "17"], ["a-212", "15"], ["a-214", "14"], ["a-215", "18"], ["a-216", "20"], ["a-218", "25"], ["a-219", "22"], ["a-220", "21"], ["a-221", "19"], ["a-224", "23"], ["a-2-stair-2", "6"], ["a-2-stair-3", "26"], ["a-2-stair-4", "24"], ["a-2-wc-2", "16"],
]
Settings.auditoriumsEntrances = new Map(auditoriumsEntrances)

let auditoriumsRusNames = [['a-2-stair-1','Р›РµСЃС‚РЅРёС†Р° #1 2 СЌС‚Р°Р¶ Рђ'],['a-204','Рђ204'],['a-203','Рђ203'],['a-205','Рђ205'],['a-206','Рђ206'],['a-207','Рђ207'],['a-208','Рђ208'],['a-209','Рђ209'],['a-210','Рђ210'],['a-200','Рђ200'],['a-224','Рђ224'],['a-216','Рђ216'],['a-215','Рђ215'],['a-211','Рђ211'],['a-218','Рђ218'],['a-219','Рђ219'],['a-220','Рђ220'],['a-221','Рђ221'],['a-212','Рђ212'],['a-2-wc-2','РўСѓР°Р»РµС‚ Р–'],['a-214','Рђ214'],['a-202','Рђ202'],['a-201','Рђ201'],['a-2-wc-1','РўСѓР°Р»РµС‚ Рњ'],['a-2-stair-2','Р›РµСЃС‚РЅРёС†Р° #2 2 СЌС‚Р°Р¶ Рђ'],['a-2-stair-4','Р›РµСЃС‚РЅРёС†Р° #4 2 СЌС‚Р°Р¶ Рђ'],['a-2-stair-3','Р›РµСЃС‚РЅРёС†Р° #3 2 СЌС‚Р°Р¶ Рђ']]
let auditoriumsEngNames = []
for (const auditoriumsRusName of auditoriumsRusNames) {
	let nameRusEng = [auditoriumsRusName[1], auditoriumsRusName[0]]
	auditoriumsEngNames.push(nameRusEng)
}
Settings.auditoriumsEngNames = new Map(auditoriumsEngNames)
Settings.auditoriumsRusNames = new Map(auditoriumsRusNames)

class Vertex {
	constructor(x, y, id = '', type = '') {
		this.x = x
		this.y = y
		this.id = id
		this.type = type
		this.neighboringIDs = new Set()
	}
}

class Edge {
	id
	idVertex1
	idVertex2
	weight
	type

	constructor(id = '', idVertex1 = '', idVertex2 = '', weight = 0, type = '') {
		this.id = id
		this.idVertex1 = idVertex1
		this.idVertex2 = idVertex2
		this.weight = weight
		this.type = type
	}
}

class Graph {
	vertexes = []
	vertexIdIterator = 0
	rawEdges = []
	edges = []
	$graphObject
	auditoriumsVertexesMap = new Map()

	constructor($graphObject) {
		this.$graphObject = $graphObject
	}

	addVertexByXY(x, y, type = '') {
		if (!this.getVertexByXY(x, y)) {
			this.vertexes.push(new Vertex(x, y, String(this.vertexIdIterator), type))
			this.vertexIdIterator++
		}
	}

	getVertexByXY(x, y) {
		return this.vertexes.find(vertex => vertex.x === x && vertex.y === y)
	}

	getVertexByID(id = '') {
		return this.vertexes.find(vertex => vertex.id === id)
	}

	getDistanceBetween2VertexesByID(idVertex1, idVertex2) {
		let vertex1 = this.getVertexByID(idVertex1)
		let vertex2 = this.getVertexByID(idVertex2)
		if (vertex1.neighboringIDs.has(vertex2.id)) {
			return Number((((vertex2.x - vertex1.x) ** 2 + (vertex2.y - vertex1.y) ** 2) ** 0.5).toFixed(2))
		}
	}

	tracing($tableOfEdges) {
		let allPaths = this.$graphObject.contentDocument.getElementsByTagName('path')

		function getGraphPaths() {
			let paths = []
			for (let path of allPaths) {
				let edgeColor = '#FF5F5F'
				if (path.getAttribute('stroke') === edgeColor) paths.push(path)
			}
			return paths
		}

		let graphPaths = getGraphPaths()

		function parseEdgesFromPaths(path) {
			let id = path.getAttribute('id')
			let coordinates = path.getAttribute('d').substring(1).replaceAll('.5', '')
			let firstSpace = coordinates.indexOf(' ')
			let x1, y1, x2, y2

			x1 = coordinates.substring(0, firstSpace)
			coordinates = coordinates.substring(firstSpace + 1)

			let secondLetterPosition

			if (coordinates.indexOf('H') !== -1) {
				secondLetterPosition = coordinates.indexOf('H')
				y1 = coordinates.substring(0, secondLetterPosition)
				y2 = y1
				x2 = coordinates.substring(secondLetterPosition + 1)
			} else if (coordinates.indexOf('V') !== -1) {
				secondLetterPosition = coordinates.indexOf('V')
				y1 = coordinates.substring(0, secondLetterPosition)
				x2 = x1
				y2 = coordinates.substring(secondLetterPosition + 1)
			} else if (coordinates.indexOf('L') !== -1) {
				secondLetterPosition = coordinates.indexOf('L')
				y1 = coordinates.substring(0, secondLetterPosition)
				coordinates = coordinates.substring(secondLetterPosition + 1)
				let secondSpace = coordinates.indexOf(' ')
				x2 = coordinates.substring(0, secondSpace)
				y2 = coordinates.substring(secondSpace + 1)
			}

			if (x1 >= x2 && y1 >= y2) {
				let t = x2
				x2 = x1
				x1 = t
				t = y2
				y2 = y1
				y1 = t
			}

			let weight = Number((((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5).toFixed(2))
			return {id, x1: Number(x1), y1: Number(y1), x2: Number(x2), y2: Number(y2), weight, type: 'same-floor'}
		}

		let edgesProperties = []
		graphPaths.forEach(path => {
			edgesProperties.push(parseEdgesFromPaths(path))
			path.setAttribute('stroke-width', '3')
		})

		function addTdToTr(value, cellClass, tr) {
			let td = document.createElement('td')
			td.innerHTML = value
			td.setAttribute('class', String(cellClass))
			tr.appendChild(td)
		}

		function timeoutAppendRowToTable(row) {
			$tableOfEdges.appendChild(row)
		}

		let timeout = 0
		edgesProperties.forEach(edge => {
			let row = document.createElement('tr')
			addTdToTr(edge.id, 'id', row)
			addTdToTr(edge.x1, 'id', row)
			addTdToTr(edge.y1, 'id', row)
			addTdToTr(edge.x2, 'id', row)
			addTdToTr(edge.y2, 'id', row)
			addTdToTr(edge.weight, 'id', row)
			addTdToTr(edge.type, 'id', row)
			setTimeout(timeoutAppendRowToTable, timeout, row)
			timeout += 50
		})
		this.rawEdges = edgesProperties
	}

	createVertexesList() {
		for (let rawEdge of this.rawEdges) {
			this.addVertexByXY(rawEdge.x1, rawEdge.y1, 'hallway')
			this.addVertexByXY(rawEdge.x2, rawEdge.y2, 'hallway')
		}
	}

	fillGraph() {
		for (let rawEdge of this.rawEdges) {
			let vertex1 = this.getVertexByXY(rawEdge.x1, rawEdge.y1)
			let vertex2 = this.getVertexByXY(rawEdge.x2, rawEdge.y2)
			let type
			if (vertex1.type === 'entranceToAu' || vertex2.type === 'entranceToAu') type = 'entranceToAu'
			else type = rawEdge.type

			let edge = new Edge(rawEdge.id, vertex1.id, vertex2.id, rawEdge.weight, type)
			this.edges.push(edge)

			vertex1.neighboringIDs.add(vertex2.id)
			vertex2.neighboringIDs.add(vertex1.id)
		}
	}

	showGraph($graphMarkers, $similarElement) {
		$graphMarkers.setAttribute('viewBox', $similarElement.getAttribute('viewBox'))
		for (let vertex of this.vertexes) {
			let $idEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
			$idEl.classList.add('vertex-id')
			let $idElTspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
			$idElTspan.setAttribute('x', `${vertex.x}`)
			$idElTspan.setAttribute('y', `${vertex.y}`)
			$idElTspan.innerHTML = vertex.id
			$idEl.appendChild($idElTspan)
			$graphMarkers.appendChild($idEl)
		}

		for (let edge of this.edges) {
			let $idEl = document.createElement('div')
			let vertex1 = this.getVertexByID(edge.idVertex1)
			let vertex2 = this.getVertexByID(edge.idVertex2)
			let left = ((vertex1.x + vertex2.x) / 2).toFixed(0)
			let top = ((vertex1.y + vertex2.y) / 2 - 7).toFixed(0)
			$idEl.classList.add('edge-id')
			$idEl.style.left = `${left}px`
			$idEl.style.top = `${top}px`
			$idEl.innerHTML = edge.weight
			$graphMarkers.appendChild($idEl)
		}
	}

	getShortestWayFromTo(idVertex1, idVertex2) {
		let distances = new Map()
		let ways = new Map()
		for (let vertex of this.vertexes) {
			distances.set(vertex.id, Infinity)
			ways.set(vertex.id, [])
		}
		distances.set(idVertex1, 0)

		let finals = new Set()
		let currentVertexID = idVertex1

		while (finals.size !== this.vertexes.length) {
			let currentVertexDistance = distances.get(currentVertexID)
			for (let neighborId of this.getVertexByID(currentVertexID).neighboringIDs) {
				let distanceBetweenCurrentAndNeighbor = this.getDistanceBetween2VertexesByID(currentVertexID, neighborId)
				let neighborDistance = distances.get(neighborId)

				if (currentVertexDistance + distanceBetweenCurrentAndNeighbor < neighborDistance) {
					distances.set(neighborId, currentVertexDistance + distanceBetweenCurrentAndNeighbor)
					let wayToRelaxingVertex = Array.from(ways.get(currentVertexID))
					wayToRelaxingVertex.push(currentVertexID)
					ways.set(neighborId, wayToRelaxingVertex)
				}
			}

			finals.add(currentVertexID)

			let minDistance = Infinity
			let nextVertexID = ''
			for (let [id, distance] of distances) {
				if (distance < minDistance && !finals.has(id)) {
					minDistance = distance
					nextVertexID = id
				}
			}
			if (minDistance === Infinity) break
			currentVertexID = nextVertexID
		}

		for (let [id, way] of ways) {
			way.push(id)
		}

		return {
			way: ways.get(idVertex2),
			distance: Math.floor(distances.get(idVertex2))
		}
	}

	fillAuditoriumsVertexes(auditoriumsEntrancesMap, $svgPlan) {
		for (const [auditoriumID, entranceID] of auditoriumsEntrancesMap) {
			let $entrance = $svgPlan.getElementById(entranceID)
			if ($entrance !== null) {
				let cx = Number($entrance.getAttribute('cx'))
				let cy = Number($entrance.getAttribute('cy'))
				let vertex = this.getVertexByXY(cx, cy)
				if (vertex !== undefined) {
					let oldVertexId = vertex.id
					vertex.id = auditoriumID
					for (let vertexWithNeighbors of this.vertexes) {
						if (vertexWithNeighbors.neighboringIDs.has(oldVertexId)) {
							vertexWithNeighbors.neighboringIDs.delete(oldVertexId)
							vertexWithNeighbors.neighboringIDs.add(vertex.id)
						}
					}
					for (let edge of this.edges) {
						if (edge.idVertex1 === oldVertexId) edge.idVertex1 = vertex.id
						if (edge.idVertex2 === oldVertexId) edge.idVertex2 = vertex.id
					}
					vertex.type = 'entrancesToAu'
					this.auditoriumsVertexesMap.set(auditoriumID, vertex.id)
				}
			}
		}
	}

	tracingCross() {
		function isPointOnLineSegment(x1, y1, x2, y2, x, y) {
			const lengthAB = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
			const k = Math.min(1, Math.max(0, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / (lengthAB ** 2)))
			const xc = x1 + (x2 - x1) * k
			const yc = y1 + (y2 - y1) * k
			const distance = Math.sqrt((xc - x) ** 2 + (yc - y) ** 2)
			return distance <= 1 && (k > 0 && k < 1)
		}

		function compare(field, order) {
			let len = arguments.length
			if (len === 0) {
				return (a, b) => (a < b && -1) || (a > b && 1) || 0
			}
			if (len === 1) {
				switch (typeof field) {
					case 'number':
						return field < 0
							? ((a, b) => (a < b && 1) || (a > b && -1) || 0)
							: ((a, b) => (a < b && -1) || (a > b && 1) || 0)
					case 'string':
						return (a, b) => (a[field] < b[field] && -1) || (a[field] > b[field] && 1) || 0
				}
			}
			if (len === 2 && typeof order === 'number') {
				return order < 0
					? ((a, b) => (a[field] < b[field] && 1) || (a[field] > b[field] && -1) || 0)
					: ((a, b) => (a[field] < b[field] && -1) || (a[field] > b[field] && 1) || 0)
			}
			let fields, orders
			if (typeof field === 'object') {
				fields = Object.getOwnPropertyNames(field)
				orders = fields.map(key => field[key])
				len = fields.length
			} else {
				fields = new Array(len)
				orders = new Array(len)
				for (let i = len; i--;) {
					fields[i] = arguments[i]
					orders[i] = 1
				}
			}
			return (a, b) => {
				for (let i = 0; i < len; i++) {
					if (a[fields[i]] < b[fields[i]]) return orders[i]
					if (a[fields[i]] > b[fields[i]]) return -orders[i]
				}
				return 0
			}
		}

		let hallwayVertexes = []
		for (let vertex of this.vertexes) {
			if (vertex.type === 'hallway') hallwayVertexes.push(vertex)
		}
		let splittingEdges = new Map()
		for (let vertex of hallwayVertexes) {
			for (let edge of this.edges) {
				if (edge.idVertex1 !== vertex.id && edge.idVertex2 !== vertex.id) {
					let {x: x1, y: y1} = this.getVertexByID(edge.idVertex1)
					let {x: x2, y: y2} = this.getVertexByID(edge.idVertex2)
					let {x, y} = vertex
					if (isPointOnLineSegment(x1, y1, x2, y2, x, y)) {
						if (splittingEdges.get(edge) === undefined) splittingEdges.set(edge, [])
						splittingEdges.get(edge).push(vertex)
					}
				}
			}
		}

		function getSplitEdges(edge, vertexes) {
			let vertex1 = vertexes.shift()
			let splitEdges = []
			for (let vertex2 of vertexes) {
				let {x: x1, y: y1} = vertex1
				let {x: x2, y: y2} = vertex2
				let type = 'same-floor'
				if (vertex1.type === 'entranceToAu' || vertex2.type === 'entranceToAu') type = 'entranceToAu'
				let weight = Number((((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5).toFixed(2))
				splitEdges.push(new Edge(String(iterator), vertex1.id, vertex2.id, weight, type))
				vertex1.neighboringIDs.add(vertex2.id)
				vertex2.neighboringIDs.add(vertex1.id)
				vertex1 = vertex2
				iterator++
			}
			return splitEdges
		}

		let iterator = 0
		for (let [edge, vertexes] of splittingEdges) {
			vertexes.unshift(this.getVertexByID(edge.idVertex1))
			vertexes.unshift(this.getVertexByID(edge.idVertex2))
			vertexes.sort(compare('y'))
			vertexes.sort(compare('x'))

			let splitEdges = getSplitEdges(edge, vertexes)
			let index = this.edges.indexOf(edge)
			this.edges.splice(index, 1, ...splitEdges)
		}
	}
}

function activateButton(buttonClassName) {
	document.getElementsByClassName(buttonClassName)[0].classList.remove('non-active-button')
}

function deactivateButton(buttonClassName) {
	document.getElementsByClassName(buttonClassName)[0].classList.add('non-active-button')
}

class PlanHandler {
	$planObject
	$svgPlan
	auditoriums = new Map()
	entrances = new Map()
	AuditoriumsIdEntrancesId = new Map()
	$selector
	$fromInput
	$toInput
	$bFrom
	$bTo
	currentAuId
	fromId
	toId

	constructor($planObject) {
		this.$planObject = $planObject
	}

	onPlanLoad() {
		this.auditoriums = new Map()
		this.entrances = new Map()
		this.AuditoriumsIdEntrancesId = new Map()
		this.currentAuId = undefined
		let $planDocument = this.$planObject.contentDocument
		this.$svgPlan = $planDocument.documentElement.cloneNode(true)
		for (const $oldPlan of document.querySelectorAll('.plan')) $oldPlan.remove()
		this.$svgPlan.removeAttribute('width')
		this.$svgPlan.removeAttribute('height')
		this.$svgPlan.classList.add('plan')
		this.$planObject.before(this.$svgPlan)
		$planDocument.documentElement.remove()

		let planElements = this.$svgPlan.getElementsByTagName('*')
		for (const $el of planElements) {
			if (Settings.auditoriumsColors.includes($el.getAttribute('fill'))) {
				this.auditoriums.set($el.id, $el)
				$el.classList.add('auditorium')
			} else if ($el.tagName === Settings.entrancesTag && Settings.entrancesColors.includes($el.getAttribute('fill'))) {
				this.entrances.set($el.id, $el)
				$el.classList.add('entrance')
				$el.setAttribute('fill-opacity', '0')
			}
		}

		function isEntranceOfAuditorium($entrance, $auditorium) {
			let cx = Number($entrance.getAttribute('cx'))
			let cy = Number($entrance.getAttribute('cy'))
			let x = Number($auditorium.getAttribute('x'))
			let y = Number($auditorium.getAttribute('y'))
			let width = Number($auditorium.getAttribute('width'))
			let height = Number($auditorium.getAttribute('height'))
			return cx >= x && cx <= x + width && cy >= y && cy <= y + height
		}

		for (const [auditoriumId, $auditorium] of this.auditoriums) {
			if (Settings.auditoriumsEntrances.get(auditoriumId) !== undefined) {
				this.AuditoriumsIdEntrancesId.set(auditoriumId, Settings.auditoriumsEntrances.get(auditoriumId))
			} else {
				for (const [entranceId, $entrance] of this.entrances) {
					if (isEntranceOfAuditorium($entrance, $auditorium)) {
						this.AuditoriumsIdEntrancesId.set(auditoriumId, entranceId)
					}
				}
			}
		}

		for (const [auId, $au] of this.auditoriums) {
			$au.addEventListener('click', event => this.onAuditoriumClicked(auId, event))
		}
	}

	setSelectorElements($selector, $bFrom, $bTo) {
		this.$selector = $selector
		this.$selector.setAttribute('auID', '')
		this.$bFrom = $bFrom
		this.$bTo = $bTo
		this.$bFrom.addEventListener('mousedown', () => this.onBFromClicked())
		this.$bTo.addEventListener('mousedown', () => this.onBToClicked())
		this.$fromInput = document.querySelector('#input-from')
		this.$toInput = document.querySelector('#input-to')
	}

	flipFromTo() {
		let tInputValue = this.$fromInput.value
		this.$fromInput.value = this.$toInput.value
		this.$toInput.value = tInputValue

		let tId = this.fromId
		this.fromId = this.toId
		this.toId = tId
	}

	onBFromClicked() {
		routeSelection.fromId = this.currentAuId
		routeSelection.fromMapKey = Settings.currentMapKey
		this.fromId = this.currentAuId
		updateSelectionInputs()
		this.onAuditoriumClicked(this.currentAuId, null)
		if (routeSelection.fromId !== undefined && routeSelection.toId !== undefined) {
			document.querySelector('.build-way').click()
		}
	}

	onBToClicked() {
		routeSelection.toId = this.currentAuId
		routeSelection.toMapKey = Settings.currentMapKey
		this.toId = this.currentAuId
		updateSelectionInputs()
		this.onAuditoriumClicked(this.currentAuId, null)
		if (routeSelection.fromId !== undefined && routeSelection.toId !== undefined) {
			document.querySelector('.build-way').click()
		}
	}

	onAuditoriumClicked(clickedAuId, event) {
		for (const [auditoriumID, $auditorium] of this.auditoriums) {
			if (auditoriumID !== clickedAuId) $auditorium.classList.remove('selected')
			else $auditorium.classList.toggle('selected')
		}

		let clickedAuditoriumEntranceId = this.AuditoriumsIdEntrancesId.get(clickedAuId)
		for (const [entranceID, $entrance] of this.entrances) {
			if (entranceID !== clickedAuditoriumEntranceId) $entrance.classList.remove('selected-entrance')
			else $entrance.classList.toggle('selected-entrance')
		}

		let isSelected = this.auditoriums.get(clickedAuId).classList.contains('selected')
		this.showSelector(event, isSelected, clickedAuId)
	}

	showSelector(event, isSelected, clickedAuId) {
		this.currentAuId = clickedAuId
		if (isSelected && event) {
			this.$selector.classList.remove('showing-selector')
			setTimeout((planHandler) => {
				planHandler.$selector.style.left = `${event.clientX}px`
				planHandler.$selector.style.top = `${event.clientY}px`
				planHandler.$selector.classList.remove('hidden-selector')
				planHandler.$selector.classList.add('showing-selector')
				if (this.currentAuId === this.fromId) deactivateButton('button-from')
				else activateButton('button-from')
				if (this.currentAuId === this.toId) deactivateButton('button-to')
				else activateButton('button-to')
			}, 20, this)
		} else {
			this.$selector.classList.remove('showing-selector')
			this.$selector.classList.add('hidden-selector')
		}
		this.$selector.setAttribute('auID', clickedAuId)
	}
}

class Way {
	$svg

	constructor($svg) {
		this.$svg = $svg
	}

	setupWay($similarElement) {
		this.$svg.setAttribute('viewBox', $similarElement.getAttribute('viewBox'))
	}

	build(graph, wayAndDistance) {
		this.removeOldWays()
		let distance = wayAndDistance.distance
		this.$svg.setAttribute('style', `stroke-dashoffset: ${distance}; stroke-dasharray: ${distance};`)

		let d = 'M'
		for (const vertexID of wayAndDistance.way) {
			let vertex = graph.getVertexByID(vertexID)
			d += `${vertex.x} ${vertex.y}L`
		}
		d = d.slice(0, -1)

		let $path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
		$path.setAttribute('d', d)
		$path.setAttribute('stroke', Settings.wayColor)
		$path.setAttribute('stroke-width', Settings.wayWidth)
		$path.setAttribute('marker-start', 'url(#start-dot)')
		$path.classList.add('way-path')
		this.$svg.prepend($path)
		setTimeout(function () {
			$path.setAttribute('marker-end', 'url(#end-arrow)')
		}, 1000)
	}

	removeOldWays() {
		for (const $oldPath of this.$svg.getElementsByClassName('way-path')) {
			$oldPath.remove()
		}
	}
}

class DragHandler {
	$dragAble
	$scaleAble
	$wrapper
	$bPlus
	$bMinus

	constructor($dragAble, $scaleAble, $wrapper, $bPlus, $bMinus) {
		this.$dragAble = $dragAble
		this.$scaleAble = $scaleAble
		this.$bPlus = $bPlus
		this.$bMinus = $bMinus
		this.$wrapper = $wrapper
		let currentScale = 1

		this.$wrapper.addEventListener('mousedown', startMove)
		this.$wrapper.addEventListener('touchstart', startMove, 'mouse')

		function startMove(eventMD) {
			let startLeft = $dragAble.offsetLeft
			let startTop = $dragAble.offsetTop
			let startX = eventMD.type === 'mousedown' ? eventMD.clientX : eventMD.touches[0].clientX
			let startY = eventMD.type === 'mousedown' ? eventMD.clientY : eventMD.touches[0].clientY

			document.addEventListener('mousemove', onMouseMove)
			document.addEventListener('touchmove', onMouseMove)

			function onMouseMove(eventMM) {
				$dragAble.style.pointerEvents = 'none'
				let clientX = eventMM.type === 'mousemove' ? eventMM.clientX : eventMM.touches[0].clientX
				let clientY = eventMM.type === 'mousemove' ? eventMM.clientY : eventMM.touches[0].clientY
				$dragAble.style.top = `${(clientY - startY) / currentScale + startTop}px`
				$dragAble.style.left = `${(clientX - startX) / currentScale + startLeft}px`
			}

			document.addEventListener('mouseup', moveEnd)
			document.addEventListener('touchend', moveEnd)
			document.addEventListener('touchcancel', moveEnd)

			function moveEnd() {
				$dragAble.style.pointerEvents = 'auto'
				document.removeEventListener('mousemove', onMouseMove)
				document.removeEventListener('touchmove', onMouseMove)
				document.removeEventListener('mouseup', moveEnd)
				document.removeEventListener('touchend', moveEnd)
				document.removeEventListener('touchcancel', moveEnd)
			}
		}

		this.$bPlus.addEventListener('click', () => scale(this, 1.8))
		this.$bMinus.addEventListener('click', () => scale(this, 1 / 1.8))

		function scale(dragHandler, scaleValue) {
			let newScale = Math.round((currentScale * scaleValue) * 100) / 100
			dragHandler.$scaleAble.style.transform = `scale(${newScale})`
			currentScale = newScale
		}

		let wheelSum = 0
		$wrapper.addEventListener('wheel', function (eventWH) {
			wheelSum += eventWH.wheelDelta
			if (Math.abs(wheelSum) > 200) {
				if (eventWH.wheelDelta > 0) scale(this, 1.5)
				else if (eventWH.wheelDelta < 0) scale(this, 1 / 1.5)
				wheelSum = 0
			} else if (Math.abs(wheelSum) > 120) {
				if (eventWH.wheelDelta > 0) scale(this, 1.15)
				else if (eventWH.wheelDelta < 0) scale(this, 1 / 1.15)
				wheelSum = 0
			}
		}.bind(this))
	}
}

class Names {
	static generateRusName(name = '') {
		let rusName = ''
		let corpus = ''
		if (name.startsWith('a')) corpus = 'Рђ'
		rusName += corpus
		let firstTire = name.indexOf('-')
		let secondTire = name.indexOf('-', firstTire + 1)
		if (secondTire === -1) secondTire = name.length
		rusName += name.substring(firstTire + 1, secondTire)
	}
}

let planHandler = new PlanHandler(document.querySelector('.plan-object'))
planHandler.$planObject.data = Settings.planName
planHandler.setSelectorElements(
	document.querySelector('.selector'),
	document.querySelector('.button-from'),
	document.querySelector('.button-to')
)

let dragHandler = new DragHandler(
	document.querySelector('.drag-able'),
	document.querySelector('.scale-able'),
	document.querySelector('.map-wrapper'),
	document.querySelector('.button-plus'),
	document.querySelector('.button-minus')
)

let graph = new Graph(document.querySelector('.graph'))
graph.$graphObject.data = Settings.graphName

let way = new Way(document.querySelector('.svg-way'))
let $tableOfEdge = document.getElementsByClassName('list-of-edges')[0]
let $mapSelect = document.getElementById('map-select')
let $menuTabs = document.querySelectorAll('.menu-tab')
let $menuPanels = document.querySelectorAll('.menu-panel')
let $groupScheduleInput = document.getElementById('input-group-schedule')
let $groupScheduleButton = document.querySelector('.load-group-schedule')
let $refreshGroupListButton = document.querySelector('.refresh-group-list')
let $groupSuggestions = document.getElementById('group-suggestions')
let $scheduleStatus = document.querySelector('.schedule-status')
let $scheduleOutput = document.querySelector('.schedule-output')
$mapSelect.value = Settings.currentMapKey
let isPlanLoaded = false
let isGraphLoaded = false
let isGraphPrepared = false
let floorGraphs = new Map()
let routeSelection = {
	fromId: undefined,
	fromMapKey: undefined,
	toId: undefined,
	toMapKey: undefined
}
let stairPairs = [
	['a-1-stair-1', 'a-2-stair-1'],
	['a-1-stair-2', 'a-2-stair-2'],
	['a-1-stair-3', 'a-2-stair-3'],
	['a-1-stair-4', 'a-2-stair-4']
]
let dayLabels = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
let scheduleDatasetsCache = new Map()
let availableGroups = []
let groupsLoaded = false

function eraseTable($table, $svgGraph) {
	while ($table.hasChildNodes()) $table.firstChild.remove()
	$svgGraph.data = Settings.graphName
}

function getAuditoriumLabel(auditoriumId) {
	return Settings.auditoriumsRusNames.get(auditoriumId) || auditoriumId
}

function getMapLabel(mapKey) {
	let mapConfig = Settings.maps.get(mapKey)
	return mapConfig ? mapConfig.label : mapKey
}

function updateSelectionInputs() {
	let fromLabel = routeSelection.fromId
		? `${getMapLabel(routeSelection.fromMapKey)} · ${getAuditoriumLabel(routeSelection.fromId)}`
		: ''
	let toLabel = routeSelection.toId
		? `${getMapLabel(routeSelection.toMapKey)} · ${getAuditoriumLabel(routeSelection.toId)}`
		: ''

	document.getElementById('input-from').value = fromLabel
	document.getElementById('input-to').value = toLabel
}

function getGraphForMap(mapKey) {
	if (mapKey === Settings.currentMapKey && isGraphPrepared) return graph
	return floorGraphs.get(mapKey)
}

function isBetweenA1AndA2(fromMapKey, toMapKey) {
	return (fromMapKey === 'a-1' && toMapKey === 'a-2') || (fromMapKey === 'a-2' && toMapKey === 'a-1')
}

function activateMenuTab(tabName) {
	$menuTabs.forEach($tab => {
		$tab.classList.toggle('active-tab', $tab.dataset.tab === tabName)
	})
	$menuPanels.forEach($panel => {
		$panel.classList.toggle('active-panel', $panel.dataset.panel === tabName)
	})
	if (tabName === 'schedule' && !groupsLoaded) {
		loadAvailableGroups().catch(() => {
			$scheduleStatus.textContent = 'Не удалось загрузить список групп'
		})
	}
}

function stripHtml(html = '') {
	let container = document.createElement('div')
	container.innerHTML = html
	return (container.textContent || container.innerText || '').trim()
}

function normalizeGroupName(value = '') {
	return value
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '')
		.replace(/[–—−]/g, '-')
}

async function fetchScheduleDataset(datasetName) {
	if (scheduleDatasetsCache.has(datasetName)) {
		return scheduleDatasetsCache.get(datasetName)
	}

	let urls = [
		`https://rasp.dmami.ru/${datasetName}.json`,
		`./polydroid-api-master/schedule_parser/json/${datasetName}.json`
	]

	for (const url of urls) {
		try {
			let response = await fetch(url)
			if (!response.ok) continue
			let data = await response.json()
			scheduleDatasetsCache.set(datasetName, data)
			return data
		} catch (error) {
			continue
		}
	}

	throw new Error(`Не удалось загрузить ${datasetName}.json`)
}

function findGroupContent(dataset, groupName) {
	let normalizedGroup = normalizeGroupName(groupName)
	return dataset.contents.find(content => {
		let title = content.group && content.group.title ? content.group.title : ''
		return normalizeGroupName(title) === normalizedGroup
	})
}

function renderGroupSuggestions() {
	$groupSuggestions.replaceChildren()
	for (const groupName of availableGroups) {
		let $option = document.createElement('option')
		$option.value = groupName
		$groupSuggestions.appendChild($option)
	}
}

async function loadAvailableGroups(forceReload = false) {
	if (groupsLoaded && !forceReload) return availableGroups

	$scheduleStatus.textContent = 'Загрузка списка групп...'

	let groupSet = new Set()
	let datasets = [
		await fetchScheduleDataset('semester'),
		await fetchScheduleDataset('session')
	]

	for (const dataset of datasets) {
		for (const content of dataset.contents || []) {
			let title = content.group && content.group.title ? content.group.title.trim() : ''
			if (title) groupSet.add(title)
		}
	}

	availableGroups = Array.from(groupSet).sort((a, b) => a.localeCompare(b, 'ru'))
	renderGroupSuggestions()
	groupsLoaded = true
	$scheduleStatus.textContent = `Доступно групп: ${availableGroups.length}`
	return availableGroups
}

function resolveSelectedGroupName(inputValue) {
	let normalizedInput = normalizeGroupName(inputValue)
	if (!normalizedInput) return null

	let exactMatch = availableGroups.find(groupName => normalizeGroupName(groupName) === normalizedInput)
	if (exactMatch) return exactMatch

	let partialMatches = availableGroups.filter(groupName => normalizeGroupName(groupName).includes(normalizedInput))
	if (partialMatches.length === 1) return partialMatches[0]

	return null
}

function renderGroupSchedule(groupContent, datasetLabel) {
	$scheduleOutput.replaceChildren()
	let grid = groupContent.grid || {}
	let dayEntries = Object.entries(grid)
	let isSessionGrid = dayEntries.some(([dayKey]) => /^\d{4}-\d{2}-\d{2}$/.test(dayKey))

	if (isSessionGrid) {
		dayEntries.sort((a, b) => a[0].localeCompare(b[0]))
	} else {
		dayEntries.sort((a, b) => Number(a[0]) - Number(b[0]))
	}

	for (const [dayKey, dayGrid] of dayEntries) {
		if (!dayGrid) continue

		let entries = []
		for (let lessonNumber = 1; lessonNumber <= 7; lessonNumber++) {
			let lessons = dayGrid[String(lessonNumber)] || []
			for (const lesson of lessons) {
				entries.push({
					lessonNumber,
					subject: lesson.sbj || 'Без названия',
					teacher: lesson.teacher || 'Преподаватель не указан',
					type: lesson.type || 'Тип не указан',
					dateRange: lesson.dts || '',
					classrooms: (lesson.auditories || []).map(auditory => stripHtml(auditory.title || '')).filter(Boolean)
				})
			}
		}

		if (!entries.length) continue

		let $day = document.createElement('section')
		$day.className = 'schedule-day'

		let $title = document.createElement('h4')
		if (isSessionGrid) {
			let date = new Date(`${dayKey}T00:00:00`)
			let weekday = dayLabels[(date.getDay() + 6) % 7]
			$title.textContent = `${weekday} · ${dayKey}`
		} else {
			$title.textContent = dayLabels[Number(dayKey) - 1] || dayKey
		}
		$day.appendChild($title)

		for (const entry of entries) {
			let $item = document.createElement('div')
			$item.className = 'schedule-item'
			let classroomText = entry.classrooms.length ? ` · ${entry.classrooms.join(', ')}` : ''
			$item.textContent = `${entry.lessonNumber} пара · ${entry.subject} · ${entry.type} · ${entry.teacher}${classroomText}${entry.dateRange ? ` · ${entry.dateRange}` : ''}`
			$day.appendChild($item)
		}

		$scheduleOutput.appendChild($day)
	}

	$scheduleStatus.textContent = `${groupContent.group.title} · ${datasetLabel}`
	if (!$scheduleOutput.childElementCount) {
		$scheduleStatus.textContent += ' · занятий не найдено'
	}
}

async function loadGroupSchedule() {
	let rawGroupName = $groupScheduleInput.value.trim()
	if (!rawGroupName) {
		$scheduleStatus.textContent = 'Введите номер группы'
		$scheduleOutput.replaceChildren()
		return
	}

	$scheduleStatus.textContent = 'Подготовка списка групп...'
	$scheduleOutput.replaceChildren()

	try {
		await loadAvailableGroups()
		let groupName = resolveSelectedGroupName(rawGroupName)
		if (!groupName) {
			$scheduleStatus.textContent = 'Группа не найдена в списке. Выберите вариант из подсказок'
			return
		}

		$groupScheduleInput.value = groupName
		$scheduleStatus.textContent = 'Загрузка расписания...'

		let semesterDataset = await fetchScheduleDataset('semester')
		let semesterGroup = findGroupContent(semesterDataset, groupName)
		if (semesterGroup) {
			renderGroupSchedule(semesterGroup, 'семестр')
			return
		}

		let sessionDataset = await fetchScheduleDataset('session')
		let sessionGroup = findGroupContent(sessionDataset, groupName)
		if (sessionGroup) {
			renderGroupSchedule(sessionGroup, 'сессия')
			return
		}

		$scheduleStatus.textContent = 'Группа не найдена'
	} catch (error) {
		$scheduleStatus.textContent = 'Не удалось загрузить расписание'
	}
}

function prepareGraph() {
	if (!isPlanLoaded || !isGraphLoaded || isGraphPrepared) return

	graph.rawEdges = []
	graph.edges = []
	graph.vertexes = []
	graph.vertexIdIterator = 0
	graph.auditoriumsVertexesMap = new Map()
	way.removeOldWays()

	while ($tableOfEdge.hasChildNodes()) $tableOfEdge.firstChild.remove()

	graph.tracing($tableOfEdge)
	graph.createVertexesList()
	graph.fillGraph()
	graph.tracingCross()
	graph.fillAuditoriumsVertexes(planHandler.AuditoriumsIdEntrancesId, planHandler.$svgPlan)
	floorGraphs.set(Settings.currentMapKey, graph)

	activateButton('build-way')
	isGraphPrepared = true
	if (routeSelection.fromId && routeSelection.toId) {
		buildRouteBetweenSelectedAuditoriums()
	}
}

function buildRouteBetweenSelectedAuditoriums() {
	let $output = document.getElementsByClassName('output-way-between-au')[0]

	if (!isGraphPrepared) {
		$output.textContent = 'Граф еще не готов'
		return
	}

	let idVertex1 = planHandler.fromId
	let idVertex2 = planHandler.toId

	if (!idVertex1 || !idVertex2) {
		$output.textContent = 'Выберите две аудитории'
		return
	}

	if (idVertex1 === idVertex2) {
		$output.textContent = 'Выбрана одна и та же аудитория'
		way.removeOldWays()
		return
	}

	let wayAndDistance = graph.getShortestWayFromTo(idVertex1, idVertex2)
	if (!wayAndDistance.way || !wayAndDistance.way.length || !Number.isFinite(wayAndDistance.distance)) {
		$output.textContent = 'Маршрут не найден'
		way.removeOldWays()
		return
	}

	$output.innerHTML = `${getAuditoriumLabel(idVertex1)} → ${getAuditoriumLabel(idVertex2)}<br>Длина: ${wayAndDistance.distance}`
	way.build(graph, wayAndDistance)
}

function buildRouteBetweenSelectedAuditoriums() {
	let $output = document.getElementsByClassName('output-way-between-au')[0]

	if (!routeSelection.fromId || !routeSelection.toId) {
		$output.textContent = 'Выберите две аудитории'
		way.removeOldWays()
		return
	}

	let fromMapKey = routeSelection.fromMapKey
	let toMapKey = routeSelection.toMapKey
	let idVertex1 = routeSelection.fromId
	let idVertex2 = routeSelection.toId

	if (fromMapKey === toMapKey && idVertex1 === idVertex2) {
		$output.textContent = 'Выбрана одна и та же аудитория'
		way.removeOldWays()
		return
	}

	let fromGraph = getGraphForMap(fromMapKey)
	let toGraph = getGraphForMap(toMapKey)

	if (fromMapKey === toMapKey) {
		if (!fromGraph) {
			$output.textContent = 'Граф выбранного этажа еще не готов'
			way.removeOldWays()
			return
		}

		let wayAndDistance = fromGraph.getShortestWayFromTo(idVertex1, idVertex2)
		if (!wayAndDistance.way || !wayAndDistance.way.length || !Number.isFinite(wayAndDistance.distance)) {
			$output.textContent = 'Маршрут не найден'
			way.removeOldWays()
			return
		}

		$output.innerHTML = `${getMapLabel(fromMapKey)}<br>${getAuditoriumLabel(idVertex1)} -> ${getAuditoriumLabel(idVertex2)}<br>Длина: ${wayAndDistance.distance}`
		if (Settings.currentMapKey === fromMapKey && isGraphPrepared) way.build(graph, wayAndDistance)
		else way.removeOldWays()
		return
	}

	if (!isBetweenA1AndA2(fromMapKey, toMapKey)) {
		$output.textContent = 'Маршрут между этими картами не поддерживается'
		way.removeOldWays()
		return
	}

	if (!fromGraph || !toGraph) {
		$output.textContent = 'Откройте A-1 и A-2 по очереди, чтобы подготовить маршрут'
		way.removeOldWays()
		return
	}

	let bestRoute = null
	for (const [a1Stair, a2Stair] of stairPairs) {
		let fromStairId = fromMapKey === 'a-1' ? a1Stair : a2Stair
		let toStairId = toMapKey === 'a-2' ? a2Stair : a1Stair

		if (!fromGraph.getVertexByID(fromStairId) || !toGraph.getVertexByID(toStairId)) continue

		let firstPart = fromGraph.getShortestWayFromTo(idVertex1, fromStairId)
		let secondPart = toGraph.getShortestWayFromTo(toStairId, idVertex2)
		if (!firstPart.way || !secondPart.way) continue
		if (!Number.isFinite(firstPart.distance) || !Number.isFinite(secondPart.distance)) continue

		let totalDistance = firstPart.distance + secondPart.distance + 1
		if (!bestRoute || totalDistance < bestRoute.totalDistance) {
			bestRoute = {
				totalDistance,
				fromStairId,
				toStairId,
				firstPart,
				secondPart
			}
		}
	}

	if (!bestRoute) {
		$output.textContent = 'Маршрут между A-1 и A-2 не найден'
		way.removeOldWays()
		return
	}

	$output.innerHTML =
		`${getMapLabel(fromMapKey)} · ${getAuditoriumLabel(idVertex1)} -> ${getMapLabel(toMapKey)} · ${getAuditoriumLabel(idVertex2)}<br>` +
		`Переход через лестницу: ${getAuditoriumLabel(bestRoute.fromStairId)}<br>` +
		`Общая длина: ${bestRoute.totalDistance}`

	if (Settings.currentMapKey === fromMapKey && isGraphPrepared) {
		way.build(graph, bestRoute.firstPart)
		return
	}

	if (Settings.currentMapKey === toMapKey && isGraphPrepared) {
		way.build(graph, bestRoute.secondPart)
		return
	}

	way.removeOldWays()
}

function resetUiState(clearSelection = false) {
	document.querySelector('.selector').classList.remove('showing-selector')
	document.querySelector('.selector').classList.add('hidden-selector')
	document.querySelector('.graph-markers').replaceChildren()
	document.querySelector('.graph').style.visibility = 'hidden'
	way.removeOldWays()

	document.getElementById('input-idPoint1').value = ''
	document.getElementById('input-idPoint2').value = ''
	document.getElementsByClassName('output-found-way')[0].textContent = ''

	planHandler.currentAuId = undefined
	if (clearSelection) {
		routeSelection.fromId = undefined
		routeSelection.fromMapKey = undefined
		routeSelection.toId = undefined
		routeSelection.toMapKey = undefined
		document.getElementsByClassName('output-way-between-au')[0].textContent = ''
	}
	updateSelectionInputs()

	deactivateButton('build-way')
}

function loadCurrentMap() {
	isPlanLoaded = false
	isGraphLoaded = false
	isGraphPrepared = false
	resetUiState()

	graph = new Graph(document.querySelector('.graph'))
	graph.$graphObject.data = Settings.graphName
	planHandler.$planObject.data = Settings.planName
}

function switchMap(mapKey) {
	let mapConfig = Settings.maps.get(mapKey)
	if (!mapConfig) return

	Settings.currentMapKey = mapKey
	Settings.planName = mapConfig.planName
	Settings.graphName = mapConfig.graphName
	loadCurrentMap()
}

planHandler.$planObject.addEventListener('load', () => {
	planHandler.onPlanLoad()
	way.setupWay(planHandler.$svgPlan)
	isPlanLoaded = true
	prepareGraph()
})

graph.$graphObject.addEventListener('load', () => {
	isGraphLoaded = true
	prepareGraph()
})

$mapSelect.addEventListener('change', event => {
	switchMap(event.target.value)
})

$menuTabs.forEach($tab => {
	$tab.addEventListener('click', () => {
		activateMenuTab($tab.dataset.tab)
	})
})

$groupScheduleButton.addEventListener('click', () => {
	loadGroupSchedule()
})

$refreshGroupListButton.addEventListener('click', () => {
	groupsLoaded = false
	scheduleDatasetsCache.delete('semester')
	scheduleDatasetsCache.delete('session')
	loadAvailableGroups(true).catch(() => {
		$scheduleStatus.textContent = 'Не удалось обновить список групп'
	})
})

$groupScheduleInput.addEventListener('focus', () => {
	if (!groupsLoaded) {
		loadAvailableGroups().catch(() => {
			$scheduleStatus.textContent = 'Не удалось загрузить список групп'
		})
	}
})

$groupScheduleInput.addEventListener('keydown', event => {
	if (event.key === 'Enter') {
		event.preventDefault()
		loadGroupSchedule()
	}
})

document.querySelector('.erase').addEventListener('click', () => {
	let $svgGraph = document.getElementsByClassName('graph')[0]
	eraseTable($tableOfEdge, $svgGraph)
	graph = new Graph(document.querySelector('.graph'))
	graph.rawEdges = []
	graph.$graphObject.data = Settings.graphName
	isGraphLoaded = false
	isGraphPrepared = false

	let $mapObjects = document.getElementsByClassName('map-objects')[0]
	let erasingElements = Array.from($mapObjects.getElementsByClassName('vertex-id'))
		.concat(Array.from($mapObjects.getElementsByClassName('edge-id')))
	erasingElements.forEach($erasingEl => {
		$erasingEl.remove()
	})

	activateButton('tracing')
	deactivateButton('erase')
	deactivateButton('create-list-of-vertexes')
})

document.querySelector('.tracing').addEventListener('click', () => {
	graph.tracing($tableOfEdge)
	deactivateButton('tracing')
	activateButton('erase')
	activateButton('create-list-of-vertexes')
})

document.querySelector('.create-list-of-vertexes').addEventListener('click', () => {
	graph.createVertexesList()
	deactivateButton('create-list-of-vertexes')
	deactivateButton('create-list-of-vertexes')
	activateButton('fill-graph')
})

document.querySelector('.fill-graph').addEventListener('click', () => {
	graph.fillGraph()
	deactivateButton('fill-graph')
	activateButton('show-graph')
	activateButton('fill-auditoriums-vertexes')
})

document.querySelector('.fill-auditoriums-vertexes').addEventListener('click', () => {
	graph.fillAuditoriumsVertexes(planHandler.AuditoriumsIdEntrancesId, planHandler.$svgPlan)
	deactivateButton('fill-auditoriums-vertexes')
	activateButton('build-way')
})

document.querySelector('.show-graph').addEventListener('click', () => {
	graph.showGraph(document.querySelector('.graph-markers'), planHandler.$svgPlan)
	graph.$graphObject.style.visibility = 'visible'
	deactivateButton('show-graph')
	activateButton('get-way')
})

document.querySelector('.get-way').addEventListener('click', () => {
	let idVertex1 = document.getElementById('input-idPoint1').value
	let idVertex2 = document.getElementById('input-idPoint2').value
	let wayAndDistance = graph.getShortestWayFromTo(idVertex1, idVertex2)
	let outputContent = ''
	wayAndDistance.way.forEach(vertexId => {
		outputContent += `в†’ ${vertexId} `
	})
	outputContent = outputContent.substring(2)
	outputContent += `<br>Р”Р»РёРЅР°: ${wayAndDistance.distance}`
	document.getElementsByClassName('output-found-way')[0].innerHTML = outputContent
})

document.querySelector('.build-way').addEventListener('click', () => {
	let idVertex1 = planHandler.fromId
	let idVertex2 = planHandler.toId
	let wayAndDistance = graph.getShortestWayFromTo(idVertex1, idVertex2)
	let outputContent = ''
	wayAndDistance.way.forEach(vertexId => {
		outputContent += `в†’ ${vertexId} `
	})
	outputContent = outputContent.substring(2)
	outputContent += `<br>Р”Р»РёРЅР°: ${wayAndDistance.distance}`
	document.getElementsByClassName('output-way-between-au')[0].innerHTML = outputContent
	way.build(graph, wayAndDistance)
})

document.querySelector('.build-way').addEventListener('click', event => {
	event.preventDefault()
	event.stopImmediatePropagation()
	buildRouteBetweenSelectedAuditoriums()
}, true)

document.querySelector('.hide-graph').addEventListener('click', () => {
	graph.$graphObject.style.visibility = 'hidden'
})

document.querySelector('.tracing-cross').addEventListener('click', () => {
	graph.tracingCross()
})

window.Names = Names
window.Settings = Settings
window.settings = Settings
window.planHandler = planHandler
window.graph = graph
