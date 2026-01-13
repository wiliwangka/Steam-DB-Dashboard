class ScatterPlotView {
  constructor(_config, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 600,
      containerHeight: _config.containerHeight || 400,
      margin: _config.margin || { top: 40, right: 40, bottom: 40, left: 60 },
    };
    this.data = _data;
    this.dispatcher = _dispatcher;
    this.selectedGameId = null;
    this.selectPublisher = null;
    this.threshold = 0; // Add threshold property
    this.showIndie = true; // Default to showing indie games

    // add a listener so that when "selectPublisher" is dispatched, we can filter out our data
    this.dispatcher.on("selectPublisher.scatterPlot", this.filterByPublisher.bind(this));
    
    // Add a listener for peak CCU threshold changes
    this.dispatcher.on("updatePeakCCUThreshold.scatterPlot", (threshold) => {
      this.threshold = threshold;
      this.updateVis();
    });
    
    // Add a listener for indie visibility changes
    this.dispatcher.on("updateIndieVisibility.scatterPlot", (showIndie) => {
      this.showIndie = showIndie;
      this.updateVis();
    });
    
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

    // Initialize scatter plot chart SVG
    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

    // Append group element for the scatter plot
    if (!vis.chart) {
      vis.chart = vis.svg
        .append("g")
        .attr(
          "transform",
          `translate(${vis.config.margin.left},${vis.config.margin.top})`
        );
    }

    // Add title
    vis.svg
      .append("text")
      .attr("class", "chart-title")
      .attr("x", vis.config.containerWidth / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .text("Price vs. Revenue");

    // Initialize axes
    vis.xAxisG = vis.chart
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${vis.height})`);

    vis.yAxisG = vis.chart.append("g").attr("class", "axis y-axis");

    // Add axis labels
    vis.chart
      .append("text")
      .attr("class", "axis-label")
      .attr("x", vis.width / 2)
      .attr("y", vis.height + 35)
      .attr("text-anchor", "middle")
      .text("Game Price ($)");

    vis.chart
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -vis.height / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .text("Revenue");
  }

  updateVis() {
    let vis = this;
    let dataToUse;

    // Check if data is available, otherwise don't try to render
    if (!vis.data || vis.data.length === 0) {
      console.log("ScatterPlotView: No data available");
      return;
    }

    // Filter data by publisher if one is selected
    if (vis.selectPublisher) {
      if (vis.selectPublisher === "Indie") {
        // Special case for Indie games
        dataToUse = vis.data.filter(d => d.class === "Indie");
        console.log(`ScatterPlotView: Filtered to ${dataToUse.length} indie games`);
      } else {
        // Regular case for other publishers
        dataToUse = vis.data.filter(d => d.Publishers === vis.selectPublisher);
        console.log(`ScatterPlotView: Filtered to ${dataToUse.length} games from publisher ${vis.selectPublisher}`);
      }
    } else {
      dataToUse = vis.data;
      console.log(`ScatterPlotView: Using all ${dataToUse.length} games`);
    }

    // Map data to access the values we need for the scatter plot
    vis.processedData = dataToUse.map(d => ({
      id: d.AppID,
      name: d.Name,
      price: +d.Price, // Convert to number
      revenue: +d.revenue || 0, // Use revenue field, default to 0 if not present
      publisher: d.Publishers,
      releaseDate: d.ReleaseDate, // Already converted to Date in main.js
      peakCCU: +d["Peak CCU"] || 0,
      positive: +d.Positive || 0,
      negative: +d.Negative || 0,
      reviewRatio: +d["Review Ratio"] || 0,
      isIndie: d.class === "Indie"
    }));

    // Filter to games with peak CCU above the threshold
    if (vis.threshold > 0) {
      vis.processedData = vis.processedData.filter(d => d.peakCCU >= vis.threshold);
      console.log(`ScatterPlotView: Filtered to ${vis.processedData.length} games with peak CCU >= ${vis.threshold}`);
    }
    
    // Filter indie games if needed
    if (!vis.showIndie) {
      vis.processedData = vis.processedData.filter(d => !d.isIndie);
      console.log(`ScatterPlotView: Filtered to ${vis.processedData.length} non-indie games`);
    }

    // Set up x and y value accessors
    vis.xValue = d => d.price;
    vis.yValue = d => Math.max(0, d.revenue); // Ensure revenue is never negative

    // Apply log scale for revenue as it likely has a wide range of values
    vis.yValueScaled = d => d.revenue > 0 ? Math.log10(d.revenue) : 0;

    // Update axis scales
    // Limit x-axis to 0-100 range as requested
    vis.xScale = d3.scaleLinear()
      .domain([0, 80]) // Fixed domain from 0 to 100
      .range([0, vis.width]);

    // Use a log scale for revenue
    const maxRevenue = d3.max(vis.processedData, d => d.revenue) || 1;
    vis.yScale = d3.scaleLog()
      .domain([Math.max(1, d3.min(vis.processedData, d => d.revenue) || 1), maxRevenue * 1.1]) // Start at 1 for log scale
      .range([vis.height, 0])
      .nice();

    // Update axes
    vis.xAxis = d3.axisBottom(vis.xScale)
      .ticks(5)
      .tickFormat(d => `$${d}`);

    vis.yAxis = d3.axisLeft(vis.yScale)
      .ticks(5, "~s"); // ~5 major ticks with SI formatting

    vis.yAxis.tickSizeInner(0);

    vis.xAxisG.call(vis.xAxis);
    vis.yAxisG.call(vis.yAxis);

    vis.renderVis();
  }

  renderVis() {
    let vis = this;

    // Filter out any data points with invalid values
    const validData = vis.processedData.filter(d => 
      !isNaN(d.price) && 
      !isNaN(d.revenue) && 
      d.revenue > 0 && // Filter out zero revenue for log scale
      d.price >= 0
    );

    // Count how many games are displayed and how many are off-scale
    const overPriceLimit = validData.filter(d => d.price > 100).length;
    const displayedGames = validData.length;
    
    if (overPriceLimit > 0) {
      console.log(`ScatterPlotView: ${overPriceLimit} of ${displayedGames} games have prices over $100 (${(overPriceLimit/displayedGames*100).toFixed(1)}%)`);
    }

    // Add jittering to the data points
    // We'll add a small random offset to both x and y coordinates
    // The jitter amount should be small enough not to distort the data
    const jitterAmount = 0.5; // Adjust this value to control jitter intensity
    
    // Render circles for each data point
    vis.circles = vis.chart
      .selectAll(".scatter-circle")
      .data(validData, d => d.id) // Use game ID as key
      .join("circle")
      .attr("class", d => `scatter-circle game-${d.id}`)
      .attr("cx", d => {
        // Add jitter to x position
        const baseX = vis.xScale(Math.min(d.price, 100));
        const jitterX = (Math.random() - 0.5) * jitterAmount;
        return baseX + jitterX;
      })
      .attr("cy", d => {
        // Add jitter to y position
        const baseY = vis.yScale(d.revenue);
        const jitterY = (Math.random() - 0.5) * jitterAmount;
        return baseY + jitterY;
      })
      .attr("r", 5)
      .attr("fill", d => {
        // Use a different color for games over $100 to indicate they're at the limit
        if (d.price > 100) return "#f28e2b"; 
        return vis.selectedGameId === d.id ? "#E63946" : "#65C0F4";
      })
      // Apply partial transparency to all points
      .attr("opacity", d => vis.selectedGameId === d.id ? 1 : 0.3) // Reduced opacity for non-selected points
      .attr("stroke", d => vis.selectedGameId === d.id ? "#000" : "none")
      .attr("stroke-width", d => vis.selectedGameId === d.id ? 2 : 0)
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("r", 8)
          .attr("opacity", 1);
        vis.showToolTipScatter(event, d);
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("r", d => vis.selectedGameId === d.id ? 7 : 5)
          .attr("opacity", d => vis.selectedGameId === d.id ? 1 : 0.4);
        vis.hideTooltipScatter();
      })
      .on("click", function(event, d) {
        // Dispatch game selection event
        vis.dispatcher.call("selectGame", null, d.id);
      });

    // Add a legend for the price cap indicator
    vis.chart.selectAll(".price-cap-legend").remove(); // Remove existing legend first
    
    if (overPriceLimit > 0) {
      // Add legend for games over $100
      vis.chart.append("circle")
        .attr("class", "price-cap-legend")
        .attr("cx", vis.width - 120)
        .attr("cy", 20)
        .attr("r", 5)
        .attr("fill", "#f28e2b");
        
      vis.chart.append("text")
        .attr("class", "price-cap-legend")
        .attr("x", vis.width - 110)
        .attr("y", 24)
        .text(`Games over $100 (${overPriceLimit})`)
        .attr("font-size", "12px");
    }

   

    console.log(`ScatterPlotView: Rendered ${validData.length} data points with jittering and transparency`);
  }

  showToolTipScatter(event, d) {
    let vis = this;

    d3.select("#tooltip")
        .style("display", "block")
        .style("position", "absolute")
        .style("opacity", 1)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px")
        .html(`
          <strong>${d.name}</strong><br/>
          Price: $${d.price.toFixed(2)}<br/>
          Revenue: $${d3.format(",")(Math.round(d.revenue))}<br/>
          Publisher: ${d.publisher}<br/>
          Release Date: ${d.releaseDate.toLocaleDateString()}<br/>
          Peak Players: ${d3.format(",")(d.peakCCU)}<br/>
          Positive Reviews: ${d.positive}
        `);
  }

  hideTooltipScatter() {
      d3.select("#tooltip")
         .style("opacity", 0)
         .style("display", "none");
  }

  filterByPublisher(publisherName) {
    let vis = this;
    vis.selectPublisher = publisherName;
    vis.updateVis();
  }

  highlightGame(gameId) {
    let vis = this;
    vis.selectedGameId = gameId;
    vis.updateVis();
  }
}
