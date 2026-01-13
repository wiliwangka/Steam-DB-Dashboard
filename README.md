## SteamStats: PC Game Analytics Dashboard

SteamStats is an interactive D3.js dashboard that explores the evolution of the PC gaming industry on Steam from 2006 to 2025. Using multiple coordinated visualizations, it helps you investigate trends in game releases, pricing, reviews, and publisher performance.

---

## Features

- **Top timeline view** (`timeLineViewTop.js`):  
  High‑level timeline showing game releases or aggregated metrics over time to give a quick overview of trends across years.

- **Detailed timeline view** (`timeLineViewDetail.js`):  
  A more granular timeline view that updates based on user interactions and filters, enabling closer inspection of specific periods.

- **Publisher bubble view** (`publisherBubbleView.js`):  
  Bubble chart summarizing publishers based on metrics such as revenue, game count, or review volume. Bubble size and position encode key publisher statistics.

- **Game bubble view** (`gameBubbleView.js`):  
  Bubble chart at the individual game level to compare games on attributes like price, reviews, and popularity.

- **Scatter plot view** (`scatterPlotView.js`):  
  Scatter plot linking two quantitative attributes (for example, price vs. review score), helping reveal outliers and correlations.

- **Game list view** (`gameListView.js`):  
  Tabular/list view of games that responds to selections and filters from the visualizations, allowing detailed inspection of specific titles.

- **Interactive walkthrough & filters**:  
  The header description mentions a **Walkthrough** and a **slider filter** (histogram range selector) that guide exploration and let you focus on particular time windows or subsets of games.

---

## Tech Stack

- **HTML/CSS/JavaScript**
- **D3.js v6** (loaded via CDN in `index.html`)
- Custom visualization logic in `js/*.js`

---

## Project Structure

- **`index.html`**: Main entry point that lays out the dashboard containers and loads all scripts.
- **`css/style.css`**: Styles for the dashboard layout, typography, colors, and tooltips.
- **`js/timeLineViewTop.js`**: Code for the top‑level timeline visualization.
- **`js/timeLineViewDetail.js`**: Code for the detailed timeline visualization.
- **`js/publisherBubbleView.js`**: Publisher‑level bubble chart.
- **`js/gameBubbleView.js`**: Game‑level bubble chart.
- **`js/scatterPlotView.js`**: Scatter plot visualization.
- **`js/gameListView.js`**: Interactive list of games.
- **`js/main.js`**: Application glue code; loads data, initializes all views, and wires up interactions.
- **`data/games-data.csv`**: Main dataset used by the dashboard (Steam game metadata and metrics).
- **`data/preprocessing.csv`**: Intermediate/preprocessed version of the data used for transformations or debugging.
- **`thumbnail.png`**: Preview image of the dashboard.

Backup files like `publisherBubbleView.js.backup` / `.bak` are retained for development history and are not required at runtime.

---

## Getting Started

### 1. Prerequisites

- A modern web browser (Chrome, Firefox, Edge, or Safari).
- **Recommended:** A simple local HTTP server to avoid browser security restrictions when loading local CSV files.

You do **not** need Node.js or a build step; this is a static D3.js project.

### 2. Run Locally

From the project root (`Steam DB dashboard`), start a simple HTTP server. A few common options:

- **Using Python 3:**

```bash
cd "/Users/williamwang/Downloads/Steam DB dashboard"
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html` in your browser.

- **Using VS Code Live Server extension:**  
  Open the folder in VS Code, right‑click `index.html`, and choose **“Open with Live Server”**.

> Opening `index.html` directly from the file system (via `file://` URL) may cause the CSV loads to fail because of browser security restrictions, so using a local server is strongly recommended.

---

## Usage

- **Explore the timeline:** Use the top timeline to understand overall trends. Zoom or filter (depending on implemented controls) to focus on particular years.
- **Adjust filters:** Use the histogram slider filter (if shown) to restrict games to a specific time window or range of values.
- **Use the walkthrough:** Click the **Walkthrough** button (if present) to be guided through key insights and interactions.
- **Inspect publishers and games:** Hover or click on bubbles in the publisher and game bubble charts to see more information in tooltips or in the game list.
- **Study relationships:** Use the scatter plot to explore relationships between variables such as price, reviews, and popularity.
- **Drill down in the list:** Click or hover items in the game list to highlight corresponding points or bubbles in the visualizations (depending on the linked behaviors implemented).

---

## Data

The project uses pre‑collected Steam game data:

- **`games-data.csv`**: Main dataset for all visualizations, likely including fields such as game title, publisher, release date, price, review counts/scores, and tags or genres.
- **`preprocessing.csv`**: Optional helper file capturing intermediate or transformed values used during preprocessing.

If you update or replace these files, ensure:

- Column names expected in the JavaScript files are preserved, or
- You update the parsing logic in `main.js` and the relevant view modules.

---

## Customization

- **Styling:** Modify `css/style.css` to change colors, typography, layout, and hover styles.
- **Layout:** Edit `index.html` to add/remove views or rearrange the dashboard layout.
- **Visual encodings:** Adjust scales, axes, colors, or sizes in each `js/*View.js` file to map data to visuals differently.
- **New views:** Create a new visualization by adding a script file in `js/`, referencing it in `index.html`, and wiring it into `main.js`.

---

## Credits & License

This dashboard is built with **D3.js**.  
If this project is part of a course, assignment, or research project, please add the appropriate attribution and licensing information here.
