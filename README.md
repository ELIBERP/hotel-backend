# 🏨 StayEase - Hotel Booking Platform  

![Node.js](https://img.shields.io/badge/Node.js-18+-green)  
![React](https://img.shields.io/badge/React-19.x-blue)  
![Express](https://img.shields.io/badge/Express-5.x-lightgrey)  
![MySQL](https://img.shields.io/badge/MySQL-8.x-orange)  
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC)  
![License](https://img.shields.io/badge/License-MIT-yellow)  

A modern **hotel booking platform** featuring a **React + Vite + Tailwind** frontend and a **Node.js + Express + MySQL** backend.  

The system provides hotel search with autocomplete, booking management, authentication, and payment integration — all in a responsive, Docker-ready setup.  

---

## ✨ Features  

### Frontend  
- 🔍 **Advanced Search** with autocomplete & fuzzy matching  
- 📅 **Date & Guest Selection** with validation  
- 🏨 **Hotel Listings** with filters & sorting  
- 🛏️ **Detailed Views** with room & pricing info  
- 💳 **Mock Payment Integration** (ready for live gateway)  
- 📱 **Responsive Design** (mobile-first, Tailwind CSS)  

### Backend  
- 🏨 **Hotel & Destination APIs** (search, details, pricing)  
- 📑 **Booking APIs** with Stripe payment sessions  
- 🔐 **JWT Authentication** for users  
- ⚡ **Caching & Static Data Mode** for development  
- 🐳 **Dockerized** for deployment  
- 🧪 **Unit & Integration Tests**  

---

## 🏗️ System Architecture  

```text
               ┌─────────────────────┐
               │     Frontend        │
               │  React + Vite +     │
               │  Tailwind CSS       │
               └─────────┬───────────┘
                         │ REST API calls (Axios/Fetch)
                         ▼
               ┌─────────────────────┐
               │     Backend         │
               │ Node.js + Express   │
               │ Authentication, API │
               │ Booking, Payments   │
               └─────────┬───────────┘
                         │
         ┌───────────────┼────────────────┐
         ▼                               ▼
┌─────────────────────┐        ┌─────────────────────┐
│    MySQL Database   │        │   Stripe API        │
│ Hotel, Users,       │        │ Secure Payments     │
│ Bookings persistence│        │ Webhooks            │
└─────────────────────┘        └─────────────────────┘
```

- **Frontend**: Handles UI, search, booking flow, and maps integration.  
- **Backend**: Provides REST API, authentication, caching, and DB queries.  
- **Database**: MySQL stores hotels, users, bookings.  
- **Third-party services**: Stripe for payments, Google Maps API for maps.  

---

## 🚀 Getting Started  

### Prerequisites  
- **Node.js**: v18+ for backend, v20+ recommended for frontend  
- **MySQL**: v8.x  
- **npm**: v10+  

### Installation  

1. **Clone both repos**  
   ```bash
   git clone https://github.com/ELIBERP/hotel-backend.git
   git clone https://github.com/ELIBERP/hotel-client.git
   ```

2. **Backend Setup**  
   ```bash
   cd hotel-backend
   npm install
   cp .env.example .env   # configure database, JWT, Stripe
   npm run db:init        # initialize database
   npm run dev            # start backend server
   # runs at http://localhost:3000
   ```

3. **Frontend Setup**  
   ```bash
   cd ../hotel-client
   npm install
   cp .env.example .env   # configure API base URL & Google Maps keys
   npm run dev            # start frontend dev server
   # runs at http://localhost:5173
   ```

---

## 🐳 Docker Deployment  

Both services include Docker support. Example:  

```bash
# Backend
cd hotel-backend
docker build -t hotel-backend .
docker run -p 3000:3000 hotel-backend

# Frontend
cd ../hotel-client
docker build -t hotel-client .
docker run -p 8080:80 hotel-client
```

---

## 🧪 Testing  

- **Backend**  
  ```bash
  npm run test:unit
  npm run test:integration
  npm test
  ```

- **Frontend**  
  ```bash
  npm test
  npm run test:watch
  npm run test:coverage
  ```

---

## 📁 Project Structure  

### Backend (`hotel-backend/`)  
```
├── config/        # env, DB, Stripe config
├── controller/    # route handlers
├── middleware/    # auth, caching
├── model/         # data models (MySQL or static JSON)
├── static/        # static hotel data
├── tests/         # unit & integration tests
└── index.js       # entry point
```

### Frontend (`hotel-client/`)  
```
├── assets/        # static files
├── components/    # reusable UI
├── pages/         # route views
├── services/      # API communication
├── config/        # env handling
└── main.jsx       # entry point
```

---

## 🔐 Environment Variables  

### Backend `.env`  
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
HOTELAPI=https://hotelapi.loyalty.dev
REACT_DB_HOST=localhost
REACT_DB_USERNAME=root
REACT_DB_PW=your_password
REACT_DB_NAME=hotel_booking
REACT_JWT_KEY=your_jwt_secret_key_here
REACT_JWT_EXPIRY=24h
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
```

### Frontend `.env`  
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_TIMEOUT=10000
VITE_APP_NAME=StayEase
VITE_APP_VERSION=1.0.0
VITE_GOOGLEMAP_API_KEY=your_google_maps_api_key
VITE_GOOGLEMAP_MAP_ID=your_google_map_id
VITE_DEBUG_MODE=true
```

---

## 🤝 Contributing  

1. Fork the repo(s)  
2. Create a feature branch: `git checkout -b feature/amazing-feature`  
3. Commit changes: `git commit -m 'Add amazing feature'`  
4. Push branch: `git push origin feature/amazing-feature`  
5. Open a Pull Request  

---

## 📜 License  

This project is licensed under the **MIT License**.  

---

## 👥 Team C3T6  

- Elizabeth  
- Darren  
- Nicholas  
- Sharon  
- Qin Xin  
- Jing Yu  
- Dha  
- Ky  

---

## 🙏 Acknowledgments  

- [Express.js](https://expressjs.com/)  
- [MySQL](https://www.mysql.com/)  
- [JWT](https://jwt.io/)  
- [Stripe](https://stripe.com/)  
- [React](https://react.dev/)  
- [Tailwind CSS](https://tailwindcss.com/)  
- [Vite](https://vitejs.dev/)  

---
