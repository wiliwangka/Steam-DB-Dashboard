class TimeLineViewDetail {
    constructor(_config, _data, _dispatcher) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 1000,
            containerHeight: _config.containerHeight || 400,
            margin: { top: 50, right: 50, bottom: 50, left: 50 },
        };
        this.data = _data;
        this.dispatcher = _dispatcher;
        this.timeRange = null; // Will be set via dispatcher
        this.initVis();
    }

    initVis() {
        let vis = this;

        // Calculate inner chart dimensions
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Create SVG container
        vis.svg = d3.select(vis.config.parentElement)
            .append('svg')
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        // Append group element for the time series
        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Add title
        vis.chart.append('text')
            .attr('class', 'chart-title')
            .attr('x', vis.width / 2)
            .attr('y', -15)
            .attr('text-anchor', 'middle')
            .text('Games Released Over Time');

        // Initialize scales and axes
        vis.xScale = d3.scaleTime()
            .range([0, vis.width]);

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        vis.xAxis = d3.axisBottom(vis.xScale)
            .ticks(6)
            .tickSizeOuter(0)
            .tickPadding(10);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(6)
            .tickSizeOuter(0)
            .tickPadding(10);

        // Append x-axis group
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`);

        // Append y-axis group
        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis');

        // Append axis labels
        vis.chart.append('text')
            .attr('class', 'axis-label')
            .attr('x', vis.width / 2)
            .attr('y', vis.height + 35)
            .attr('text-anchor', 'middle')
            .text('Release Date');

        vis.chart.append('text')
            .attr('class', 'axis-label')
            .attr('x', -35)
            .attr('y', vis.height / 2)
            .attr('transform', `rotate(-90, -35, ${vis.height / 2})`)
            .attr('text-anchor', 'middle')
            .text('Number of Games Released');

        // Initialize path for line chart
        vis.line = d3.line()
            .x(d => vis.xScale(d.date))
            .y(d => vis.yScale(d.count))
            .curve(d3.curveMonotoneX);

        vis.pathElement = vis.chart.append('path')
            .attr('class', 'line-path')
            .attr('fill', 'none')
            .attr('stroke', '#384982')
            .attr('stroke-width', 2);

        // Create a group for data points
        vis.pointsGroup = vis.chart.append('g')
            .attr('class', 'data-points');
            
        // Create a group for the vertical hover line
        vis.hoverGroup = vis.chart.append('g')
            .attr('class', 'hover-group')
            .style('display', 'none');
            
        vis.hoverLine = vis.hoverGroup.append('line')
            .attr('class', 'hover-line')
            .attr('y1', 0)
            .attr('y2', vis.height)
            .attr('stroke', '#999')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3');
            
        // Add rect for mouse tracking
        vis.mouseTrackingRect = vis.chart.append('rect')
            .attr('width', vis.width)
            .attr('height', vis.height)
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .on('mousemove', function(event) {
                vis.handleMouseMove(event);
            })
            .on('mouseout', function() {
                vis.hoverGroup.style('display', 'none');
                vis.hideTooltip();
            });

        // Initialize with empty data
        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        console.log("TimeLineViewDetail: Updating visualization with daily data");
        
        // Use preprocessed daily data instead of yearly data
        if (window.precomputedData && window.precomputedData.daily) {
            // Convert daily data to the format needed for the line chart
            vis.lineData = window.precomputedData.daily.map(d => ({
                date: new Date(d[0]),
                count: d[1]
            }));
            console.log("Using precomputed daily data:", vis.lineData.length, "points");
        } else {
            // Fallback to original computation if precomputed data isn't available
            console.log("Precomputed daily data not available, using original computation");
            
            // Check if we have valid data
            if (!vis.data || vis.data.length === 0) {
                console.log("TimeLineViewDetail: No data available");
                return;
            }
            
            // Check if ReleaseDate is properly parsed
            let hasValidDates = vis.data.some(d => d.ReleaseDate instanceof Date && !isNaN(d.ReleaseDate));
            if (!hasValidDates) {
                console.error("TimeLineViewDetail: No valid dates found in data");
                console.log("Sample data:", vis.data.slice(0, 3));
                return;
            }

            // Group data by day and count games
            const dayCounts = d3.rollup(
                vis.data, 
                v => v.length, 
                d => d3.timeDay.floor(d.ReleaseDate).getTime()
            );
            
            // Convert to array format for line chart
            vis.lineData = Array.from(dayCounts, ([day, count]) => ({
                date: new Date(day),
                count: count
            })).sort((a, b) => a.date - b.date);
            
            console.log("Computed daily data:", vis.lineData.length, "points");
        }

        // Make sure we have data
        if (!vis.lineData || vis.lineData.length === 0) {
            console.error("No line data available");
            return;
        }

        // Filter data by time range if specified
        if (vis.timeRange && vis.timeRange.length === 2) {
            // Ensure timeRange contains valid Date objects
            const validTimeRange = vis.timeRange.every(d => d instanceof Date && !isNaN(d));
            
            if (validTimeRange) {
                vis.filteredLineData = vis.lineData.filter(d => 
                    d.date >= vis.timeRange[0] && d.date <= vis.timeRange[1]
                );
                console.log("Filtered to", vis.filteredLineData.length, "points in selected time range:", 
                    vis.timeRange[0].toISOString().split('T')[0], "to", 
                    vis.timeRange[1].toISOString().split('T')[0]);
            } else {
                console.error("Invalid time range:", vis.timeRange);
                vis.filteredLineData = vis.lineData;
            }
        } else {
            vis.filteredLineData = vis.lineData;
        }

        // Downsample if there are too many points to display clearly
        if (vis.filteredLineData.length > vis.width / 2) {
            console.log("Downsampling from", vis.filteredLineData.length, "points");
            
            // Simple downsampling - take every Nth point
            const samplingRate = Math.ceil(vis.filteredLineData.length / (vis.width / 2));
            vis.displayData = vis.filteredLineData.filter((_, i) => i % samplingRate === 0);
            
            console.log("Downsampled to", vis.displayData.length, "points");
        } else {
            vis.displayData = vis.filteredLineData;
        }

        // Update scales domains
        if (vis.timeRange && vis.timeRange.length === 2 && vis.timeRange.every(d => d instanceof Date && !isNaN(d))) {
            vis.xScale.domain(vis.timeRange);
        } else {
            vis.xScale.domain(d3.extent(vis.lineData, d => d.date));
        }
        
        // Add some padding to y scale
        vis.yScale.domain([0, d3.max(vis.filteredLineData, d => d.count) * 1.1]);

        // Update x-axis ticks based on date range
        const dateRange = vis.xScale.domain();
        const timeDiff = dateRange[1] - dateRange[0];
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 365 * 2) {
            // For ranges over 2 years, show yearly ticks
            vis.xAxis.ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y"));
        } else if (daysDiff > 180) {
            // For ranges over 6 months, show quarterly ticks
            vis.xAxis.ticks(d3.timeMonth.every(3)).tickFormat(d3.timeFormat("%b %Y"));
        } else if (daysDiff > 60) {
            // For ranges over 2 months, show monthly ticks
            vis.xAxis.ticks(d3.timeMonth.every(1)).tickFormat(d3.timeFormat("%b %Y"));
        } else {
            // For smaller ranges, show weekly or daily ticks
            if (daysDiff > 14) {
                vis.xAxis.ticks(d3.timeWeek.every(1)).tickFormat(d3.timeFormat("%b %d"));
            } else {
                vis.xAxis.ticks(d3.timeDay.every(Math.ceil(daysDiff / 7))).tickFormat(d3.timeFormat("%b %d"));
            }
        }

        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        // Update axes
        vis.xAxisG.call(vis.xAxis);
        vis.yAxisG.call(vis.yAxis);

        // Draw line for the timeline
        vis.pathElement
            .datum(vis.displayData)
            .attr('d', vis.line);

        // Update data points (display subset for better performance)
        // Only show points if there aren't too many
        const showPoints = vis.displayData.length < 100;
        
        // Select subset of points to display if there are too many
        const pointsToShow = showPoints ? vis.displayData : 
            vis.displayData.filter((_, i) => i % Math.ceil(vis.displayData.length / 50) === 0);
        
        const circles = vis.pointsGroup.selectAll('.data-point')
            .data(pointsToShow, d => d.date.getTime());

        // Remove old points
        circles.exit().remove();

        // Add new points
        const circlesEnter = circles.enter()
            .append('circle')
            .attr('class', 'data-point');

        // Update all points
        circlesEnter.merge(circles)
            .attr('cx', d => vis.xScale(d.date))
            .attr('cy', d => vis.yScale(d.count))
            .attr('r', 4)
            .attr('fill', '#384982')
            .on('mouseover', function(event, d) {
                vis.showTooltip(event, d);
            })
            .on('mouseout', function() {
                vis.hideTooltip();
            });

        console.log("TimeLineDetail: Rendered", vis.displayData.length, "data points with", pointsToShow.length, "visible points");
    }
    
    handleMouseMove(event) {
        let vis = this;
        
        // Get mouse x position
        const [mouseX] = d3.pointer(event);
        
        // Convert to date
        const hoveredDate = vis.xScale.invert(mouseX);
        
        // Find closest data point
        const bisectDate = d3.bisector(d => d.date).left;
        const index = bisectDate(vis.displayData, hoveredDate);
        
        // Make sure we have valid data
        if (index >= vis.displayData.length) return;
        
        const d0 = vis.displayData[Math.max(0, index - 1)];
        const d1 = vis.displayData[index];
        
        // Select the closer data point
        const closestPoint = hoveredDate - d0.date > d1.date - hoveredDate ? d1 : d0;
        
        // Position the hover line
        vis.hoverGroup.style('display', 'block');
        vis.hoverLine
            .attr('x1', vis.xScale(closestPoint.date))
            .attr('x2', vis.xScale(closestPoint.date));
        
        // Show tooltip
        vis.showTooltip(event, closestPoint);
    }

    showTooltip(event, d) {
        // Format date based on the currently displayed time range
        let dateFormat = d3.timeFormat("%Y-%m-%d");
        
        d3.select('#tooltip')
            .style('display', 'block')
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 28) + 'px')
            .html(`
                <div class="tooltip-title">${dateFormat(d.date)}</div>
                <div><strong>Games Released:</strong> ${d.count}</div>
            `);
    }

    hideTooltip() {
        d3.select('#tooltip')
            .style('display', 'none');
    }
} 