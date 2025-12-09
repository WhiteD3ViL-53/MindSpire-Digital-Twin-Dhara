DHARA Digital Twin Analyst
DHARA is a secure Digital Twin application developed for urban planning and environmental analysis. The system visualizes real-time air quality data on an interactive 3D map and simulates the environmental impact of various urban interventions, such as timber construction or traffic electrification, on AQI and CO2 emissions.

The application consists of a client-side simulation engine and a secure Node.js backend utilized for encrypted report generation and data archiving.

Key Features
Frontend Simulation Engine
Real-time Data Aggregation: Implements a dual-API system for fetching air quality data, utilizing Open-Meteo as the primary source and OpenWeatherMap as a failover backup.

Intervention Modeling: Allows analysts to simulate strategies (e.g., EV adoption, green cement usage) via adjustable parameters to project future AQI and CO2 levels.

Geospatial Visualization: Features a MapLibre GL JS integration for 3D mapping, supporting drag-and-drop placement of intervention markers to define specific impact zones.

Dynamic Heatmaps: Renders real-time pollution intensity layers based on current sensor data and simulated variables.

Audit Logging: Maintains a local log of API health status, data validation events, and source switching for system reliability.

Backend Services

Secure Reporting: Provides an endpoint to generate Microsoft Word (.docx) reports containing formatted simulation summaries.


Encrypted Archiving: Stores report metadata and encrypted ciphertext (with initialization vectors) in the Firebase Realtime Database for audit trails.


Authentication Middleware: Enforces Firebase ID Token verification on API routes to ensure only authorized personnel can generate reports.

Technical Stack
Runtime: Node.js

Framework: Express.js


Database & Authentication: Firebase Admin SDK, Firebase Client SDK 


Document Processing: docx (JS library) 

Frontend Mapping: MapLibre GL JS

Project Structure
The application is structured to serve static assets from a public directory while maintaining server-side logic in the root.

Plaintext

dhara-backend/
├── node_modules/
├── public/                  # Frontend assets (Create this directory)
│   ├── index.html           # Main entry point
│   └── dhara-twin.js        # Simulation logic
├── server.js                # Backend entry point
├── package.json             # Dependencies
├── service-account.json     # Firebase Admin Credentials (Restricted)
└── .gitignore
Installation and Configuration
Prerequisites
Node.js (v18 or higher recommended).

A Firebase project with Authentication (Email/Password) and Realtime Database enabled.

An OpenWeatherMap API key.

Backend Setup
Install the required dependencies:

Bash

npm install
This will install packages such as express, firebase-admin, and docx.

Service Account Configuration:

Generate a Service Account private key JSON file from the Firebase Console.

Place the file in the project root.

Ensure the filename matches the SERVICE_ACCOUNT_PATH variable in server.js or set the SERVICE_ACCOUNT_PATH environment variable.

Frontend Configuration
Create a public directory in the project root and move index.html and dhara-twin.js into it.

API Keys:

Open public/dhara-twin.js and update the API_CONFIG object with your valid OpenWeatherMap API key.

Open public/index.html and update the firebaseConfig object with your specific Firebase project credentials.

Usage
Starting the Server
Execute the following command to start the application:

Bash

npm start
The server will initialize on port 3000 by default or the port specified in the PORT environment variable.

Accessing the Application
Navigate to http://localhost:3000 in a web browser.

Authenticate using the Firebase Email/Password login overlay.

Upon successful authentication, the Digital Twin dashboard will load.

API Documentation
POST /api/generate-report
Generates a formatted .docx report based on the provided simulation data and archives the encrypted record.


Endpoint: /api/generate-report 


Security: Requires Authorization header with a valid Bearer token (Firebase ID Token).

Request Body (JSON):

JSON

{
  "plainData": {
    "location": { "label": "String" },
    "liveData": { "pm2_5": Number, ... },
    "interventions": [Array]
  },
  "encrypted": "Base64 String",
  "iv": "Base64 String"
}

Response: Binary stream (application/vnd.openxmlformats-officedocument.wordprocessingml.document).

Security Considerations
Credential Management: The service-account.json file contains sensitive private keys. It is listed in .gitignore and must not be committed to version control systems.


Authentication: Backend routes are protected by middleware that strictly verifies the validity of the Firebase ID token before processing requests.
