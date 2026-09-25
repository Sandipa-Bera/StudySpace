# 📚 StudySpace

> A simple and cozy study management app for organizing learning, notes, files, and revision.

🌐 **Live Demo:** https://study-space-organizer.vercel.app/

## ✨ Overview

**StudySpace** helps students manage their academic work in one place. It organizes study material into subjects, chapters, and topics while allowing users to track completion, understanding, revision, and notes.

### 📖 Core Structure

```text
User
└── Subject
    └── Chapter
        ├── 📎 Chapter Files
        ├── Topic
        │   └── 📝 Topic Notes
        ├── Topic
        │   └── 📝 Topic Notes
        └── Topic
```

## 🚀 Features

* 📚 Create and manage **Subjects**
* 📖 Organize content into **Chapters**
* 🧩 Create and track **Topics**
* 📝 Add notes to topics
* 📎 Upload files directly to chapters
* ⭐ Mark important topics as favorites
* 🔄 Track completion, understanding, and revision
* 📅 Set revision/target dates
* 🔎 Search study content
* 📔 Maintain a study journal
* ⏱️ Track study sessions
* 📊 View study activity and progress
* 🎨 Customize the application theme

## 🛠️ Tech Stack

* **Frontend:** Web application
* **Backend & Database:** Supabase / PostgreSQL
* **Authentication:** Supabase Auth
* **Storage:** Supabase Storage
* **Development:** AI-assisted development with Anti-Gravity

## 🗄️ Database

Main tables include:

```text
profiles
subjects
chapters
topics
topic_notes
chapter_attachments
journal_entries
study_sessions
activity_log
```

The application uses **Row Level Security (RLS)** to ensure users can access only their own study data.

## 📦 File Storage

Files are stored in the Supabase `attachments` bucket.

Chapter files are associated directly with chapters and **do not require a topic**.

## 🎨 Design

StudySpace follows a:

* Warm 🤎
* Minimal
* Cozy 🌸
* Distraction-free

visual style using colors such as cream, beige, brown, and dusty pink.

The design avoids excessive gradients, glassmorphism, neon colors, and unnecessary visual clutter.

## 🚧 Status

StudySpace is currently under development.

### Completed

* ✅ Supabase setup
* ✅ Subjects
* ✅ Chapters
* ✅ Core database relationships
* ✅ Basic RLS

### In Progress

* 🔄 Topics
* 🔄 Chapter file uploads
* 🔄 Topic notes
* 🔄 Search & favorites
* 🔄 Study tracking
* 🔄 UI refinement

## 🗺️ Future Plans

* 📊 Advanced study analytics
* 📅 Revision planning
* ⏱️ Detailed study statistics
* 🎨 More customization
* 📱 Improved responsive experience

## ❤️ Goal

StudySpace aims to become a **personal digital study desk** where students can organize what they need to learn, track their progress, keep their resources together, and build better study habits.

> **Organize. Learn. Revise. Grow. 📚✨**

---

🌐 **Try StudySpace:** https://study-space-organizer.vercel.app/
