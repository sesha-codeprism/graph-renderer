# Graph Render application for Neo4J data using D3 visualiser

## Setup and Running the application

### Setup
  In the root of the project running ``npm install`` will install the required dependencies
### Running the application
  Root of the application ``npm start``will host the application at "localhost:3000"
### Configuring the response data
  In `src/data/response.ts` updating the variable `medicineResponse` or in src/App.tsx changing the line `extractData(medicineResponse)` will update the graph with latest graph data.
### Connection to Neo4j DB
  Application is configured to connect to Neo4j response. Altering the connection url in `src/App.tsx` will make the app connect to Neo4jDB directly and execute queries over there

