import { flatten, map, take } from "lodash-es"
import { BasicNodesAndRels, upperFirst } from "../common"
//@ts-ignore
import neo4j from 'neo4j-driver'
import { Duration } from 'luxon'


const getDriverTypeName = (val: any) => {
    const driverTypeMap = neo4j.types as any
    const driverTypes = Object.keys(neo4j.types)
    for (const type of driverTypes) {
        if (val instanceof driverTypeMap[type]) {
            return type
        }
    }
    return undefined
}
export function extractFromNeoObjects(obj: any, converters: any) {
    if (
        obj instanceof (neo4j.types.Node as any) ||
        obj instanceof (neo4j.types.Relationship as any)
    ) {
        return obj.properties
    } else if (obj instanceof (neo4j.types.Path as any)) {
        return [].concat.apply<any[], any[], any[]>(
            [],
            extractPathForRows(obj, converters)
        )
    }
    return obj
}

const extractPathForRows = (path: any, converters: any) => {
    let segments = path.segments
    // Zero length path. No relationship, end === start
    if (!Array.isArray(path.segments) || path.segments.length < 1) {
        segments = [{ ...path, end: null } as any]
    }
    return segments.map((segment: any) =>
        [
            objIntToString(segment.start, converters),
            objIntToString(segment.relationship, converters),
            objIntToString(segment.end, converters)
        ].filter(part => part !== null)
    )
}

const getTypeDisplayName = (val: any): string => {
    const jsType = typeof val
    const complexType = jsType === 'object'

    if (jsType === 'number') {
        return 'Float'
    }

    if (!complexType) {
        return upperFirst(jsType)
    }

    if (val instanceof Array) {
        return `Array(${val.length})`
    }

    if (val === null) {
        return 'null'
    }

    return getDriverTypeName(val) || 'Unknown'
}

export function extractRawNodesAndRelationShipsFromRecords(
    records: Record<string, any>[],
    types = neo4j.types,
    maxFieldItems: any
) {
    const items = new Set<any>()
    const paths = new Set<any>()
    const segments = new Set<any>()
    const rawNodes = new Set<any>()
    const rawRels = new Set<any>()

    for (const record of records) {
        for (const key of record.keys) {
            items.add(record.get(key))
        }
    }
    const flatTruncatedItems = flatten(
        map([...items], item =>
            maxFieldItems && Array.isArray(item) ? take(item, maxFieldItems) : item
        )
    )

    const findAllEntities = (item: any) => {
        if (item instanceof (types.Relationship as any)) {
            rawRels.add(item)
            return
        }
        if (item instanceof (types.Node as any)) {
            rawNodes.add(item)
            return
        }
        if (item instanceof (types.Path as any)) {
            paths.add(item)
            return
        }
        if (Array.isArray(item)) {
            for (const subItem of item) {
                findAllEntities(subItem)
            }
            return
        }
        if (item && typeof item === 'object') {
            for (const subItem of Object.values(item)) {
                findAllEntities(subItem)
            }
            return
        }
    }

    findAllEntities(flatTruncatedItems)

    for (const path of paths) {
        if (path.start) {
            rawNodes.add(path.start)
        }
        if (path.end) {
            rawNodes.add(path.end)
        }
        for (const segment of path.segments) {
            segments.add(segment)
        }
    }

    for (const segment of segments) {
        if (segment.start) {
            rawNodes.add(segment.start)
        }
        if (segment.end) {
            rawNodes.add(segment.end)
        }
        if (segment.relationship) {
            rawRels.add(segment.relationship)
        }
    }

    return { rawNodes: [...rawNodes], rawRels: [...rawRels] }
}
export const csvFormat = (anything: any) => {
    if (typeof anything === 'number') {
        return numberFormat(anything)
    }
    if (neo4j.isInt(anything)) {
        return anything.toString()
    }
    if (anything instanceof neo4j.types.Point) {
        return spacialFormat(anything)
    }
    if (isTemporalType(anything)) {
        return `"${anything.toString()}"`
    }
    if (typeof anything === 'string') {
        return anything
    }
    return undefined
}

export const stringModifier = (anything: any) => {
    if (typeof anything === 'number') {
        return numberFormat(anything)
    }
    if (neo4j.isInt(anything)) {
        return anything.toString()
    }
    if (anything instanceof neo4j.types.Point) {
        return spacialFormat(anything)
    }
    if (isTemporalType(anything)) {
        if (isDuration(anything)) {
            return durationFormat(anything)
        } else {
            return `"${anything.toString()}"`
        }
    }
    return undefined
}

export const durationFormat = (duration: typeof neo4j.types.Duration): string | null =>
    Duration.fromISO(duration.toString())
        .shiftTo('years', 'days', 'months', 'hours', 'minutes', 'seconds')
        .normalize()
        .toISO()

const numberFormat = (anything: any) => {
    // Exclude false positives and return early
    if ([Infinity, -Infinity, NaN].includes(anything)) {
        return `${anything}`
    }
    if (Math.floor(anything) === anything) {
        return `${anything}.0`
    }
    return undefined
}
const spacialFormat = (anything: any): string => {
    const zString = anything.z !== undefined ? `, z:${anything.z}` : ''
    return `point({srid:${anything.srid}, x:${anything.x}, y:${anything.y}${zString}})`
}


export function arrayIntToString(arr: {}[], converters: any) {
    return arr.map(item => itemIntToString(item, converters))
}

export function objIntToString(obj: any, converters: any) {
    const entry = converters.objectConverter(obj, converters)
    let newObj: any = null
    if (Array.isArray(entry)) {
        newObj = entry.map(item => itemIntToString(item, converters))
    } else if (entry !== null && typeof entry === 'object') {
        newObj = {}
        Object.keys(entry).forEach(key => {
            newObj[key] = itemIntToString(entry[key], converters)
        })
    }
    return newObj
}


const isTemporalType = (anything: any) =>
    anything instanceof neo4j.types.Date ||
    anything instanceof neo4j.types.DateTime ||
    anything instanceof neo4j.types.Duration ||
    anything instanceof neo4j.types.LocalDateTime ||
    anything instanceof neo4j.types.LocalTime ||
    anything instanceof neo4j.types.Time

const isDuration = (anything: any) => anything instanceof neo4j.types.Duration

export function itemIntToString(item: any, converters: any): any {
    const res = stringModifier(item)
    if (res) return res
    if (converters.intChecker(item)) return converters.intConverter(item)
    if (Array.isArray(item)) return arrayIntToString(item, converters)
    if (['number', 'string', 'boolean'].indexOf(typeof item) !== -1) return item
    if (item === null) return item
    if (typeof item === 'object') return objIntToString(item, converters)
}

export function extractNodesAndRelationshipsFromRecordsForOldVis(
    records: Record<string, any>[],
    types: any,
    filterRels: any,
    converters: any,
    maxFieldItems?: any
): BasicNodesAndRels {
    if (records.length === 0) {
        return { nodes: [], relationships: [] }
    }
    const { rawNodes, rawRels } = extractRawNodesAndRelationShipsFromRecords(
        records,
        types,
        maxFieldItems
    )

    const nodes = rawNodes.map(item => {
        return {
            id: item.identity.toString(),
            elementId: item.elementId,
            labels: item.labels,
            properties: itemIntToString(item.properties, converters),
            propertyTypes: Object.entries(item.properties).reduce(
                (acc, [key, val]) => ({ ...acc, [key]: getTypeDisplayName(val) }),
                {}
            )
        }
    })
    let relationships = rawRels
    if (filterRels) {
        relationships = rawRels.filter(item => {
            const start = item.start.toString()
            const end = item.end.toString()
            return (
                nodes.some(node => node.id === start) &&
                nodes.some(node => node.id === end)
            )
        })
    }
    relationships = relationships.map(item => {
        return {
            id: item.identity.toString(),
            elementId: item.elementId,
            startNodeId: item.start.toString(),
            endNodeId: item.end.toString(),
            type: item.type,
            properties: itemIntToString(item.properties, converters),
            propertyTypes: Object.entries(item.properties).reduce(
                (acc, [key, val]) => ({ ...acc, [key]: getTypeDisplayName(val) }),
                {}
            )
        }
    })
    return { nodes, relationships }
}
