class TimeLineViewTop {
    oldrange = "all"
    updates = true;
    isApplyingDefaultBrush = false; // Track if we're currently applying a default brush
    isWalkthroughActive = false; // Track if walkthrough animation is active
    startYear = 2006; // Default start year for graph display
    walkthroughInterval = null; // Store the interval ID for the walkthrough

    constructor(_config, _data, _dispatcher) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 1000,
            containerHeight: _config.containerHeight || 100,
            margin: {
                top: 20,
                right: 20,
                bottom: 60,
                left: 60
            },
        }
        this.data = _data || [];
        this.dispatcher = _dispatcher;
        
        // Set the start year if provided in config
        if (_config.startYear) {
            this.startYear = _config.startYear;
        }
        
        this.initVis();
    }

    initVis() {
        let vis = this;

        vis.config.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.config.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Initialize scales
        vis.xScaleContext = d3.scaleTime()
            .range([0, vis.config.width]);

        vis.yScaleContext = d3.scaleLinear()
            .range([vis.config.height, 0])
            .nice();

        // Initialize axes
        vis.xAxisContext = d3.axisBottom(vis.xScaleContext)
            .tickSizeOuter(0)
            .tickPadding(10)
            .ticks(d3.timeYear.every(1));
            
        // Add y-axis
        vis.yAxisContext = d3.axisLeft(vis.yScaleContext)
            .tickSizeOuter(0)
            .tickPadding(10)
            .ticks(4);

        // Define size of SVG drawing area
        vis.svg = d3
            .select(vis.config.parentElement).append("svg")
            .attr("width", vis.config.containerWidth)
            .attr("height", vis.config.containerHeight);

        // Create gradient for area chart
        vis.grad = vis.svg.append("defs").append("linearGradient")
            .attr('id', 'header-shape-gradient')
            .attr('gradientTransform', 'rotate(90)');
            
        vis.grad.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#384982');
        
        vis.grad.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#384982');

        // Add a title to the timeline
        vis.svg.append("text")
            .attr("class", "timeline-title")
            .attr("x", vis.config.margin.left)
            .attr("y", 15)
            .attr("font-size", "12px")
            .attr("font-weight", "500")
            .text("Filter by release date:");

        // Append context group with x- and y-axes
        vis.context = vis.svg
            .append("g")
            .attr(
                "transform",
                `translate(${vis.config.margin.left},${vis.config.margin.top})`
            );

        vis.contextAreaPath = vis.context
            .append("path")
            .attr("class", "chart-area")
            .attr("fill", "url(#header-shape-gradient)")
            .attr("stroke", "#384982")
            .attr("stroke-width", 1.5);

        vis.xAxisContextG = vis.context
            .append("g")
            .attr("class", "axis x-axis")
            .attr("transform", `translate(0,${vis.config.height})`);
            
        // Add y-axis group
        vis.yAxisContextG = vis.context
            .append("g")
            .attr("class", "axis y-axis");
            
        // Add axis labels
        vis.context.append("text")
            .attr("class", "axis-label")
            .attr("x", vis.config.width / 2)
            .attr("y", vis.config.height + 45)
            .attr("text-anchor", "middle")
            .attr("font-size", "15px")
            .text("Release Date");
            
        vis.context.append("text")
            .attr("class", "axis-label")
            .attr("x", -35)
            .attr("y", vis.config.height / 2)
            .attr("transform", `rotate(-90, -35, ${vis.config.height / 2})`)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .text("Number of Games");

        // Create brush group
        vis.brushG = vis.context.append("g").attr("class", "brush x-brush");

        // Initialize brush
        vis.brush = d3
            .brushX()
            .extent([
                [0, 0],
                [vis.config.width, vis.config.height]
            ])
            // Handle brush events properly
            .on("start brush", function(event) {
                // Skip if we're in the middle of applying a default brush or updates are paused
                if (vis.isApplyingDefaultBrush || !vis.updates) return;
                
                // Only process if the event has a selection
                if (event.selection) {
                    // Convert pixel values to dates
                    const dateRange = event.selection.map(d => vis.xScaleContext.invert(d));
                    // Save that we now have a custom range
                    vis.oldrange = "some";
                    // Dispatch the filtered range
                    vis.dispatcher.call('filterTime', null, dateRange);
                }
            })
            .on("end", function(event) {
                // Skip if we're in the middle of applying a default brush or updates are paused
                if (vis.isApplyingDefaultBrush || !vis.updates) return;
                
                if (event.selection) {
                    // If we have a selection at the end of brushing, use that
                    const dateRange = event.selection.map(d => vis.xScaleContext.invert(d));
                    vis.oldrange = "some";
                    vis.dispatcher.call('filterTime', null, dateRange);
                } else if (event.sourceEvent) {
                    console.log("Brush cleared by user");
                    // This is a user-initiated brush clear (clicking outside)
                    // Reset to full time range
                    const fullRange = d3.extent(vis.groupedData, vis.xValue);
                    vis.oldrange = "all";
                    vis.dispatcher.call('filterTime', null, fullRange);
                    
                    // Re-apply default brush after a short delay
                    setTimeout(() => {
                        if (vis.updates && !vis.isApplyingDefaultBrush) {
                            vis.applyDefaultBrush();
                        }
                    }, 100);
                }
            });
            
        // Apply the brush to the group
        vis.brushG.call(vis.brush);
        
        // Style the brush to make it more rounded
        vis.brushG.selectAll(".selection")
            .attr("rx", 8)  // Horizontal corner radius
            .attr("ry", 8); // Vertical corner radius
            
        // Also style the brush handles for consistency
        vis.brushG.selectAll(".handle")
            .attr("rx", 4)
            .attr("ry", 4);

        // Add walkthrough button
        vis.walkthroughButton = vis.svg.append("g")
            .attr("class", "walkthrough-button")
            .attr("transform", `translate(${vis.config.containerWidth - 120}, ${vis.config.containerHeight - 30})`)

            .style("cursor", "pointer")
            .on("click", () => vis.toggleWalkthrough());
            
        vis.walkthroughButton.append("rect")
            .attr("width", 100)
            .attr("height", 25)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("fill", "#74AF21")
            .attr("stroke", "#2a3659")
            .attr("stroke-width", 1);
            
        vis.walkthroughButton.append("text")
            .attr("x", 50)
            .attr("y", 17)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("font-size", "14px")
             .attr("font-weight", "900") // Make the text thicker
            .text("Walkthrough");

        // Initialize with empty data
        vis.updateVis();
    }

    // Toggle walkthrough animation
    toggleWalkthrough() {
        let vis = this;
        
        if (vis.isWalkthroughActive) {
            // Stop the walkthrough
            vis.stopWalkthrough();
            vis.walkthroughButton.select("text").text("Walkthrough");
        } else {
            // Start the walkthrough
            vis.startWalkthrough();
            vis.walkthroughButton.select("text").text("Stop");
        }
    }
    
    // Start the walkthrough animation
    startWalkthrough() {
        let vis = this;
        
        if (vis.isWalkthroughActive) return;
        
        vis.isWalkthroughActive = true;
        
        // Get the full time range
        const timeExtent = vis.xScaleContext.domain();
        const startYear = vis.startYear;
        const endYear = 2026;
        
        // Create initial window dates
        let windowStartDate = new Date(vis.startYear, 0, 1);
        
        // If start date is before the domain, use the domain start
        if (windowStartDate < timeExtent[0]) {
            windowStartDate = new Date(timeExtent[0]);
        }
        
        // Set initial end date to be 1 year from start date
        let windowEndDate = new Date(windowStartDate);
        windowEndDate.setFullYear(windowEndDate.getFullYear() + 1);
        
        // Convert dates to pixel positions
        const initialBrushSelection = [
            vis.xScaleContext(windowStartDate),
            vis.xScaleContext(windowEndDate)
        ];
        
        // Apply initial brush
        vis.pauseUpdates();
        vis.brushG.call(vis.brush.move, initialBrushSelection);
        
        // Apply rounded corners
        vis.brushG.selectAll(".selection")
            .attr("rx", 8)
            .attr("ry", 8);
            
        vis.brushG.selectAll(".handle")
            .attr("rx", 4)
            .attr("ry", 4);
        
        // Dispatch the initial time filter
        const initialDateRange = initialBrushSelection.map(d => vis.xScaleContext.invert(d));
        vis.oldrange = "some";
        vis.dispatcher.call('filterTime', null, initialDateRange);
        
        // Start the walkthrough animation interval
        vis.walkthroughInterval = setInterval(() => {
            // Advance both start and end dates by 7 days
            windowStartDate = new Date(windowStartDate);
            windowStartDate.setDate(windowStartDate.getDate() + 7);
            
            windowEndDate = new Date(windowStartDate);
            windowEndDate.setFullYear(windowEndDate.getFullYear() + 1);
            
            // Check if we've reached the end
            if (windowEndDate > timeExtent[1]) {
                vis.stopWalkthrough();
                return;
            }
            
            // Update the brush selection
            const newBrushSelection = [
                vis.xScaleContext(windowStartDate),
                vis.xScaleContext(windowEndDate)
            ];
            
            // Apply the new brush position
            vis.pauseUpdates();
            vis.brushG.call(vis.brush.move, newBrushSelection);
            
            // Apply rounded corners to maintain style
            vis.brushG.selectAll(".selection")
                .attr("rx", 8)
                .attr("ry", 8);
                
            vis.brushG.selectAll(".handle")
                .attr("rx", 4)
                .attr("ry", 4);
            
            // Dispatch the time filter
            const dateRange = newBrushSelection.map(d => vis.xScaleContext.invert(d));
            vis.oldrange = "some";
            vis.dispatcher.call('filterTime', null, dateRange);
            
            vis.resumeUpdates();
        }, 1000/360); // Update at 1/360 second intervals
        
        vis.resumeUpdates();
    }
    
    // Stop the walkthrough animation
    stopWalkthrough() {
        let vis = this;
        
        if (!vis.isWalkthroughActive) return;
        
        vis.isWalkthroughActive = false;
        
        // Clear the interval
        if (vis.walkthroughInterval) {
            clearInterval(vis.walkthroughInterval);
            vis.walkthroughInterval = null;
        }
        
        // Reset the button text
        vis.walkthroughButton.select("text").text("Walkthrough");
    }

    updateVis() {
        let vis = this;

        // Skip if updates are paused
        if (!vis.updates) {
            console.log("TimeLineViewTop: Updates paused");
            return;
        }

        console.log("TimeLineViewTop: Updating visualization");
        
        // Use preprocessed data instead of on-the-fly aggregation
        if (window.precomputedData) {
            // Determine which granularity to use based on time range
            if (timeRange && timeRange.length === 2) {
                const rangeDuration = (timeRange[1] - timeRange[0]) / (1000 * 60 * 60 * 24);
                
                if (rangeDuration > 730) { // > 2 years
                    vis.groupedData = window.precomputedData.yearly.map(d => [d.date.getTime(), d.count]);
                    console.log("Using yearly aggregation for large range");
                } else if (rangeDuration > 60) { // > 2 months
                    vis.groupedData = window.precomputedData.monthly;
                    console.log("Using monthly aggregation for medium range");
                } else {
                    vis.groupedData = window.precomputedData.daily;
                    console.log("Using daily aggregation for small range");
                }
                
                // Filter by the selected time range
                vis.groupedData = vis.groupedData.filter(d => {
                    const date = new Date(d[0]);
                    return date >= timeRange[0] && date <= timeRange[1];
                });
            } else {
                // Default to monthly for the full view
                vis.groupedData = window.precomputedData.monthly;
                console.log("Using monthly aggregation for full view");
            }
        } else {
            // Fallback to original computation if precomputed data isn't available
            console.log("Precomputed data not available, using original computation");
            
            if (!vis.data || vis.data.length === 0) {
                console.log("TimeLineViewTop: No data available");
                return;
            }
            
            // Group data by month and count games
            vis.groupedData = d3.rollups(
                vis.data, 
                v => v.length, 
                d => d.ReleaseDate.getTime()
            );

            // Sort by date
            vis.groupedData = vis.groupedData.sort((a, b) => a[0] - b[0]);
        }

        // Make sure we have data
        if (!vis.groupedData || vis.groupedData.length === 0) {
            console.error("No grouped data available");
            return;
        }

        console.log("TimeLineViewTop: Grouped data points:", vis.groupedData.length);

        // Set x and y value accessors
        vis.xValue = d => new Date(d[0]);
        vis.yValue = d => d[1];

        // Filter to only show data from the specified start year
        const minDate = new Date(vis.startYear || 2005, 0, 1);
        vis.groupedData = vis.groupedData.filter(d => vis.xValue(d) >= minDate);

        // Update scales with custom domain
        const timeExtent = d3.extent(vis.groupedData, vis.xValue);
        vis.xScaleContext.domain(timeExtent);
        vis.yScaleContext.domain([0, d3.max(vis.groupedData, vis.yValue)]);

        // Create area generator
        vis.area = d3.area()
            .x(d => vis.xScaleContext(vis.xValue(d)))
            .y1(d => vis.yScaleContext(vis.yValue(d)))
            .y0(vis.config.height)
            .curve(d3.curveMonotoneX);

        // Update area path
        vis.contextAreaPath
            .datum(vis.groupedData)
            .transition().duration(500)
            .attr("d", vis.area);

        vis.renderVis();
    }

    renderVis() {
        let vis = this;
        
        // Temporarily pause updates while rendering
        vis.pauseUpdates();

        // Update x-axis
        vis.xAxisContextG.call(vis.xAxisContext);
        
        // Update y-axis
        vis.yAxisContextG.call(vis.yAxisContext);

        // Update the brush element (don't move it if already set)
        vis.brushG.call(vis.brush);
        
        // Re-apply rounded corners to the brush
        vis.brushG.selectAll(".selection")
            .attr("rx", 8)
            .attr("ry", 8);
            
        vis.brushG.selectAll(".handle")
            .attr("rx", 4)
            .attr("ry", 4);
        
        // If we don't have a custom selection, apply the default
        if (vis.oldrange === "all") {
            vis.applyDefaultBrush();
        }

        // Resume updates
        vis.resumeUpdates();
    }
    
    // Helper method to apply the default brush (most recent 1 year instead of 5)
    applyDefaultBrush() {
        let vis = this;
        
        // Prevent recursive calls
        if (vis.isApplyingDefaultBrush) return;
        vis.isApplyingDefaultBrush = true;
        
        // Only if we have data
        if (!vis.groupedData || vis.groupedData.length === 0) {
            vis.isApplyingDefaultBrush = false;
            return;
        }
        
        console.log("Applying default brush");
        
        // Set default brush selection (most recent 1 year instead of 5)
        const timeExtent = vis.xScaleContext.domain();
        const defaultEnd = new Date(timeExtent[1]);
        const defaultStart = new Date(defaultEnd);
        defaultStart.setFullYear(defaultStart.getFullYear() - 1); // Change from 5 years to 1 year
        
        const defaultBrushSelection = [
            Math.max(vis.xScaleContext(defaultStart), 0),
            vis.xScaleContext(defaultEnd)
        ];

        // Apply brush without triggering events
        vis.pauseUpdates();
        vis.brushG.call(vis.brush.move, defaultBrushSelection);
        
        // Apply rounded corners to the default brush
        vis.brushG.selectAll(".selection")
            .attr("rx", 8)
            .attr("ry", 8);
            
        vis.brushG.selectAll(".handle")
            .attr("rx", 4)
            .attr("ry", 4);
        
        // Manually dispatch the time filter event
        const dateRange = defaultBrushSelection.map(d => vis.xScaleContext.invert(d));
        setTimeout(() => {
            vis.resumeUpdates();
            vis.isApplyingDefaultBrush = false;
            vis.dispatcher.call('filterTime', null, dateRange);
        }, 50);
    }

    pauseUpdates() {
        this.updates = false;
    }

    resumeUpdates() {
        this.updates = true;
    }
} 