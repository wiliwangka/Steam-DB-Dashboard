class GameBubbleView {
  constructor(_config, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      // For the game view, we want only the color legend.
      sliderParentElement: _config.sliderParentElement || _config.parentElement,
      containerWidth: _config.containerWidth || 600,
      containerHeight: _config.containerHeight || 400,
      margin: _config.margin || { top: 40, right: 40, bottom: 40, left: 40 },
    };
    this.data = _data; // Data for the selected publisher's games
    this.dispatcher = _dispatcher;
    this.selectedGameId = null;
    // Default threshold for bubble size scaling
    this.threshold = 0;
    // Default to showing indie games
    this.showIndie = true;
    
    // Add a listener for peak CCU threshold changes
    this.dispatcher.on("updatePeakCCUThreshold.gameBubble", (threshold) => {
      this.threshold = threshold;
      this.updateVis();
    });
    
    // Add a listener for indie visibility changes
    this.dispatcher.on("updateIndieVisibility.gameBubble", (showIndie) => {
      this.showIndie = showIndie;
      this.updateVis();
    });
    
    this.initVis();
  }

  initVis() {
    let vis = this;

    // Create SVG.
    vis.width =
      vis.config.containerWidth -
      vis.config.margin.left -
      vis.config.margin.right;
    vis.height =
      vis.config.containerHeight -
      vis.config.margin.top -
      vis.config.margin.bottom;

    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

    // Append title
    vis.svg
      .append("text")
      .attr("class", "chart-title")
      .attr("x", vis.width / 2 + vis.config.margin.left)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .text("Publisher's Games");

    // Add "Go Back" button
    const backGroup = vis.svg
      .append("g")
      .attr("class", "go-back-button-group")
      .attr("transform", `translate(${vis.config.margin.left}, 10)`)
      .style("cursor", "pointer")
      .on("click", () => {
        vis.dispatcher.call("backToPublishers");
      });

    // Add a filter for drop shadow
    const filter = vis.svg.append("defs")
      .append("filter")
      .attr("id", "drop-shadow")
      .attr("height", "130%");

    filter.append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", "2")
      .attr("result", "blur");

    filter.append("feOffset")
      .attr("in", "blur")
      .attr("dx", "1")
      .attr("dy", "1")
      .attr("result", "offsetBlur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode")
      .attr("in", "offsetBlur");
    feMerge.append("feMergeNode")
      .attr("in", "SourceGraphic");

    // Create gradient for the button
    const gradient = vis.svg.append("defs")
      .append("linearGradient")
      .attr("id", "steam-button-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#2a475e");

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#1b2838");

    // Create hover gradient
    const hoverGradient = vis.svg.append("defs")
      .append("linearGradient")
      .attr("id", "steam-button-hover-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    hoverGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#3a576e");

    hoverGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#2b3848");

    // Button background
    const buttonRect = backGroup
      .append("rect")
      .attr("width", 80)
      .attr("height", 30)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", "url(#steam-button-gradient)")
      .attr("stroke", "#66c0f4")
      .attr("stroke-width", 1)
      .attr("filter", "url(#drop-shadow)");

    // Button text
    const buttonText = backGroup
      .append("text")
      .attr("x", 40)
      .attr("y", 15)
      .attr("font-size", "25px")
      .attr("font-family", "Arial, sans-serif")
      .attr("font-weight", "bold")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#c7d5e0")
      .text("←");

    // Add hover effects
    backGroup
      .on("mouseover", function() {
        buttonRect
          .attr("fill", "url(#steam-button-hover-gradient)")
          .attr("stroke", "#66c0f4")
          .attr("stroke-width", 1.5);
        
        buttonText
          .attr("fill", "#ffffff");
      })
      .on("mouseout", function() {
        buttonRect
          .attr("fill", "url(#steam-button-gradient)")
          .attr("stroke", "#66c0f4")
          .attr("stroke-width", 1);
        
        buttonText
          .attr("fill", "#c7d5e0");
      });

    // Create chart group
    vis.chart = vis.svg
      .append("g")
      .attr(
        "transform",
        `translate(${vis.config.margin.left}, ${vis.config.margin.top})`
      );

    // Create a color scale for positive review rate
    vis.colorScale = d3
      .scaleSequential()
      .domain([0, 1]) // 0-100% positive review rate
      .interpolator(d3.interpolateRdYlGn); // Red (0%) to Yellow to Green (100%)

    // Legend for review ratings
    vis.legendWidth = 200;
    vis.legendHeight = 20;

    vis.legendScale = d3
      .scaleLinear()
      .domain([0, 100])
      .range([0, vis.legendWidth]);

    vis.legendAxis = d3
      .axisBottom(vis.legendScale)
      .tickSize(vis.legendHeight)
      .ticks(5)
      .tickFormat((d) => `${d}%`);

    vis.legend = vis.svg
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${
          (vis.width - vis.legendWidth) / 2 + vis.config.margin.left
        }, ${vis.height + vis.config.margin.top + 20})`
      );

    // Create gradient for legend
    vis.defs = vis.svg.append("defs");
    vis.linearGradient = vis.defs
      .append("linearGradient")
      .attr("id", "review-gradient");

    // Define gradient stops
    vis.linearGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", vis.colorScale(0));

    vis.linearGradient
      .append("stop")
      .attr("offset", "50%")
      .attr("stop-color", vis.colorScale(0.5));

    vis.linearGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", vis.colorScale(1));

    // Draw legend rectangle
    vis.legend
      .append("rect")
      .attr("width", vis.legendWidth)
      .attr("height", vis.legendHeight)
      .style("fill", "url(#review-gradient)");

    // Add legend axis
    vis.legend
      .append("g")
      .attr("transform", `translate(0, ${vis.legendHeight})`)
      .call(vis.legendAxis);

    // Add legend title
    vis.legend
      .append("text")
      .attr("class", "legend-title")
      .attr("x", vis.legendWidth / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .text("Positive Review Rate");

    vis.updateVis();
  }

  updateVis() {
    let vis = this;

    // Check if data is available
    if (!vis.data || vis.data.length === 0) {
      console.log("GameBubbleView: No data available");
      d3.select(vis.config.parentElement)
        .append("div")
        .attr("class", "no-data-message")
        .style("text-align", "center")
        .style("padding-top", "50px")
        .text("Select a publisher to view their games");
      return;
    }

    // Remove any no-data message
    d3.select(vis.config.parentElement).select(".no-data-message").remove();

    console.log(`GameBubbleView: Processing ${vis.data.length} games`);

    // Process the data to create nodes for the bubble chart
    vis.processedData = vis.data.map((d) => ({
      appId: d.AppID,
      title: d.Name || "Unknown Game",
      peak: +d["Peak CCU"] || 0,
      price: +d.Price || 0,
      releaseDate:
        d.ReleaseDate instanceof Date
          ? d.ReleaseDate.toLocaleDateString()
          : new Date(d["Release date"]).toLocaleDateString(),
      positiveReviewRate: +d["Review Ratio"] || 0,
      positive: +d.Positive || 0,
      negative: +d.Negative || 0,
      totalReviews: (+d.Positive || 0) + (+d.Negative || 0),
      isIndie: d.class === "Indie"
    }));

    // Filter to games with more than 0 peak CCU
    vis.processedData = vis.processedData.filter((d) => d.peak > 0);
    
    // Filter to games with peak CCU above the threshold
    if (vis.threshold > 0) {
      vis.processedData = vis.processedData.filter((d) => d.peak >= vis.threshold);
      console.log(`GameBubbleView: Filtered to ${vis.processedData.length} games with peak CCU >= ${vis.threshold}`);
    }
    
    // Filter indie games if needed
    if (!vis.showIndie) {
      vis.processedData = vis.processedData.filter((d) => !d.isIndie);
      console.log(`GameBubbleView: Filtered to ${vis.processedData.length} non-indie games`);
    }
    
    // Sort by peak CCU (descending) and take only the top 30 games
    vis.processedData = vis.processedData
      .sort((a, b) => b.peak - a.peak)
      .slice(0, 50);
    
    // Calculate the actual range of positive review rates in the dataset
    const minReviewRate = d3.min(vis.processedData, d => d.positiveReviewRate) || 0;
    const maxReviewRate = d3.max(vis.processedData, d => d.positiveReviewRate) || 1;
    
    // Use the exact same scale range as in publisherBubbleView.js (50.4% to 99.2%)
    const fixedMinReviewRate = 0.504; // 50.4%
    const fixedMaxReviewRate = 0.992; // 99.2%
    const fixedMidReviewRate = (fixedMinReviewRate + fixedMaxReviewRate) / 2;
    
    // Update the color scale to use the fixed range
    vis.colorScale = d3
      .scaleDiverging()
      .domain([fixedMinReviewRate, fixedMidReviewRate, fixedMaxReviewRate])
      .interpolator(d3.interpolateRgbBasis(["red", "white", "green"]));
      
    // Update the legend scale to match the fixed range
    vis.legendScale = d3
      .scaleLinear()
      .domain([fixedMinReviewRate * 100, fixedMaxReviewRate * 100])
      .range([0, vis.legendWidth]);
      
    // Update the legend axis
    vis.legendAxis = d3
      .axisBottom(vis.legendScale)
      .tickSize(vis.legendHeight)
      .ticks(5)
      .tickFormat((d) => `${d.toFixed(1)}%`);
      
    // Update the legend title to show the range
    vis.svg.select(".legend-title")
      .text(`Positive Review Rate (${(fixedMinReviewRate * 100).toFixed(1)}% - ${(fixedMaxReviewRate * 100).toFixed(1)}%)`);
      
    // Update the gradient stops
    vis.linearGradient.selectAll("stop").remove();
    vis.linearGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", vis.colorScale(fixedMinReviewRate));
      
    vis.linearGradient
      .append("stop")
      .attr("offset", "50%")
      .attr("stop-color", vis.colorScale((fixedMinReviewRate + fixedMaxReviewRate) / 2));
      
    vis.linearGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", vis.colorScale(fixedMaxReviewRate));
      
    // Update the legend axis
    vis.legend.select("g").call(vis.legendAxis);

    // Process the data to calculate appropriate bubble sizes
    // Use square root scale for bubble sizes to prevent huge bubbles
    const maxPeak = d3.max(vis.processedData, (d) => d.peak) || 1;
    const minBubbleRadius = 20;
    const maxBubbleRadius = 50;

    // Use square root scale for more reasonable bubble sizes
    vis.radiusScale = d3
      .scaleSqrt()
      .domain([0, maxPeak])
      .range([minBubbleRadius, maxBubbleRadius]);

    // Create nodes data with positions for the force simulation
    vis.nodes = vis.processedData.map((d) => ({
      ...d,
      radius: vis.radiusScale(d.peak),
      x: Math.random() * vis.width,
      y: Math.random() * vis.height,
    }));

    // Update chart title with publisher name if there's data
    if (vis.data.length > 0) {
      // Check if this is an indie games dataset
      const hasIndieGames = vis.data.some(d => d.class === "Indie");
      if (hasIndieGames || vis.data[0].Publishers === "Indie") {
        vis.svg.select(".chart-title").text("Top 50 Games by Indie Publisher");
      } else {
        const publisherName = vis.data[0].Publishers || "Unknown Publisher";
        vis.svg.select(".chart-title").text(`Games by ${publisherName}`);
      }
    }

    // Create force simulation
    vis.simulation = d3
      .forceSimulation(vis.nodes)
      .force("charge", d3.forceManyBody().strength(5))
      .force("center", d3.forceCenter(vis.width / 2, vis.height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d) => d.radius + 2)
      )
      .force("x", d3.forceX(function(d) {
        // Position based on review rating: higher ratings to the right
        if (d.positiveReviewRate > 0.83) {
          return vis.width * 0.75; // Right side
        } else if (d.positiveReviewRate < 0.666) {
          return vis.width * 0.25; // Left side
        } else {
          return vis.width * 0.5; // Middle
        }
      }).strength(0.1)) 
      .force("y", d3.forceY(vis.height / 2).strength(0.05))
      .on("tick", () => {
        vis.chart
          .selectAll(".game-bubble")
          .attr("cx", (d) =>
            Math.max(d.radius, Math.min(vis.width - d.radius, d.x))
          )
          .attr("cy", (d) =>
            Math.max(d.radius, Math.min(vis.height - d.radius, d.y))
          );

        vis.chart
          .selectAll(".game-label")
          .attr("x", (d) =>
            Math.max(d.radius, Math.min(vis.width - d.radius, d.x))
          )
          .attr("y", (d) =>
            Math.max(d.radius, Math.min(vis.height - d.radius, d.y))
          );
      });

    vis.renderVis();
  }

  renderVis() {
    let vis = this;

    // Bind nodes data to circles
    let circles = vis.chart
      .selectAll(".game-bubble")
      .data(vis.nodes, (d) => d.appId);

    // Remove old circles
    circles.exit().remove();

    // Create new circles
    let circlesEnter = circles
      .enter()
      .append("circle")
      .attr("class", (d) => `game-bubble game-${d.appId}`)
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => vis.colorScale(d.positiveReviewRate))
      .attr("stroke", "#000")
      .attr("stroke-width", (d) => (d.appId === vis.selectedGameId ? 3 : 1))
      .attr("stroke-opacity", (d) => (d.appId === vis.selectedGameId ? 1 : 0.3))
      .attr("fill-opacity", 0.7)
      .attr("cursor", "pointer")
      .on("mouseover", function (event, d) {
        // Highlight on hover
        d3.select(this).attr("fill-opacity", 1).attr("stroke-opacity", 1);

        // Show tooltip
        d3.select("#tooltip")
          .style("display", "block")
          .style("opacity", 1)
          .html(
            `
            <div style="font-weight: bold; font-size: 14px;">${d.title}</div>
            <div><strong>Peak Players:</strong> ${d3.format(",")(d.peak)}</div>
            <div><strong>Price:</strong> ${
              d.price === 0 ? "Free to Play" : "$" + d.price.toFixed(2)
            }</div>
            <div><strong>Released:</strong> ${d.releaseDate}</div>
            <div><strong>Reviews:</strong> ${
              d.totalReviews > 0
                ? `${(d.positiveReviewRate * 100).toFixed(1)}% Positive (${
                    d.positive
                  } of ${d.totalReviews})`
                : "No reviews"
            }</div>
          `
          )
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", function () {
        // Reset highlight on mouseout
        d3.select(this)
          .attr("fill-opacity", 0.7)
          .attr("stroke-opacity", (d) =>
            d.appId === vis.selectedGameId ? 1 : 0.3
          );

        // Hide tooltip
        d3.select("#tooltip").style("display", "none").style("opacity", 0);
      })
      .on("click", function (event, d) {
        // Dispatch select game event
        vis.dispatcher.call("selectGame", null, d.appId);
        vis.selectedGameId = d.appId;

        // Update selection visually
        vis.chart
          .selectAll(".game-bubble")
          .attr("stroke-width", (d) => (d.appId === vis.selectedGameId ? 3 : 1))
          .attr("stroke-opacity", (d) =>
            d.appId === vis.selectedGameId ? 1 : 0.3
          );
      });

    // Add labels for large bubbles (optional)
    const labelThreshold = 30; // Only show labels for bubbles larger than this radius

    let labels = vis.chart.selectAll(".game-label").data(
      vis.nodes.filter((d) => d.radius > labelThreshold),
      (d) => d.appId
    );

    labels.exit().remove();

    labels
      .enter()
      .append("text")
      .attr("class", "game-label")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "10px")
      .attr("fill", "white")
      .attr("pointer-events", "none") // Don't interfere with bubble interactions
      .text((d) =>
        d.title.length > 10 ? d.title.substring(0, 10) + "..." : d.title
      );
  }

  // Method to highlight a specific game
  highlightGame(gameId) {
    let vis = this;
    vis.selectedGameId = gameId;

    // Update visual highlighting
    vis.chart
      .selectAll(".game-bubble")
      .attr("stroke-width", (d) => (d.appId === vis.selectedGameId ? 3 : 1))
      .attr("stroke-opacity", (d) =>
        d.appId === vis.selectedGameId ? 1 : 0.3
      );
  }
}
