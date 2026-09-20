# Healio - Personalized Nutrition & Energy Balance Platform

Graduation Thesis Project - Information Technology

## Project Team

Healio is a graduation thesis project jointly developed by **Tùng Uy** and **Hoàng Việt**.

| Member | GitHub Account | Role |
| --- | --- | --- |
| Tùng Uy | `TungUy84` | Project co-developer |
| Hoàng Việt | `HoangViet1411` | Project co-developer |

## Project Overview

Healio is an intelligent nutrition management and energy balancing system designed to assist users in dietary tracking, weight management, and health goal optimization. The system integrates scientifically validated nutritional formulas (Mifflin-St Jeor) with Google Gemini AI models to deliver hyper-personalized meal plans, real-time macronutrient distribution, and automated administrative nutrition management.

The platform consists of a cross-platform mobile application for end-users, an administrative web portal for nutrition data management, a centralized RESTful API backend, and a normalized relational database.

## Tech Stack

### Client Applications
- Mobile Application (End-User): React Native, Expo SDK 54, TypeScript, NativeWind, React Navigation, React Native Reanimated.
- Admin Portal (Management): React.js 19, Vite, TypeScript, Tailwind CSS, Recharts, Lucide React.

### Backend Infrastructure
- Runtime: Node.js (v18+)
- Framework: Express.js (RESTful API architecture)
- Authentication: JSON Web Tokens (JWT), Bcrypt password hashing
- File Processing: Multer, CSV-Parser, XLSX (SheetJS)

### Database Layer
- Database Engine: PostgreSQL
- Object-Relational Mapping (ORM): Sequelize
- Schema Design: Fully normalized schema maintaining strict relations between composite food dishes (Food), raw nutritional ingredients (RawFood), and intermediate junction tables (FoodIngredient).

### Artificial Intelligence
- AI Model: Google Gemini API (gemini-2.5-flash / gemini-1.5-flash / gemini-pro)
- Integration Pattern: Prompt engineering with strict JSON output schemas, automated allergen exclusion, and nutritional recipe decomposition.

## Core Features

### 1. Deterministic Nutrition Algorithms
- Body Mass Index (BMI): Evaluates physical state from height and weight metrics.
- Basal Metabolic Rate (BMR): Computes baseline metabolic energy expenditure using the Mifflin-St Jeor formula:
  - For Men: BMR = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
  - For Women: BMR = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161
- Total Daily Energy Expenditure (TDEE): Multiplies BMR by physical activity coefficients (ranging from 1.2 for sedentary to 1.9 for extreme activity).
- Target Calorie and Macronutrient Allocation: Dynamically calculates daily calorie deficits or surpluses based on weight loss, maintenance, or muscle gain objectives, breaking down target macros into Protein, Carbohydrates, and Fats.

### 2. AI-Powered Personalized Meal Planning
- Dynamic Prompt Engineering: Aggregates user profile data (TDEE targets, dietary preferences, medical conditions) and enforces strict allergen filtering constraints.
- Structured JSON Schema Responses: Forces the Gemini API to output structured JSON mapping meal times (breakfast, lunch, dinner) directly to database entity IDs and portion sizes.
- Real-time Constraint Satisfaction: Validates that selected meal combinations satisfy caloric boundary conditions (within +/- 10% target range) while strictly isolating allergen-containing ingredients.

### 3. AI-Assisted Admin Food Generator
- Automatic Recipe Decomposition: Admins input raw culinary dish names; Gemini AI automatically parses ingredients, calculates raw weights (in grams), estimates micronutrients (standardized in mg), and categorizes meals and diet tags.
- Ingredient Synchronization: Maps decomposed ingredients back to normalized raw food database records, generating composite nutritional values automatically.

### 4. High-Throughput Bulk Data Ingestion
- Multi-format File Ingestion: Custom data processing pipelines supporting CSV and Excel (.xlsx) formats.
- Data Normalization & Validation: Parses raw Vietnamese food composition data, performs field sanitization, maps standard edible portions, and executes batch inserts via Sequelize transactions.

## System Architecture

Healio operates under a decoupled Client-Server architecture:

1. Mobile Client (React Native): Interacts with backend REST endpoints to manage user authentication, synchronize daily meal consumption logs, and fetch AI meal recommendations.
2. Admin Client (React Vite): Provides operational control over food databases, user auditing, and triggered AI recipe generation.
3. Backend Server (Express.js): Serves as the central business logic controller, coordinating authentication middleware, execution of nutrition formulas, direct communication with the Gemini AI service, and database transactions.
4. Database (PostgreSQL): Maintains persistent storage with referential integrity across users, nutritional targets, daily tracking logs, composite meals, and raw ingredient tables.

```
+-------------------+        +--------------------+
|   Mobile Client   |        |    Admin Portal    |
|  (React Native)   |        |   (React + Vite)   |
+---------+---------+        +---------+----------+
          |                            |
          | HTTP / JSON API Calls      | HTTP / JSON API Calls
          v                            v
+-------------------------------------------------+
|               Express.js Backend API            |
|  - JWT Authentication                           |
|  - Mifflin-St Jeor Calculation Engine           |
|  - Gemini AI Integration Service                |
|  - CSV/Excel Parsing Pipeline                   |
+---------+----------------------------+----------+
          |                            |
          | SQL / Sequelize ORM        | REST API / JSON
          v                            v
+-------------------+        +--------------------+
|    PostgreSQL     |        |   Google Gemini    |
|     Database      |        |       API          |
+-------------------+        +--------------------+
```

## Installation & Setup

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm or yarn package manager
- PostgreSQL instance running locally or hosted remotely
- Google Gemini API Key

### 1. Repository Setup
```bash
git clone https://github.com/TungUy84/KLTN-Healio.git
cd KLTN-Healio
```

### 2. Backend Server Configuration & Startup

Navigate to the server directory:
```bash
cd server
npm install
```

Create a `.env` file in the `server` directory with the following variables:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=healio_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_google_gemini_api_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
```

Start the backend server in development mode:
```bash
npm run dev
```

### 3. Admin Portal Configuration & Startup

Navigate to the admin directory:
```bash
cd ../admin
npm install
```

Start the Vite development server:
```bash
npm run dev
```
The admin portal will be accessible at `http://localhost:5173`.

### 4. Mobile Application Startup

Navigate to the mobile directory:
```bash
cd ../mobile
npm install
```

Start the Expo development server:
```bash
npx expo start
```
Use the Expo Go application on a mobile device or launch an iOS/Android simulator to run the client.
