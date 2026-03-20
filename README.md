# 🎧 Speakr Backend (MVP)

## 📌 Overview

Speakr is an audio-first social platform where users can upload, record, and discover short audio content across multiple languages. This backend powers authentication, audio management, feed generation, and user interactions.

This is an MVP-focused backend built for:

* Fast development 🚀
* Clean architecture 🧠
* Future scalability 📈

---

## ⚙️ Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MongoDB (Atlas)
* **Authentication:** JWT
* **File Upload:** Cloudinary (Phase 1), AWS S3 (Phase 2)
* **Deployment:** Render
* **Frontend (separate):** Next.js + Vercel

---

## 🚀 Features (MVP)

### 🔐 Authentication

* User Signup & Login
* JWT-based authentication
* Secure password hashing

---

### 👤 User Management

* Profile creation & update
* View user details
* User-specific audio listing
* Basic user stats

---

### 🎧 Audio System

* Upload audio files
* Record audio (frontend handled)
* Edit audio metadata (title, language, category)
* Delete audio
* Kids Zone tagging

---

### 📡 Feed System

* Global feed with pagination
* Filter by language & category
* Trending / Latest sorting
* Search functionality

---

### ❤️ Interactions

* Like / Unlike audio
* Listen count tracking
* Check like status

---

### 🚩 Reporting

* Report inappropriate content
* View user reports

---

### 🌐 Categories & Languages

* Predefined categories
* Multi-language tagging

---

### ⚙️ Admin Ready (Basic Structure)

* User management (ban/unban)
* Audio moderation
* Report handling

---


## 📦 Installation

```bash
git clone <repo-url>
cd speakr-backend
npm install
```

---

## ▶️ Running the Server

```bash
npm run dev
```

Server will start on:

```
http://localhost:5000
```

---

## 🔌 API Base URL

```
/api/v1
```


## 🔊 Audio Handling

* Phase 1: Cloudinary
* Phase 2: AWS S3 integration
* Only metadata stored in database

---

## 📊 Scalability Considerations

* Indexed MongoDB queries
* Pagination for all list APIs
* Separation of concerns (MVC structure)
* Ready for horizontal scaling

---

## ⚠️ Important Notes

* This is an MVP build focused on core functionality
* Advanced features like AI moderation, recommendations, and audio editing are planned for future phases
* Performance optimizations will be enhanced as user base grows

---

## 🛠️ Future Enhancements

* AI-based content moderation
* AI-generated thumbnails
* Subscription & verified users
* Advanced analytics
* Real-time features (WebSockets)

---

## 🤝 Contribution

This project is currently under active development. Contributions and suggestions are welcome.

---

## 📄 License

This project is private and proprietary unless stated otherwise.

---

## 👨‍💻 Author

Developed for the Speakr platform MVP.
