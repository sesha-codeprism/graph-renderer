import React, { useMemo } from "react";
import "./App.css";
import { GraphVisualizer } from "./graph-visualization";
import {
  extractFromNeoObjects,
  extractNodesAndRelationshipsFromRecordsForOldVis,
} from "./utils/mapper";
//@ts-ignore
import neo4j from "neo4j-driver";
import { medicineResponse, movieResponse } from "./data/response";
import { BasicNode, BasicRelationship } from "./common";

const labelKeys = ["name", "title", "country"];

class Node {
  constructor(
    public id: number,
    public labels: string[],
    public properties: Record<string, any>
  ) {}
}

interface ResponseObject {
  keys: string[];
  length: number;
  _fields: Field[];
  _fieldLookup: FieldLookup;
}

interface FieldLookup {
  q: number;
}

interface Field {
  start: Start;
  end: End;
  segments: Segment[];
  length: number;
}

interface Segment {
  start: Start;
  relationship: Relationship;
  end: End;
}

interface Relationship {
  identity: Identity;
  start: Identity;
  end: Identity;
  type: string;
  properties: Record<string, any>;
  elementId: string;
  startNodeElementId: string;
  endNodeElementId: string;
}

interface Properties3 {}

interface End {
  identity: Identity;
  labels: string[];
  properties: Record<string, any>;
  elementId: string;
}

interface Start {
  identity: Identity;
  labels: string[];
  properties: Record<string, any>;
  elementId: string;
}

interface Identity {
  low: number;
  high: number;
}

function extractData(records: ResponseObject[]): {
  nodes: BasicNode[];
  relationships: BasicRelationship[];
} {
  const nodes: BasicNode[] = [];
  const relationships: BasicRelationship[] = [];

  records.forEach((e) => {
    e._fields.forEach((fields) => {
      fields.segments.forEach((segments) => {
        nodes.push({
          elementId: segments.start.elementId,
          id: segments.start.identity.low.toString(),
          labels: segments.start.labels,
          properties: segments.start.properties,
          propertyTypes: {},
        });
        relationships.push({
          elementId: segments.relationship.elementId,
          endNodeId: segments.relationship.endNodeElementId,
          startNodeId: segments.relationship.startNodeElementId,
          id: segments.relationship.identity.low.toString(),
          type: segments.relationship.type,
          properties: segments.relationship.properties,
          propertyTypes: {},
        });
        nodes.push({
          elementId: segments.end.elementId,
          id: segments.end.identity.low.toString(),
          labels: segments.end.labels,
          properties: segments.end.properties,
          propertyTypes: {},
        });
      });
    });
  });

  return { nodes, relationships };
}

function App() {
  //@ts-ignore
  console.log(extractData(medicineResponse));

  const driver = neo4j.driver("bolt://127.0.0.1:7687/neo4j");
  const graphWorker: Worker = useMemo(
    () => new Worker(new URL("../src/utils/worker.ts", import.meta.url)),
    []
  );

  const executeCypher = async () => {
    const query =
      'MATCH (tom:Person {name:"Tom Hanks"})-[:ACTED_IN]->(m)<-[:ACTED_IN]-(coActors),(coActors)-[:ACTED_IN]->(m2)<-[:ACTED_IN]-(cruise:Person {name:"Tom Cruise"}) RETURN tom, m, coActors, m2, cruise';
    const resp = await driver.executeQuery(query);
    const { nodes, relationships } =
      extractNodesAndRelationshipsFromRecordsForOldVis(
        resp.records,
        neo4j.types,
        false,
        {
          intChecker,
          intConverter,
          objectConverter: extractFromNeoObjects,
        }
      );
    console.log(nodes, relationships);
    console.log(resp);
    const payload = medicineResponse;
    graphWorker.postMessage({
      type: "serializeGraph",
      payload,
      labelKeys,
    });
    graphWorker.onmessage = (event: any) => {
      if (event.data.type === "serializeGraphCompleted") {
        console.log(event.data.exportedGraph);
      }
    };
  };

  // executeCypher();

  const intChecker = neo4j.isInt;
  const intConverter = (val: any): string => val.toString();
  //@ts-ignore
  const { nodes, relationships } = extractData(medicineResponse);
  return (
    <div className="App">
      <GraphVisualizer
        relationships={relationships}
        nodes={nodes}
        autocompleteRelationships={false}
        isFullscreen={false}
        initialZoomToFit={true}
      />
    </div>
  );
}

export default App;
