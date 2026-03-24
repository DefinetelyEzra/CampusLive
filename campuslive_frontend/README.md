# CampusLive Frontend

CampusLive is a real-time, location-aware campus engagement platform designed to bridge the gap between students, event organizers, and administration.

Built with **React 19** and **Vite**, the application provides a dynamic mapping interface that tracks live events and user activity within specific campus boundaries.

---

## Key Features

### Interactive Campus Map
- Real-time event visualization using Leaflet  
- Custom markers  
- Live user geolocation tracking  
- Campus boundary enforcement (PAU Center)

### Real-Time Updates
- Event status synchronization  
- Live attendance tracking  
- Instant post updates via Socket.io  

### Role-Based Dashboards
- **Students:** Discover live events, track attendance, view location-specific media  
- **Moderators:** Verify event access and manage interactions  
- **Administrators:** Manage users, locations, and system statistics  

### Robust Media Handling
- File upload support  
- Strict size limits  
- Validation enforcement  

### High Performance
- Axios with exponential backoff retries  
- Stable socket connection management  

### Modern Aesthetics
- Responsive UI  
- Built with Tailwind CSS and Framer Motion  
- Glassmorphism design elements  

---

## 🛠 Tech Stack

| Category        | Technology            |
|----------------|----------------------|
| Framework      | React 19             |
| Build Tool     | Vite                 |
| Language       | TypeScript           |
| State          | Zustand              |
| Routing        | React Router 7       |
| Mapping        | React Leaflet        |
| Styling        | Tailwind CSS, Lucide React |
| Real-time      | Socket.io Client     |

---

## Project Structure

```
src/
├── components/     # Feature-specific UI (Admin, Events, Map, User)
├── hooks/          # Custom hooks (Notifications, UI logic)
├── services/       # API (Axios) and Socket.io service abstractions
├── stores/         # Zustand global state management
├── types/          # Centralized TypeScript interfaces
└── utils/          # Registration and validation utilities
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn  

### 1. Installation
```bash
git clone <your-repo-url>
cd CAMPUSLIVE_FRONTEND
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:3001/api/v1
VITE_SOCKET_URL=http://localhost:3001
VITE_MAX_FILE_SIZE=52428800 # 50MB
VITE_ENABLE_BACKGROUND_TRACKING=true
VITE_BATTERY_OPTIMIZATION=true
```

### 3. Development
```bash
npm run dev
```

---

## 🛠 Available Scripts

- `npm run dev` — Start the development server  
- `npm run build` — Build for production (includes type checking)  
- `npm run lint` — Run ESLint  
- `npm run preview` — Preview production build  

---

## 🔒 Security & Architecture

- **Error Boundaries**  
  Prevents app-wide crashes by catching component-level errors  

- **JWT Authentication**  
  Token injection and 401 handling via Axios interceptors  

- **Location Safety**  
  Campus boundary checks for relevance and privacy  

---

## 🌐 Deployment

CampusLive frontend is a static site and can be hosted on:
- Vercel  
- Netlify  
- AWS S3 / CloudFront  

### Production Build

```bash
npm run build
```

This generates a `dist/` folder.

### Deployment Configuration

- **Build Command:** `npm run build`  
- **Output Directory:** `dist`  
- **Install Command:** `npm install`  

### Environment Handling

Most hosting providers require manual setup of environment variables in their dashboard.

**Important:**  
All variables must be prefixed with `VITE_` to be accessible in the frontend.

---

## ⚠️ Troubleshooting Deployment

### Routing (SPA)
Ensure all 404s redirect to `index.html` so React Router can handle routes.

### Mixed Content
Use `https` in `VITE_API_URL` if your frontend is served over HTTPS.

---

## Contribution Guidelines

We welcome contributions to CampusLive.

### 1. Style Guide
- Use strict TypeScript typing (avoid `any`)  
- Prefer functional components with hooks  
- Use `React.FC` for consistency  
- Style with Tailwind CSS  
- Use `@apply` in `index.css` for shared styles  
- Zustand for global state  
- `useState` for local state  

### 2. Branching Strategy
- `main` → Production  
- `develop` → Integration  
- `feature/feature-name` → New features  
- `bugfix/issue-name` → Bug fixes  

### 3. Submission Process
1. Fork the repository  
2. Create a branch from `develop`  
3. Run `npm run lint`  
4. Commit with clear messages  
   - Example: `feat: add real-time attendance tracking`  
5. Push and open a Pull Request to `develop`  
6. Include description and issue references  

---

## License

This project is licensed under the MIT License.

---

## 🛡️ Maintainers

- Agunbiade Odunayo / Org — Initial Work
