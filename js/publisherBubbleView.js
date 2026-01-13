class PublisherBubbleView {
  constructor(_config, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      sliderParentElement: _config.sliderParentElement || _config.parentElement,
      containerWidth: _config.containerWidth || 600,
      containerHeight: _config.containerHeight || 400,
      margin: _config.margin || { top: 40, right: 40, bottom: 40, left: 40 },
    };
    this.data = _data;
    this.dispatcher = _dispatcher;
    this.selectedPublisher = null;
    // Default threshold for filtering publishers (minimum peak CCU)
    this.minThreshold = 5000;
    this.maxThreshold = 100000;
    this.threshold = this.minThreshold; // Initialize threshold to minimum value
    // Add a flag to show/hide the indie bubble
    this.showIndieBubble = true;
    // Set color for indie games
    this.indieColor = "#8a2be2"; // BlueViolet - a distinct color for indie games
    // Constants for review rating range
    this.MIN_REVIEW_RATE = 0.5; // 36%
    this.MAX_REVIEW_RATE = 0.992; // 99.2%
    this.MID_REVIEW_RATE = (this.MIN_REVIEW_RATE + this.MAX_REVIEW_RATE) / 2;
    this.REVIEW_RATE_DIFF = this.MAX_REVIEW_RATE - this.MIN_REVIEW_RATE;
    this.initVis();
  }

  initVis() {
    let vis = this;

    // Calculate inner width and height
    vis.width =
      vis.config.containerWidth -
      vis.config.margin.left -
      vis.config.margin.right;
    vis.height =
      vis.config.containerHeight -
      vis.config.margin.top -
      vis.config.margin.bottom;

    // Initialize SVG
    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

    // Add title
    vis.svg
      .append("text")
      .attr("class", "chart-title")
      .attr("x", vis.config.containerWidth / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .text("Publishers by Peak Players and Review Rating");

    // Create chart area
    vis.chart = vis.svg
      .append("g")
      .attr(
        "transform",
        `translate(${vis.config.margin.left},${vis.config.margin.top})`
      );

    vis.colorScale = d3
      .scaleDiverging()
      .domain([vis.MIN_REVIEW_RATE, vis.MID_REVIEW_RATE, vis.MAX_REVIEW_RATE]) // 0: red, 0.5: white, 1: green
      .interpolator(d3.interpolateRgbBasis(["red", "white", "green"]));
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
        },${vis.height + vis.config.margin.top + 20})`
      );

    // Create gradient for legend
    vis.defs = vis.svg.append("defs");
    vis.linearGradient = vis.defs
      .append("linearGradient")
      .attr("id", "publisher-review-gradient");

    // Define gradient stops
    vis.linearGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", vis.colorScale(vis.MIN_REVIEW_RATE));

    vis.linearGradient
      .append("stop")
      .attr("offset", "50%")
      .attr(
        "stop-color",
        vis.colorScale((vis.MIN_REVIEW_RATE + vis.MAX_REVIEW_RATE) / 2)
      );

    vis.linearGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", vis.colorScale(vis.MAX_REVIEW_RATE));

    // Draw legend rectangle
    vis.legend
      .append("rect")
      .attr("width", vis.legendWidth)
      .attr("height", vis.legendHeight)
      .style("fill", "url(#publisher-review-gradient)");

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
      .text("Average Positive Review Rate");

    // Add indie game legend item
    vis.indieLegend = vis.svg
      .append("g")
      .attr("class", "indie-legend")
      .attr(
        "transform",
        `translate(${vis.config.margin.left + 10}, ${
          vis.config.containerHeight - 25
        })`
      );

    vis.indieLegend.append("circle").attr("r", 6).attr("fill", vis.indieColor);

    vis.indieLegend
      .append("text")
      .attr("x", 15)
      .attr("y", 4)
      .text("Indie Games")
      .style("font-size", "12px");

    // Add toggle for indie games
    vis.indieToggle = vis.svg
      .append("g")
      .attr("class", "indie-toggle")
      .attr(
        "transform",
        `translate(${vis.config.margin.left + 100}, ${
          vis.config.containerHeight - 25
        })`
      )
      .style("cursor", "pointer")
      .on("click", function () {
        vis.showIndieBubble = !vis.showIndieBubble;
        d3.select(this)
          .select("text")
          .text(vis.showIndieBubble ? "Hide Indie" : "Show Indie");
        vis.updateVis();
        
        // Dispatch an event to update other views
        vis.dispatcher.call("updateIndieVisibility", null, vis.showIndieBubble);
      });

    vis.indieToggle
      .append("rect")
      .attr("width", 70)
      .attr("height", 18)
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("fill", "#417a9b")
      .attr("y", -10);

    vis.indieToggle
      .append("text")
      .attr("x", 35)
      .attr("y", 4)
      .attr("text-anchor", "middle")
      .text("Hide Indie")
      .style("font-size", "12px")
      .style("fill", "#ffffff");

    // Initialize the slider
    this.initSlider();

    // Initial update
    vis.updateVis();
  }

  initSlider() {
    let vis = this;

    // Calculate the position of the legend (average positive review rate spectrum)
    const legendX = (vis.width - vis.legendWidth) / 2 + vis.config.margin.left;
    const legendY = vis.height + vis.config.margin.top + 20;

    // Calculate the position of the indie toggle
    const indieToggleX = vis.config.margin.left + 100;
    const indieToggleY = vis.config.containerHeight - 25;

    // Calculate the position for the slider (to the right of the legend)
    const sliderX = legendX + vis.legendWidth + 20; // 20px gap between legend and slider
    const sliderY = legendY - 10; // Align with the legend vertically

    // Create slider container directly in the SVG
    vis.sliderContainer = vis.svg
      .append("g")
      .attr("class", "slider-container")
      .attr("transform", `translate(${sliderX}, ${sliderY})`);

    // Add slider background
    vis.sliderContainer
      .append("rect")
      .attr("class", "slider-background")
      .attr("width", 200) // Fixed width for the slider
      .attr("height", 30)
      .attr("fill", "none");

    // Add slider label
    vis.sliderContainer
      .append("text")
      .attr("class", "slider-label")
      .attr("x", 45)
      .attr("y", 15)
      .attr("font-size", "9px")
      .attr("font-weight", "bold")
      .attr("fill", "#c6d4df") // Steam theme text color
      .text("Min Peak Players:");

    // Create slider track
    vis.sliderTrack = vis.sliderContainer
      .append("rect")
      .attr("class", "slider-track")
      .attr("x", 135) // Position right after the label
      .attr("y", 10)
      .attr("width", 130) // Shorter width to fit in the space
      .attr("height", 4)
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("fill", "#1b2838");

    // Create slider thumb
    vis.sliderThumb = vis.sliderContainer
      .append("circle")
      .attr("class", "slider-thumb")
      .attr("r", 6)
      .attr("fill", "#66c0f4")
      .attr("stroke", "#375f7d")
      .attr("stroke-width", 2)
      .attr("cursor", "pointer");

    // Create value display
    vis.valueDisplay = vis.sliderContainer
      .append("text")
      .attr("class", "slider-value")
      .attr("x", 275) // Position right after the track
      .attr("y", 15)
      .attr("font-size", "12px")
      .attr("fill", "#66c0f4") // Steam blue accent color
      .text(`${vis.minThreshold}`);

    // Position the thumb at the minimum value (start of the track)
    vis.sliderThumb.attr("cx", vis.sliderTrack.attr("x")).attr("cy", 12);

    // Add drag behavior to the thumb
    const drag = d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);

    vis.sliderThumb.call(drag);

    // Drag functions
    function dragstarted(event) {
      d3.select(this).raise().classed("active", true);
    }

    function dragged(event) {
      const trackX = +vis.sliderTrack.attr("x");
      const trackWidth = +vis.sliderTrack.attr("width");

      // Constrain the thumb to the track
      let newX = Math.max(trackX, Math.min(trackX + trackWidth, event.x));

      // Update the thumb position
      d3.select(this).attr("cx", newX);

      // Calculate the new threshold value
      const percent = (newX - trackX) / trackWidth;
      vis.threshold = Math.round(
        vis.minThreshold + percent * (vis.maxThreshold - vis.minThreshold)
      );

      // Update the value display
      vis.valueDisplay.text(`${vis.threshold}`);

      // Update the visualization
      vis.updateVis();
      
      // Dispatch an event to update other views
      vis.dispatcher.call("updatePeakCCUThreshold", null, vis.threshold);
    }

    function dragended(event) {
      d3.select(this).classed("active", false);
    }
  }

  updateVis() {
    let vis = this;

    // Check if data is available
    if (!vis.data || vis.data.length === 0) {
      console.log("PublisherBubbleView: No data available");
      return;
    }

    // Store previous color scale domain for comparison
    const prevMinRate = vis.MIN_REVIEW_RATE;
    const prevMaxRate = vis.MAX_REVIEW_RATE;

    // Create a separate collection for indie games
    let indieGames = vis.data.filter((d) => d.class === "Indie");
    console.log(`Found ${indieGames.length} indie games`);

    // Create publisher aggregation excluding indie games if needed
    let publisherMap = new Map();
    let indiePeakCCU = 0;
    let indieReviewRatio = 0;
    let indieGameCount = 0;

    // Process each game
    vis.data.forEach((d) => {
      const isIndie = d.class === "Indie";

      // If it's an indie game and we're showing indie as a separate bubble
      if (isIndie && vis.showIndieBubble) {
        indiePeakCCU += +d["Peak CCU"] || 0;
        indieReviewRatio += +d["Review Ratio"] || 0;
        indieGameCount++;
        return; // Skip adding to publisher map
      }

      // Skip indie games when showIndieBubble is false
      if (isIndie && !vis.showIndieBubble) {
        return; // Skip this game entirely
      }

      // Handle games with multiple publishers
      const publishers = d.Publishers
        ? d.Publishers.split(",").map((p) => p.trim())
        : ["Unknown"];
      const peakCCU = +d["Peak CCU"] || 0;
      const reviewRatio = +d["Review Ratio"] || 0;

      // For each publisher of this game
      publishers.forEach((publisher) => {
        // Calculate the share of peak CCU and review ratio for this publisher
        const publisherShare = 1 / publishers.length;
        const publisherPeakCCU = peakCCU * publisherShare;
        const publisherReviewRatio = reviewRatio * publisherShare;

        // If publisher already exists in the map, update its values
        if (publisherMap.has(publisher)) {
          const existingData = publisherMap.get(publisher);
          existingData.totalPeakCCU += publisherPeakCCU;
          existingData.totalReviewRatio += publisherReviewRatio;
          existingData.gameCount += publisherShare;
        } else {
          // Otherwise, add a new entry
          publisherMap.set(publisher, {
            publisher: publisher,
            totalPeakCCU: publisherPeakCCU,
            totalReviewRatio: publisherReviewRatio,
            gameCount: publisherShare,
            isIndie: false,
          });
        }
      });
    });

    // Convert map to array and calculate averages
    vis.publisherData = Array.from(publisherMap.values()).map((d) => ({
      publisher: d.publisher,
      totalPeakCCU: d.totalPeakCCU,
      averageReviewRatio: d.totalReviewRatio / d.gameCount,
      gameCount: Math.floor(d.gameCount),
      isIndie: d.isIndie,
    }));

    // Add indie games as a single entry if we have indie games and should show them
    if (indieGameCount > 0 && vis.showIndieBubble) {
      vis.publisherData.push({
        publisher: "Indie Games",
        totalPeakCCU: indiePeakCCU,
        averageReviewRatio: indieReviewRatio / indieGameCount,
        gameCount: indieGameCount,
        isIndie: true,
      });
    }

    // Filter publishers based on threshold
    vis.filteredPublishers = vis.publisherData
      .filter((d) => d.totalPeakCCU >= vis.threshold || d.isIndie)
      .sort((a, b) => b.totalPeakCCU - a.totalPeakCCU);

    console.log(
      `PublisherBubbleView: Showing ${vis.filteredPublishers.length} publishers with total peak CCU >= ${vis.threshold}`
    );

    // Use the fixed MIN_REVIEW_RATE and MAX_REVIEW_RATE values
    const minReviewRate = vis.MIN_REVIEW_RATE;
    const maxReviewRate = vis.MAX_REVIEW_RATE;
    const midReviewRate = vis.MID_REVIEW_RATE;

    // Update the color scale to use the fixed range
    vis.colorScale = d3
      .scaleDiverging()
      .domain([minReviewRate, midReviewRate, maxReviewRate])
      .interpolator(d3.interpolateRgbBasis(["red", "white", "green"]));

    // Update the legend scale to match the fixed range
    vis.legendScale = d3
      .scaleLinear()
      .domain([minReviewRate * 100, maxReviewRate * 100])
      .range([0, vis.legendWidth]);

    // Update the legend axis
    vis.legendAxis = d3
      .axisBottom(vis.legendScale)
      .tickSize(vis.legendHeight)
      .ticks(5)
      .tickFormat((d) => `${d.toFixed(1)}%`);

    // Update the legend title to show the fixed range
    vis.svg
      .select(".legend-title")
      .text(
        `Average Positive Review Rate (${(vis.MIN_REVIEW_RATE * 100).toFixed(
          1
        )}% - ${(vis.MAX_REVIEW_RATE * 100).toFixed(1)}%)`
      );

    // Update the gradient stops
    vis.linearGradient.selectAll("stop").remove();
    vis.linearGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", vis.colorScale(minReviewRate));

    vis.linearGradient
      .append("stop")
      .attr("offset", "50%")
      .attr("stop-color", vis.colorScale((minReviewRate + maxReviewRate) / 2));

    vis.linearGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", vis.colorScale(maxReviewRate));

    // Update the legend axis
    vis.legend.select("g").call(vis.legendAxis);

    // Check if color scale domain has changed
    vis.colorScaleChanged =
      prevMinRate !== vis.MIN_REVIEW_RATE ||
      prevMaxRate !== vis.MAX_REVIEW_RATE;

    // Process the data to calculate appropriate bubble sizes
    const maxPeakCCU =
      d3.max(vis.filteredPublishers, (d) => d.totalPeakCCU) || 1;
    const minBubbleRadius = 20;
    const maxBubbleRadius = 60;

    // Use square root scale for more reasonable bubble sizes
    vis.radiusScale = d3
      .scaleSqrt()
      .domain([0, maxPeakCCU])
      .range([minBubbleRadius, maxBubbleRadius]);

    // Create nodes data for the force simulation
    vis.nodes = vis.filteredPublishers.map((d) => ({
      publisher: d.publisher,
      peak: Math.round(d.totalPeakCCU),
      positiveReviewRate: d.averageReviewRatio,
      gameCount: d.gameCount,
      isIndie: d.isIndie,
      radius: vis.radiusScale(d.totalPeakCCU),
      x: Math.random() * vis.width,
      y: Math.random() * vis.height,
    }));

    // Create force simulation with optimized parameters
    if (vis.simulation) vis.simulation.stop();

    // Optimize force simulation parameters based on the number of nodes
    const nodeCount = vis.nodes.length;
    const chargeStrength = nodeCount > 20 ? 3 : 6; // Reduced charge strength for slower movement
    const centerStrength = nodeCount > 20 ? 0.05 : 0.03; // Reduced center strength for slower movement
    const alphaDecay = nodeCount > 20 ? 0.01 : 0.005; // Much slower decay for longer animation
    const velocityDecay = nodeCount > 20 ? 0.6 : 0.5; // More damping for slower movement

    vis.simulation = d3
      .forceSimulation(vis.nodes)
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("center", d3.forceCenter(vis.width / 2, vis.height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d) => d.radius + 2)
      )
      .force(
        "x",
        d3
          .forceX(function (d) {
            // Position based on review rating: higher ratings to the right
            // Place indie games in the middle (position 3 of 5)
            if (d.isIndie) {
              return vis.width * 0.5; // Middle for indie games
            }
            // Divide non-indie publishers into 5 regions based on review rating
            else if (
              d.positiveReviewRate >
              vis.MAX_REVIEW_RATE - vis.REVIEW_RATE_DIFF / 5
            ) {
              return vis.width * 0.9; // Far right (position 5) for highest-rated publishers
            } else if (
              d.positiveReviewRate >
              vis.MAX_REVIEW_RATE - (vis.REVIEW_RATE_DIFF * 2) / 5
            ) {
              return vis.width * 0.7; // Right-center (position 4) for high-rated publishers
            } else if (
              d.positiveReviewRate <
              vis.MIN_REVIEW_RATE + vis.REVIEW_RATE_DIFF / 5
            ) {
              return vis.width * 0.1; // Far left (position 1) for lowest-rated publishers
            } else if (
              d.positiveReviewRate <
              vis.MIN_REVIEW_RATE + (vis.REVIEW_RATE_DIFF * 2) / 5
            ) {
              return vis.width * 0.3; // Left-center (position 2) for low-rated publishers
            } else {
              return vis.width * 0.5; // Middle (position 3) for average-rated publishers
            }
          })
          .strength(centerStrength * 2)
      )
      .force("y", d3.forceY(vis.height / 2).strength(centerStrength))
      .alphaDecay(alphaDecay)
      .velocityDecay(velocityDecay)
      .on("tick", () => {
        // Use requestAnimationFrame to batch DOM updates
        if (!vis.tickRequested) {
          vis.tickRequested = true;
          requestAnimationFrame(() => {
            vis.chart
              .selectAll(".bubble")
              .attr("cx", (d) =>
                Math.max(d.radius, Math.min(vis.width - d.radius, d.x))
              )
              .attr("cy", (d) =>
                Math.max(d.radius, Math.min(vis.height - d.radius, d.y))
              );

            vis.chart
              .selectAll(".publisher-label")
              .attr("x", (d) =>
                Math.max(d.radius, Math.min(vis.width - d.radius, d.x))
              )
              .attr("y", (d) =>
                Math.max(d.radius, Math.min(vis.height - d.radius, d.y))
              );

            vis.tickRequested = false;
          });
        }
      });

    // Stop the simulation after a certain number of ticks to save resources
    vis.simulation.on("end", () => {
      console.log("Force simulation ended");
    });

    // Set a timeout to stop the simulation after a reasonable time
    setTimeout(() => {
      if (vis.simulation) {
        vis.simulation.alphaTarget(0);
        vis.simulation.stop();
      }
    }, 8000); // Stop after 8 seconds

    vis.renderVis();
  }

  renderVis() {
    let vis = this;

    // Force redraw of all bubbles if color scale changed
    if (vis.colorScaleChanged) {
      vis.chart.selectAll(".bubble").remove();
      vis.chart.selectAll(".publisher-label").remove();
      vis.colorScaleChanged = false;
    }

    // Bind nodes data to circles
    let bubbles = vis.chart
      .selectAll(".bubble")
      .data(vis.nodes, (d) => d.publisher);

    bubbles.exit().remove();

    let bubblesEnter = bubbles
      .enter()
      .append("circle")
      .attr(
        "class",
        (d) =>
          `bubble publisher-${d.publisher.replace(/[\s,.&]/g, "_")}${
            d.isIndie ? " indie-bubble" : ""
          }`
      )
      .attr("r", (d) => d.radius)
      .attr("fill", (d) =>
        d.isIndie ? vis.indieColor : vis.colorScale(d.positiveReviewRate)
      )
      .attr("stroke", (d) => (d.isIndie ? "#663399" : "#000")) // Different stroke for indie
      .attr("stroke-width", (d) =>
        d.publisher === vis.selectedPublisher ? 3 : 1
      )
      .attr("stroke-opacity", (d) =>
        d.publisher === vis.selectedPublisher ? 1 : 0.3
      )
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
            <div style="font-weight: bold; font-size: 14px;">${
              d.publisher
            }</div>
            <div><strong>Games:</strong> ${d.gameCount}</div>
            <div><strong>Avg Peak Players:</strong> ${d3.format(",")(
              Math.round(d.peak)
            )}</div>
            <div><strong>Avg Review Rating:</strong> ${(
              d.positiveReviewRate * 100
            ).toFixed(1)}%</div>
            ${
              d.isIndie
                ? '<div style="color: #8a2be2; font-weight: bold;">Indie Games</div>'
                : ""
            }
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
            d.publisher === vis.selectedPublisher ? 1 : 0.3
          );

        // Hide tooltip
        d3.select("#tooltip").style("display", "none").style("opacity", 0);
      })
      .on("click", function (event, d) {
        // Toggle selection
        if (d.publisher === vis.selectedPublisher) {
          // Deselect if already selected
          vis.selectedPublisher = null;
          d3.select(this).attr("stroke-width", 1).attr("stroke-opacity", 0.3);

          // Dispatch deselect event
          vis.dispatcher.call("selectPublisher", null, null);
          console.log("Deselected publisher:", d.publisher);
        } else {
          // Select new publisher
          vis.selectedPublisher = d.publisher;

          // Update visual selection
          vis.chart
            .selectAll(".bubble")
            .attr("stroke-width", (p) =>
              p.publisher === vis.selectedPublisher ? 3 : 1
            )
            .attr("stroke-opacity", (p) =>
              p.publisher === vis.selectedPublisher ? 1 : 0.3
            );

          // Dispatch select event - if it's indie, send a special value
          if (d.isIndie) {
            vis.dispatcher.call("selectPublisher", null, "Indie");
          } else {
            vis.dispatcher.call("selectPublisher", null, d.publisher);
          }
          console.log("Selected publisher:", d.publisher);
        }
      });

    // Add labels for large bubbles
    const labelThreshold = 35; // Only show labels for bubbles larger than this radius

    let labels = vis.chart.selectAll(".publisher-label").data(
      vis.nodes.filter((d) => d.radius > labelThreshold),
      (d) => d.publisher
    );

    labels.exit().remove();

    labels
      .enter()
      .append("text")
      .attr("class", "publisher-label")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "12px")
      .attr("fill", (d) => (d.isIndie ? "white" : "white"))
      .attr("font-weight", (d) => (d.isIndie ? "bold" : "normal"))
      .attr("pointer-events", "none") // Don't interfere with bubble interactions
      .text((d) => d.publisher);
  }

  // Method to highlight a publisher based on a game ID
  highlightPublisher(gameId) {
    let vis = this;

    // Find the game
    const game = vis.data.find((d) => d.AppID === gameId);

    if (game) {
      // If it's an indie game and we're showing the indie bubble
      if (game.class === "Indie" && vis.showIndieBubble) {
        vis.selectedPublisher = "Indie Games";
      } else if (game.Publishers) {
        vis.selectedPublisher = game.Publishers;
      }

      // Update visual highlighting
      vis.chart
        .selectAll(".bubble")
        .attr("stroke-width", (d) =>
          d.publisher === vis.selectedPublisher ? 3 : 1
        )
        .attr("stroke-opacity", (d) =>
          d.publisher === vis.selectedPublisher ? 1 : 0.3
        );
    }
  }
}
