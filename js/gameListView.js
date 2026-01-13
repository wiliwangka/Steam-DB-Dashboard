class GameListView {
  constructor(_config, _data, _dispatcher) {
    // Calculate total width based on cards and margins
    const cardWidth = 300;
    const cardMargin = 20; // margin-right for each card except last
    const totalWidth = cardWidth * 4 + cardMargin * 3; // 4 cards with 3 gaps between them
    const arrowSpace = 40; // Space for arrows on each side

    this.config = {
      parentElement: _config.parentElement,
      containerWidth: totalWidth + arrowSpace * 2, // Add space for arrows
      containerHeight: _config.containerHeight || 140,
      margin: _config.margin || { top: 20, right: 0, bottom: 40, left: 0 },
      gameListLimit: 24,
      cardsPerPage: 4,
      cardWidth: cardWidth,
      cardHeight: 140,
      cardMargin: cardMargin,
      arrowSpace: arrowSpace,
      autoRotateInterval: 5000, // Auto-rotate every 5 seconds
    };
    this.data = _data;
    this.dispatcher = _dispatcher;
    this.selectedGameId = null;
    this.filteredData = [];
    this.currentPage = 0;
    this.autoRotateTimer = null; // Timer for auto-rotation
    this.isAutoRotatePaused = false; // Flag to track if auto-rotation is paused
    this.threshold = 0; // Add threshold property
    this.showIndie = true; // Default to showing indie games

    this.dispatcher.on(
      "selectPublisher.gameList",
      this.filterByPublisher.bind(this)
    );
    
    // Add a listener for peak CCU threshold changes
    this.dispatcher.on("updatePeakCCUThreshold.gameList", (threshold) => {
      this.threshold = threshold;
      this.updateVis();
    });
    
    // Add a listener for indie visibility changes
    this.dispatcher.on("updateIndieVisibility.gameList", (showIndie) => {
      this.showIndie = showIndie;
      this.updateVis();
    });

    this.initVis();
  }

  initVis() {
    let vis = this;

    // Calculate inner dimensions
    vis.width = vis.config.containerWidth;
    vis.height =
      vis.config.containerHeight -
      vis.config.margin.top -
      vis.config.margin.bottom;

    // Add title first, at the top (remove any existing title first)
    d3.select(vis.config.parentElement).selectAll(".chart-title").remove();
    d3.select(vis.config.parentElement)
      .append("div")
      .attr("class", "chart-title")
      .style("text-align", "center")
      .style("font-weight", "bold")
      .style("margin-bottom", "10px")
      .style("color", "#ffffff")
      .text("Top Games by Peak Players");

    // Create main container
    vis.container = d3
      .select(vis.config.parentElement)
      .append("div")
      .style("width", vis.width + "px")
      .style("height", "100%")
      .style("position", "relative")
      .style("overflow", "hidden")
      .style("margin", "0 auto")
      .on("mouseenter", function () {
        // Pause auto-rotation when hovering over the container
        vis.pauseAutoRotate();
      })
      .on("mouseleave", function () {
        // Resume auto-rotation when mouse leaves the container
        vis.resumeAutoRotate();
      });

    const arrowVerticalPosition = "40%"; // Default is middle (50%)
    const arrowHorizontalOffset = "-2px"; // Default is at the edge (0px)

    // Add navigation arrows
    vis.leftArrow = vis.container
      .append("div")
      .attr("class", "nav-arrow left")
      .style("position", "absolute")
      .style("left", arrowHorizontalOffset)
      .style("top", arrowVerticalPosition)
      .style("transform", "translateY(-50%)")
      .style("z-index", "10")
      .style("cursor", "pointer")
      .on("click", () => {
        this.navigateToPage("left");
        // Reset the timer when manually navigating
        this.resetAutoRotateTimer();
      });

    // Add the arrow icon
    vis.leftArrow
      .append("div")
      .attr("class", "nav-arrow-icon")
      .html(
        '<svg width="16" height="25" viewBox="0 0 10 16"><path fill="#ffffff" d="M9.5 13.1L4.4 8l5.1-5.1c.7-.7.7-1.8 0-2.5s-1.8-.7-2.5 0l-6.3 6.3c-.7.7-.7 1.8 0 2.5l6.3 6.3c.3.4.8.5 1.3.5.5 0 .9-.1 1.3-.5.6-.6.6-1.7-.1-2.4z"></path></svg>'
      );

    vis.rightArrow = vis.container
      .append("div")
      .attr("class", "nav-arrow right")
      .style("position", "absolute")
      .style("right", arrowHorizontalOffset)
      .style("top", arrowVerticalPosition)
      .style("transform", "translateY(-50%)")
      .style("z-index", "10")
      .style("cursor", "pointer")
      .on("click", () => {
        this.navigateToPage("right");
        // Reset the timer when manually navigating
        this.resetAutoRotateTimer();
      });

    // Add the arrow icon
    vis.rightArrow
      .append("div")
      .attr("class", "nav-arrow-icon")
      .html(
        '<svg width="16" height="25" viewBox="0 0 10 16"><path fill="#ffffff" d="M.5 13.1L5.6 8 .5 2.9C-.2 2.2-.2 1.1.5.4s1.8-.7 2.5 0l6.3 6.3c.7.7.7 1.8 0 2.5l-6.3 6.3c-.3.4-.8.5-1.3.5s-.9-.1-1.3-.5c-.6-.6-.6-1.7.1-2.4z"></path></svg>'
      );

    // Create a wrapper for the cards container to handle overflow
    vis.cardsWrapper = vis.container
      .append("div")
      .style("width", vis.width - vis.config.arrowSpace * 2 + "px")
      .style("height", "100%")
      .style("position", "relative")
      .style("overflow", "hidden")
      .style("margin", "0 " + vis.config.arrowSpace + "px");

    // Create cards container with exact width
    vis.cardsContainer = vis.cardsWrapper
      .append("div")
      .style("width", "max-content") // Allow container to grow as needed
      .style("height", "100%")
      .style("display", "flex")
      .style("transition", "transform 0.3s ease")
      .style("gap", vis.config.cardMargin + "px");

    // Create pagination dots container
    vis.paginationContainer = vis.container
      .append("div")
      .attr("class", "pagination-dots")
      .style("position", "absolute")
      .style("bottom", "0")
      .style("left", "50%")
      .style("transform", "translateX(-50%)")
      .style("display", "flex")
      .style("gap", "8px")
      .style("padding", "10px");
  }

  startAutoRotate() {
    let vis = this;

    // Clear any existing timer
    if (vis.autoRotateTimer) {
      clearInterval(vis.autoRotateTimer);
    }

    // Set up a new timer
    vis.autoRotateTimer = setInterval(() => {
      if (!vis.isAutoRotatePaused) {
        vis.navigateToPage("right");
      }
    }, vis.config.autoRotateInterval);
  }

  pauseAutoRotate() {
    this.isAutoRotatePaused = true;
  }

  resumeAutoRotate() {
    this.isAutoRotatePaused = false;
  }

  resetAutoRotateTimer() {
    // Reset the timer to give full time after manual navigation
    this.startAutoRotate();
  }

  stopAutoRotate() {
    if (this.autoRotateTimer) {
      clearInterval(this.autoRotateTimer);
      this.autoRotateTimer = null;
    }
  }

  updatePaginationDots() {
    let vis = this;
    const totalPages = Math.ceil(vis.topGames.length / vis.config.cardsPerPage);

    // Update pagination dots
    const dots = vis.paginationContainer
      .selectAll(".pagination-dot")
      .data(d3.range(totalPages));

    // Remove old dots
    dots.exit().remove();

    // Add new dots
    dots
      .enter()
      .append("div")
      .attr("class", (d) =>
        d === vis.currentPage ? "pagination-dot active" : "pagination-dot"
      )
      .merge(dots)
      .attr("class", (d) =>
        d === vis.currentPage ? "pagination-dot active" : "pagination-dot"
      )
      .style("width", "8px")
      .style("height", "8px")
      .style("border-radius", "50%")
      .style("cursor", "pointer")
      .on("click", (event, d) => this.navigateToPage(d));
  }

  navigateToPage(direction) {
    let vis = this;
    const totalPages = Math.ceil(vis.topGames.length / vis.config.cardsPerPage);

    // Handle circular navigation
    if (direction === "left") {
      vis.currentPage = (vis.currentPage - 1 + totalPages) % totalPages;
    } else if (direction === "right") {
      vis.currentPage = (vis.currentPage + 1) % totalPages;
    } else {
      // Handle direct page navigation from dots
      vis.currentPage = direction;
    }

    // Calculate the exact translation distance
    const cardSetWidth = vis.config.cardWidth + vis.config.cardMargin;
    const translateX =
      vis.currentPage * (cardSetWidth * vis.config.cardsPerPage) + 6;

    // Update transform for smooth transition
    vis.cardsContainer.style("transform", `translateX(-${translateX}px)`);

    // Update pagination dots
    vis.updatePaginationDots();
  }

  updateVis() {
    let vis = this;

    if (!vis.data || vis.data.length === 0) {
      console.log("GameListView: No data available");
      return;
    }

    // Process and filter data
    vis.filteredData = [...vis.data];

    if (vis.selectedPublisher) {
      if (vis.selectedPublisher === "Indie") {
        // Special case for Indie games
        vis.filteredData = vis.filteredData.filter((d) => d.class === "Indie");
        console.log(
          `GameListView: Filtered to ${vis.filteredData.length} indie games`
        );

        // Update the title to show "Top Games by Indie Publisher"
        d3.select(vis.config.parentElement)
          .select(".chart-title")
          .text("Top Games by Indie Publisher");
      } else {
        // Regular case for other publishers
        vis.filteredData = vis.filteredData.filter(
          (d) =>
            d.Publishers &&
            d.Publishers.toLowerCase() === vis.selectedPublisher.toLowerCase()
        );
        console.log(
          `GameListView: Filtered to ${vis.filteredData.length} games from publisher ${vis.selectedPublisher}`
        );

        // Update the title to show the publisher name
        d3.select(vis.config.parentElement)
          .select(".chart-title")
          .text(`Top Games by ${vis.selectedPublisher}`);
      }
    } else {
      // Default title for unfiltered view
      d3.select(vis.config.parentElement)
        .select(".chart-title")
        .text("Top Games by Peak Players");
    }

    // Format data with all necessary details
    vis.filteredData = vis.filteredData.map((d) => ({
      AppID: d.AppID,
      Name: d.Name,
      HeaderImage: d["Header image"],
      PeakCCU: +d["Peak CCU"] || 0,
      Price: +d.Price,
      ReleaseDate:
        d.ReleaseDate instanceof Date
          ? d.ReleaseDate
          : new Date(d["Release date"]),
      Publishers: d.Publishers,
      Positive: +d.Positive || 0,
      Negative: +d.Negative || 0,
      ReviewRatio: +d["Review Ratio"] || 0,
      isIndie: d.class === "Indie"
    }));

    // Filter to games with peak CCU above the threshold
    if (vis.threshold > 0) {
      vis.filteredData = vis.filteredData.filter((d) => d.PeakCCU >= vis.threshold);
      console.log(`GameListView: Filtered to ${vis.filteredData.length} games with peak CCU >= ${vis.threshold}`);
    }
    
    // Filter indie games if needed
    if (!vis.showIndie) {
      vis.filteredData = vis.filteredData.filter((d) => !d.isIndie);
      console.log(`GameListView: Filtered to ${vis.filteredData.length} non-indie games`);
    }

    // Sort by peak players
    vis.filteredData.sort((a, b) => b.PeakCCU - a.PeakCCU);
    vis.topGames = vis.filteredData.slice(0, vis.config.gameListLimit);

    // Reset to first page when data changes
    vis.currentPage = 0;

    vis.renderVis();

    // Start auto-rotation after rendering
    vis.startAutoRotate();
  }

  renderVis() {
    let vis = this;

    // Data join for game cards
    const cards = vis.cardsContainer
      .selectAll(".game-card")
      .data(vis.topGames, (d) => d.AppID);

    // Remove old cards
    cards.exit().remove();

    // Create new cards
    const cardsEnter = cards
      .enter()
      .append("div")
      .attr("class", "game-card")
      .style("width", vis.config.cardWidth + "px")
      .style("height", vis.config.cardHeight + "px")
      .style("position", "relative")
      .style("cursor", "pointer")
      .style("flex-shrink", "0")
      .style("border-radius", "8px")
      .style("overflow", "hidden")
      .on("click", function (event, d) {
        vis.dispatcher.call("selectGame", null, d.AppID);
        vis.selectedGameId = d.AppID;
        vis.updateSelection();
        // Pause auto-rotation when a game is selected
        vis.pauseAutoRotate();
      })
      .on("mouseenter", function (event, d) {
        d3.select(this).select(".game-details").style("opacity", 1);
      })
      .on("mouseleave", function () {
        d3.select(this).select(".game-details").style("opacity", 0);
      });

    // Add game images
    cardsEnter
      .append("img")
      .attr("src", (d) => d.HeaderImage)
      .style("width", "100%")
      .style("height", "100%")
      .style("object-fit", "cover");

    // Add details overlay
    const detailsOverlay = cardsEnter
      .append("div")
      .attr("class", "game-details")
      .style("position", "absolute")
      .style("top", "0")
      .style("left", "0")
      .style("right", "0")
      .style("bottom", "0")
      .style("color", "white")
      .style("background", "rgba(65, 122, 155, 0.7)")
      .style("padding", "10px")
      .style("opacity", "0")
      .style("transition", "opacity 0.2s ease");

    // Add game details content
    detailsOverlay
      .append("div")
      .attr("class", "game-title")
      .style("font-weight", "bold")
      .style("margin-bottom", "5px")
      .text((d) => d.Name);

    detailsOverlay
      .append("div")
      .attr("class", "game-publisher")
      .style("font-size", "12px")
      .style("margin-bottom", "5px")
      .text((d) => `Publisher: ${d.Publishers || "Unknown"}`);

    detailsOverlay
      .append("div")
      .attr("class", "game-price")
      .style("font-size", "12px")
      .text((d) => (d.Price === 0 ? "Free to Play" : `$${d.Price.toFixed(2)}`));

    detailsOverlay
      .append("div")
      .attr("class", "game-peak")
      .style("font-size", "12px")
      .text((d) => `Peak Players: ${d3.format(",")(d.PeakCCU)}`);

    detailsOverlay
      .append("div")
      .attr("class", "game-reviews")
      .style("font-size", "12px")
      .text((d) => {
        const total = d.Positive + d.Negative;
        const rating = d.ReviewRatio * 100;
        return total > 0
          ? `${rating.toFixed(1)}% Positive (${d3.format(",")(total)} reviews)`
          : "No reviews";
      });

    detailsOverlay
      .append("div")
      .attr("class", "game-release")
      .style("font-size", "12px")
      .text((d) => `Released: ${d.ReleaseDate.toLocaleDateString()}`);

    // Add Play Game button
    detailsOverlay
      .append("a")
      .attr("class", "play-game-button")
      .attr("href", (d) => `https://store.steampowered.com/app/${d.AppID}`)
      .attr("target", "_blank")  // Open in new tab
      .style("position", "absolute")
      .style("bottom", "15px")
      .style("right", "15px")
      .style("background", "#5c7e10")  // Steam's green color
      .style("color", "white")
      .style("padding", "8px 16px")
      .style("border-radius", "4px")
      .style("text-decoration", "none")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("cursor", "pointer")
      .style("text-transform", "uppercase")
      .text("Play Game")
      .on("click", function(event) {
        event.stopPropagation();  // Prevent card click event from firing
      });

    // Update pagination dots and navigation
    vis.updatePaginationDots();
    vis.navigateToPage(vis.currentPage);
  }

  updateSelection() {
    let vis = this;
    vis.cardsContainer
      .selectAll(".game-card")
      .style("opacity", (d) => (d.AppID === vis.selectedGameId ? 1 : 0.8))
      .style("border", (d) =>
        d.AppID === vis.selectedGameId ? "3px solid #73AD21" : "0px"
      );
  }

  filterByPublisher(publisherName) {
    let vis = this;
    vis.selectedPublisher = publisherName;
    vis.updateVis();
  }

  highlightGame(gameId) {
    let vis = this;
    vis.selectedGameId = gameId;
    vis.updateSelection();
  }

  // Add a method to clean up resources when the component is destroyed
  cleanup() {
    this.stopAutoRotate();
  }
}
