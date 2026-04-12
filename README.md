<p align="center">
  <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" width="120" alt="Pikachu" />
</p>

# <p align="center">PokéDex-DB 🔴⚪</p>

<p align="center">
  <i>The ultimate digital world encyclopedia for all Pokémon species, evolutions, and tactical analysis.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.x-blue?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PokeAPI-REST-red?style=for-the-badge&logo=pokemon" alt="PokeAPI" />
  <img src="https://img.shields.io/badge/Status-Perfect-green?style=for-the-badge" alt="Status" />
</p>

---

## 📸 Overview

A modern, high-performance PokéDex built with **Next.js**, featuring a nostalgic design inspired by the classic handhelds we grew up with. It's not just a database; it's a trainer's essential companion.

> [!IMPORTANT]
> **PokéDex-DB** leverages the Power of the **PokeAPI** to provide real-time data for over **1025+ Pokémon** across all generations.

---

## ✨ Key Features

| Category | Description | Emoji |
| :--- | :--- | :---: |
| **Comprehensive DB** | Data from Gen 1 to 9, including Abilities & Hidden Abilities. | 🟢 |
| **Evolution Chains** | Detailed requirements for every evolution branch. | ⚪ |
| **Type Matchups** | Instant calculations for offensive/defensive strategy. | 🔵 |
| **Squad Builder** | Build teams, calculate Lvl 100 stats, and analyze competitive viability. | 🟡 |
| **Smart Search** | Fuzzy search by name, ID, or elemental type. | 🟠 |
| **Premium UI** | Glassmorphic, responsive, and buttery-smooth design. | 🔴 |

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router & RSC)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: React Hooks (useState, useEffect, useMemo)
- **API**: [PokeAPI](https://pokeapi.co/)
- **Components**: [Radix UI](https://www.radix-ui.com/) & [Lucide Icons](https://lucide.dev/)

---

## 🚀 Quick Start

### 1. Prerequisite
Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/adityajha-coder/PokeDex-DB.git

# Navigate into the project
cd PokeDex-DB

# Install dependencies
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local` to configure your environment.
```bash
cp .env.example .env.local
```

### 4. Run Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to start your adventure!

---

## 📁 Project Structure

```text
.
├── 📂 app            # Next.js App Router (Pages & Layouts)
├── 📂 components     # Reusable UI components
│   ├── 📂 pokemon    # Pokemon-specific logic
│   └── 📂 ui         # Shadcn/Radix UI primitives
├── 📂 hooks          # Custom React hooks
├── 📂 lib            # Shared utilities & API functions
├── 📂 public         # Static assets (icons, manifest)
└── 📂 styles         # Global CSS & Tailwind configuration
```

---

## 📖 License

This project is open-source and available under the **MIT License**.

---

<p align="center">
  <i>"To catch them is my real test, to train them is my cause!"</i> 🧢⚡️
</p>

<p align="center">
  <b>Built for Trainers everywhere.</b>
</p>
