import { MultiDirectedGraph } from "graphology";
import { BasicNode, BasicRelationship } from "../common";

onmessage = async (event: MessageEvent) => {
    const graph = new MultiDirectedGraph();
    const addedNodes = new Set(); // Set to track added nodes
    const labelColorMap = new Map(); // Map to store colors based on labels
    const { type, payload, labelKeys } = event.data;
    const nodes: BasicNode[] = [];
    const relations: BasicRelationship[] = []

    if (type === "serializeGraph") {
        for await (const item of payload) {
            const fields = item._fields;
            const segments = fields[0].segments;
            const startNode = segments[0].start;
            const endNode = segments[0].end;
            const relationship = segments[0].relationship;

            // IDs
            const startNodeId = startNode?.elementId;
            const endNodeId = endNode?.elementId;
            const relationshipId = relationship?.elementId;


            // Check if the start node already exists
            if (!addedNodes.has(startNodeId)) {
                const startX = getRandomWithVariation();
                const startY = getRandomWithVariation();
                const nodeLabel = startNode?.labels[0];
                const color = getOrCreateColorForLabel(nodeLabel, labelColorMap);
                const properties = startNode?.properties
                const label = getLabelFromProperties(properties, labelKeys) || nodeLabel;

                graph.addNode(startNodeId, {
                    x: startX,
                    y: startY,
                    label,
                    properties,
                    size: 15,
                    color,
                });

                addedNodes.add(startNodeId); // Add the node ID to the set
            }

            // Check if the end node already exists
            if (!addedNodes.has(endNodeId)) {
                const endX = getRandomWithVariation();
                const endY = getRandomWithVariation();
                const nodeLabel = endNode?.labels[0];
                const color = getOrCreateColorForLabel(nodeLabel, labelColorMap);
                const properties = endNode?.properties
                const label = getLabelFromProperties(properties, labelKeys) || nodeLabel;

                graph.addNode(endNodeId, {
                    x: endX,
                    y: endY,
                    label,
                    properties,
                    size: 15,
                    color,
                });

                addedNodes.add(endNodeId); // Add the node ID to the set
            }

            // Add edge
            graph.addEdgeWithKey(relationshipId, startNodeId, endNodeId, {
                label: relationship?.type,
                properties: relationship?.properties,
            });
        }

        const exportedGraph = graph.export();
        postMessage({ type: "serializeGraphCompleted", exportedGraph });
    }
};

function getRandomWithVariation() {
    const baseValue = Math.random(); // Random value between 0 and 1
    const variation = (Math.random() - 0.5) * 0.1; // Small random variation between -0.05 and 0.05
    return baseValue + variation;
}

function getRandomColor() {
    return `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(
        Math.random() * 256
    )})`;
}

function getOrCreateColorForLabel(label: any, labelColorMap: Map<any, any>) {
    if (labelColorMap.has(label)) {
        return labelColorMap.get(label);
    }

    const color = getRandomColor();
    labelColorMap.set(label, color);
    return color;
}
function getLabelFromProperties(properties: { [x: string]: any; hasOwnProperty: (arg0: any) => any; }, labelKeys: any) {
    for (const key of labelKeys) {
        if (properties.hasOwnProperty(key)) {
            return properties[key]
        } else {
            continue
        }
    }
}

export { };