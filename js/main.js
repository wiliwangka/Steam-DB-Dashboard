/**
 * Load game data and initialize visualizations
 */

let datasetloc = "data/games-data.csv";
let timeRange = []; // all

let dataset,
  timeLineViewTop,
  timeLineViewDetail,
  publisherBubbleView,
  gameBubbleView,
  scatterPlotView,
  gameListView;
let filteredData;
let thouSeparator = d3.format(",.0f");
let decFormat = d3.format(",.1f");
let percentFormat = d3.format(".1%");

// Global event dispatcher for cross-visualization communication
const dispatcher = d3.dispatch(
  "filterTime",
  "selectGame",
  "selectPublisher",
  "backToPublishers",
  "updatePeakCCUThreshold",
  "updateIndieVisibility"
);
// Setup scrolling effects
window.onscroll = function () {
  fadeViewsOnScroll();
};

// Function to fade views when scrolled out of viewport
function fadeViewsOnScroll() {
  // Get all visualization views
  const views = document.querySelectorAll(".view");

  views.forEach((view) => {
    // Get the position of the view relative to the viewport
    const rect = view.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // Calculate how much of the view is visible
    const visibleHeight =
      Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
    const visibilityRatio = visibleHeight / rect.height;

    // Check if the view is fully or partially out of the viewport
    if (visibilityRatio < 0.5) {
      // View is mostly out of viewport, add the faded class
      view.classList.add("view-faded");
    } else {
      // View is mostly in viewport, remove the faded class
      view.classList.remove("view-faded");
    }
  });
}

// Initialize visualizations with empty data first
function initializeVisualizations() {
  // Initialize timeline view for filtering by date (top row)
  timeLineViewTop = new TimeLineViewTop(
    {
      parentElement: "#topTimeLineView",
      containerWidth: 1400,
      containerHeight: 150,
    },
    [],
    dispatcher
  );

  // Initialize detailed timeline view (second row)
  timeLineViewDetail = new TimeLineViewDetail(
    {
      parentElement: "#detailTimeLineView",
      containerWidth: 1400,
      containerHeight: 400,
    },
    [],
    dispatcher
  );

  publisherBubbleView = new PublisherBubbleView(
    {
      parentElement: "#publisherBubbleView", // The bubble chart container
      containerWidth: 900,
      containerHeight: 450,
    },
    [],
    dispatcher
  );

  // Create your game bubble view (initially hidden, no data yet)
  gameBubbleView = new GameBubbleView(
    {
      parentElement: "#gameBubbleView", // Another container in HTML
      containerWidth: 900,
      containerHeight: 450,
    },
    [],
    dispatcher
  );

  scatterPlotView = new ScatterPlotView(
    {
      parentElement: "#scatterPlotView",
      containerWidth: 460,
      containerHeight: 450,
    },
    [],
    dispatcher
  );

  gameListView = new GameListView(
    {
      parentElement: "#gameListView",
      containerWidth: 1400,
      containerHeight: 450,
    },
    [],
    dispatcher
  );

  // Call updateVis on each to display placeholder visualizations
  timeLineViewTop.updateVis();
  timeLineViewDetail.updateVis();
  publisherBubbleView.updateVis();
  scatterPlotView.updateVis();
  gameListView.updateVis();

  // Initial call to set correct fade states
  setTimeout(fadeViewsOnScroll, 500);

  // The "publisher" container is visible by default, "game" container is hidden
  d3.select("#gameBubbleView").style("display", "none");

  dispatcher.on("selectPublisher", (publisherName) => {
    // Hide the publisher bubble view and its slider
    d3.select("#publisherBubbleView").style("display", "none");

    // Show the game bubble view (which still shows its color legend as defined in GameBubbleView)
    d3.select("#gameBubbleView").style("display", "block");

    // Get the games for the selected publisher
    let publisherGames;
    if (!dataset || dataset.length === 0) {
      publisherGames = [
        {
          AppID: "931376",
          Title: "Game 1",
          PeakCCU: 55805,
          Price: 55.9,
          ReleaseDate: "2017-04-03",
          PositiveReviewRate: 0.32,
        },
        {
          AppID: "100710",
          Title: "Game 2",
          PeakCCU: 24485,
          Price: 11.02,
          ReleaseDate: "2016-12-10",
          PositiveReviewRate: 0.93,
        },
        {
          AppID: "619280",
          Title: "Game 3",
          PeakCCU: 69494,
          Price: 12.21,
          ReleaseDate: "2023-09-30",
          PositiveReviewRate: 0.15,
        },
        {
          AppID: "728891",
          Title: "Game 4",
          PeakCCU: 145612,
          Price: 9.18,
          ReleaseDate: "2023-12-15",
          PositiveReviewRate: 0.28,
        },
        {
          AppID: "881997",
          Title: "Game 5",
          PeakCCU: 46073,
          Price: 57.71,
          ReleaseDate: "2024-12-21",
          PositiveReviewRate: 0.29,
        },
      ];
    } else {
      // Filter based on whether it's an indie selection or a publisher selection
      publisherGames = dataset.filter((d) => {
        if (publisherName === "Indie") {
          return d.class === "Indie";
        } else {
          return d.Publishers === publisherName;
        }
      });
      if (timeRange.length === 2) {
        const [startDate, endDate] = timeRange;
        publisherGames = publisherGames.filter(d => {
          const relDate = new Date(d.ReleaseDate); // or d["Release date"]
          return relDate >= startDate && relDate <= endDate;
        });
      }
    }

    // Update the game bubble view with the selected publisher's games
    gameBubbleView.data = publisherGames;
    gameBubbleView.updateVis();
  });

  dispatcher.on("backToPublishers", () => {
    // Hide the game bubble view and show the publisher bubble view
    d3.select("#gameBubbleView").style("display", "none");
    d3.select("#publisherBubbleView").style("display", "block");

    // Remove and re-add the global tooltip element if needed.
    d3.select("#tooltip").remove();
    d3.select("body")
      .append("div")
      .attr("id", "tooltip")
      .attr("class", "tooltip");
    
    // Reset and update the scatterplot by clearing the publisher filter
    scatterPlotView.selectPublisher = null;
    scatterPlotView.updateVis();

    // Reset and update the gameListView by clearing the publisher filter
    gameListView.selectedPublisher = null;
    gameListView.updateVis();

    // Clear any game selection
    gameBubbleView.highlightGame(null);
    gameListView.highlightGame(null);
    scatterPlotView.highlightGame(null);
  });
}

// Call this function when the page loads
window.addEventListener("load", function () {
  initializeVisualizations();
});

// Load data and initialize visualizations
Promise.all([
  d3.csv("data/preprocessing.csv"),
  d3.csv(datasetloc), // Original data still needed for other views
])
  .then(([preprocessedData, originalData]) => {
    // Process preprocessed data
    preprocessedData.forEach((d) => {
      d.timestamp = +d.timestamp;
      d.date = new Date(d.date);
      d.count = +d.count;
    });

    // Separate the data by type
    const dailyData = preprocessedData.filter((d) => d.type === "daily");
    const monthlyData = preprocessedData.filter((d) => d.type === "monthly");
    const yearlyData = preprocessedData.filter((d) => d.type === "yearly");

    // Store preprocessed data in a global variable for easy access
    window.precomputedData = {
      daily: dailyData.map((d) => [d.timestamp, d.count]),
      monthly: monthlyData.map((d) => [d.timestamp, d.count]),
      yearly: yearlyData,
      dateExtent: [
        d3.min(dailyData, (d) => d.date),
        d3.max(dailyData, (d) => d.date),
      ],
    };

    // Process original data
    dataset = originalData;
    console.log("Data loaded:", dataset.length, "records");

    // Preprocess data
    if (dataset) {
      // Handle date parsing
      dataset.forEach((d) => {
        // Parse Release date column
        let releaseDateStr = d["Release date"];
        let releaseDate = new Date(releaseDateStr);

        // Store the properly parsed date
        d.ReleaseDate = releaseDate;

        // Convert numeric values
        d.Price = +d.Price;
        d.PeakCCU = +d["Peak CCU"] || 0;
        d.PositiveReviewRate = +d["Review Ratio"] || 0;
      });

      // Remove entries with invalid dates
      let initialCount = dataset.length;
      dataset = dataset.filter(
        (d) => d.ReleaseDate instanceof Date && !isNaN(d.ReleaseDate)
      );
      console.log("Valid date entries:", dataset.length, "of", initialCount);

      if (dataset.length === 0) {
        console.error("No valid date entries found in the dataset!");
        console.log("Sample raw data:", originalData.slice(0, 3));
        return;
      }

      // Update all visualizations
      updateVisualizationState();
    }

    // Setup event listeners
    dispatcher.on("filterTime", (selectedTimeRange) => {
      console.log(
        "Filter time event received with range:",
        selectedTimeRange[0].toISOString().split("T")[0],
        "to",
        selectedTimeRange[1].toISOString().split("T")[0]
      );

      timeRange = selectedTimeRange;

      if (timeLineViewDetail) {
        timeLineViewDetail.timeRange = selectedTimeRange;
      }

      updateVisualizationState(true);

      // 🔽 Add this block to update gameBubbleView if a publisher is selected
      if (publisherBubbleView.selectedPublisher) {
        const selected = publisherBubbleView.selectedPublisher;

        // Filter the updated dataset
        const filteredGames = filteredData.filter((d) => {
          if (selected === "Indie Games") {
            return d.class === "Indie";
          } else {
            return d.Publishers === selected;
          }
        });

        gameBubbleView.data = filteredGames;
        gameBubbleView.updateVis();
      }
    });

    dispatcher.on("selectGame", (gameId) => {
      // Highlight the selected game in all visualizations
      publisherBubbleView.highlightPublisher(gameId);
      gameBubbleView.highlightGame(gameId);
      scatterPlotView.highlightGame(gameId);
      gameListView.highlightGame(gameId);
      gameBubbleView.highlightGame(gameId);
    });

    // Add listener for peak CCU threshold changes
    dispatcher.on("updatePeakCCUThreshold", (threshold) => {
      console.log(`Peak CCU threshold updated to: ${threshold}`);
      
      // Dispatch to all views with the correct namespace
      dispatcher.call("updatePeakCCUThreshold.gameBubble", null, threshold);
      dispatcher.call("updatePeakCCUThreshold.scatterPlot", null, threshold);
      dispatcher.call("updatePeakCCUThreshold.gameList", null, threshold);
    });

    // Add listener for indie visibility changes
    dispatcher.on("updateIndieVisibility", (showIndie) => {
      console.log(`Indie visibility updated to: ${showIndie}`);
      
      // Dispatch to all views with the correct namespace
      dispatcher.call("updateIndieVisibility.gameBubble", null, showIndie);
      dispatcher.call("updateIndieVisibility.scatterPlot", null, showIndie);
      dispatcher.call("updateIndieVisibility.gameList", null, showIndie);
    });
  })
  .catch((error) => console.error(`Error: ${error}, trace: ${error.stack}`));

// Filter data based on current filter settings
function filterData() {
  // Start with all data
  let filtered = dataset || [];

  console.log("Filtering data from", filtered.length, "records");

  // Apply time range filter if specified
  if (timeRange.length === 2) {
    filtered = filtered.filter(
      (d) => d.ReleaseDate >= timeRange[0] && d.ReleaseDate <= timeRange[1]
    );
    console.log("After time filter:", filtered.length, "records");
  }

  return filtered;
}

// Update all visualizations with filtered data
function updateVisualizationState(fromBrushEvent = false) {
  filteredData = filterData();

  // Update data for all visualizations
  timeLineViewTop.data = filteredData;
  timeLineViewDetail.data = filteredData;
  publisherBubbleView.data = filteredData;
  scatterPlotView.data = filteredData;
  gameListView.data = filteredData;

  // Only update the top timeline if it wasn't the source of the event
  if (!fromBrushEvent) {
    timeLineViewTop.updateVis();
  }

  // Always update the other visualizations
  timeLineViewDetail.updateVis();
  publisherBubbleView.updateVis();
  scatterPlotView.updateVis();
  gameListView.updateVis();
}
