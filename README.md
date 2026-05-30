<p align="center">
  <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" width="120" alt="Pikachu" />
</p>

# <p align="center">PokéDex 🔴⚪</p>

<p align="center">
  <i>Your ultimate digital companion for exploring Pokémon species, analyzing competitive squads, and mastering evolution chains.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PokeAPI-REST-red?style=for-the-badge&logo=pokemon" alt="PokeAPI" />
  <img src="https://img.shields.io/badge/PWA-Ready-purple?style=for-the-badge&logo=pwa" alt="PWA Ready" />
</p>

---

##  What is PokéDex?

Hey fellow Trainers! 👋 Welcome to PokéDex. I built this project because I wanted a smooth, modern, and genuinely useful PokéDex that goes beyond just listing basic stats. 

Built with **Next.js 16** and **React 19**, it's designed to feel less like a static wikia and more like a high-tech tool you'd actually carry on your journey. Whether you're casually looking up evolution requirements, studying type matchups, or deep-diving into competitive team building with the built-in Squad Analyzer, everything is delivered through a crisp, glassmorphic UI that runs lightning fast.

> [!IMPORTANT]  
> Data is powered by the incredible **PokeAPI**, bringing you real-time, accurate info for over **1025+ Pokémon** across all 9 generations.

---

##  Features That Pack a Punch

Here's what you can do with PokéDex:

| Feature | What it does |
| :--- | :--- |
| 📚 **Complete Encyclopedia** | Everything from Bulbasaur to Pecharunt. All stats, base experience, height/weight, and abilities. |
| 🧬 **Evolution Tracking** | No more guessing how to evolve an Eevee. Get clear visual pathways and exact requirements (levels, items, friendship, day/night) for every single evolution branch. |
| ⚔️ **Squad Analyzer** | The real game-changer. Build your dream team of 6, calculate their actual Level 100 stats, and get instant competitive feedback and synergy scoring. |
| 🎯 **Type Matchup Calculator** | Instantly analyze offensive and defensive advantages so you never bring a Grass type to a Fire fight. |
| 📱 **PWA Functionality** | Install PokéDex right to your phone's home screen. It feels just like a native app! |
| 🎨 **Premium UI/UX** | A crafted, clean, non-glowing yellow themed aesthetic with a compact glassmorphic dashboard that simply feels *good* to use. |

---

##  The Tech Under the Hood

I've used a modern stack to make sure this application is as fast and robust as possible:

- **Framework**: [Next.js 16](https://nextjs.org/) (Making full use of the App Router & Server Components)
- **Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) for that snappy, utility-first design.
- **UI Components**: [Radix UI](https://www.radix-ui.com/) primitives wrapped in custom glassmorphic styling, plus [Lucide React](https://lucide.dev/) for crisp icons.
- **Data Source**: The community-driven [PokeAPI](https://pokeapi.co/).

---

##  Getting Started

Want to run PokéDex locally? It's super easy.

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### 2. Setup
Clone the repository and install the dependencies:
```bash
git clone https://github.com/adityajha-coder/PokeDex-DB.git
cd PokeDex
npm install
```

### 3. Environment Variables
You'll need to set up a env file.

### 4. Fire it up!
Start the development server:
```bash
npm run dev
```
Then, open [http://localhost:3000](http://localhost:3000) in your browser, and you're good to go!

---

##  Project Structure 

For the curious developers diving into the codebase:

```text
.
├── 📂 app            # Next.js App Router (Pages, Layouts, & API Routes)
├── 📂 components     # Where the magic happens (Reusable UI)
│   ├── 📂 pokemon    # Domain-specific components (Squad Builder, Details, Cards)
│   └── 📂 ui         # Radix UI / Shadcn base components
├── 📂 hooks          # Custom React hooks for state and data fetching
├── 📂 lib            # Shared utilities (like type matchup logic & helpers)
├── 📂 public         # Static assets (including the PWA manifest)
└── 📂 styles         # Global CSS and Tailwind directives
```

---

## 🤝 Contributing & License

Feel free to fork this project, submit PRs, or open issues if you find any bugs or have feature requests. I'm always open to making this tool better!


---

<p align="center">
  <i>"To catch them is my real test, to train them is my cause!"</i> 🧢⚡️
</p>

<p align="center">
  <b>Built by a Trainer, for Trainers everywhere.</b>
</p>
