# xGov Council Voting Visualization Plan

## Overview
Create a real-time visualization of on-chain voting for the xGov council election, showing voting patterns, stake distribution, and democratic governance in action.

## Current Status ✅
- [x] TypeScript project with Vite build system
- [x] Plotly.js implementation with stacked bar charts
- [x] Data fetching from Algorand blockchain
- [x] Real-time updates and responsive design
- [x] Dark theme with teal color scheme
- [x] Stake-weighted voting visualization
- [x] Candidate sorting by unique voters
- [x] Address display under candidate names
- [x] Popularity vote charts with pixel visualization

## Migration to ECharts for Memory Optimization 🚀

### Background
The current Plotly.js implementation is consuming excessive memory due to chart complexity. ECharts provides better memory management and performance for large datasets while maintaining rich interactive features.

### Phase 1: Dependencies & Setup
- [ ] Install ECharts and remove Plotly.js
- [ ] Update package.json dependencies
- [ ] Add ECharts type definitions
- [ ] Test ECharts integration
- [ ] Remove Plotly.js type definitions

### Phase 2: Core Chart Migration
- [ ] Create new EChartsService to replace PlotlyService
- [ ] Migrate stake-weighted bar charts from Plotly.js to ECharts
- [ ] Implement log scale support for better data visualization
- [ ] Enhance tooltips with ECharts interactive features
- [ ] Maintain current color scheme and styling
- [ ] Preserve all existing functionality (filtering, sorting, etc.)
- [ ] Implement click handlers for address copying
- [ ] Add chart export capabilities (PNG, SVG)

### Phase 3: Popularity Chart Migration
- [ ] Migrate popularity vote charts from Plotly.js to ECharts
- [ ] Implement pixel canvas layout using ECharts scatter plot
- [ ] Maintain vote grouping: Yes (left), Abstain (middle), No (right)
- [ ] Preserve individual pixels for each vote (no stake weighting)
- [ ] Use same color scheme: green (yes), yellow (abstain), red (no)
- [ ] Add interactive tooltips showing voter information
- [ ] Ensure responsive design for different screen sizes
- [ ] Maintain vote count display above charts

### Phase 4: Summary Chart Migration
- [ ] Migrate summary chart from Plotly.js to ECharts
- [ ] Implement stacked bar chart for candidate comparison
- [ ] Maintain legend and hover functionality
- [ ] Preserve export capabilities

### Phase 5: Layout & UI Updates
- [ ] Update main.ts to use ECharts instead of Plotly
- [ ] Modify chart container management
- [ ] Update chart cleanup and memory management
- [ ] Ensure proper chart sizing and responsiveness
- [ ] Test chart performance with large datasets

### Phase 6: Memory Optimization
- [ ] Implement chart disposal on candidate changes
- [ ] Optimize data processing for ECharts format
- [ ] Add memory usage monitoring
- [ ] Implement lazy loading for charts
- [ ] Test memory usage improvements

## NEW: Use commit-amount.csv for Staking Amounts

**Background:**
Previously, stake amounts were parsed from on-chain commit messages, but these reflected LP tokens, not Algo. The new approach uses the authoritative `commit-amount.csv` file, which contains the correct committed Algo amount for each voter.

**Steps:**
1. Read and parse `commit-amount.csv` at startup or on refresh. The CSV maps voter addresses to their committed Algo amount.
2. Replace all logic that calculates or fetches stake/weight from on-chain registration/commit messages with a lookup from the parsed CSV. The voting logic and polling for new votes remains unchanged. Only the stake/weight for each voter is now sourced from the CSV.
3. When building the votes array for charts: For each vote, set `stake` to the value from the CSV for that voter. If a voter is not found in the CSV, treat their stake as 0 or skip (depending on requirements).
4. Update tooltips, bar heights, and summary statistics to use the new stake values.
5. Do not change any other working logic (vote parsing, chart rendering, etc.).

## Technical Specifications

### Color Scheme (Maintained)
- Background: rgb(18, 18, 18)
- Primary: Teal variations (#008080, #20B2AA, #48D1CC)
- Yes votes: Soft green (#90EE90)
- No votes: Soft red (#FFB6C1)
- Abstain: Soft yellow (#F0E68C)

### Chart Types (ECharts Migration)

#### 1. Stake-Weighted Chart (ECharts Migration)
- **Type**: Stacked bar chart with log scale support
- **Data**: Stake-weighted votes per voter
- **Features**: 
  - Log scale toggle
  - Enhanced tooltips
  - Zoom/pan functionality
  - Export capabilities
  - Click to copy address

#### 2. Popularity Vote Chart (ECharts Migration)
- **Type**: Scatter plot with custom markers
- **Data**: Individual votes (no stake weighting)
- **Layout**: 
  - Yes votes: Left side (green pixels)
  - Abstain votes: Middle (yellow pixels)  
  - No votes: Right side (red pixels)
- **Features**:
  - Each pixel represents one vote
  - Interactive tooltips showing voter address
  - Responsive pixel sizing
  - Clear visual grouping
  - Vote count display

#### 3. Summary Chart (ECharts Migration)
- **Type**: Stacked bar chart
- **Data**: Total votes per candidate
- **Features**:
  - Stacked yes/no/abstain bars
  - Interactive legend
  - Export capabilities
  - Responsive design

### Data Structure (Enhanced)
```typescript
interface Vote {
  voter: string;
  candidate: string;
  vote: 'yes' | 'no' | 'abstain';
  stake: number;
  timestamp: number;
}

interface Candidate {
  name: string;
  address: string;
  votes: Vote[];
  totalStake: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
}

interface EChartsData {
  stakeChart: echarts.EChartsOption;
  popularityChart: echarts.EChartsOption;
  summaryChart: echarts.EChartsOption;
}
```

### Implementation Order
1. **Setup**: Install ECharts, remove Plotly.js
2. **Core Migration**: Convert stake charts to ECharts
3. **Popularity Migration**: Convert popularity charts to ECharts
4. **Summary Migration**: Convert summary chart to ECharts
5. **Integration**: Update main.ts and chart management
6. **Optimization**: Implement memory management
7. **Testing**: Ensure all functionality works correctly

### File Structure Changes
```
src/
├── main.ts (updated for ECharts)
├── echartsService.ts (new - replaces plotlyService.ts)
├── popularityChartService.ts (updated for ECharts)
├── votingService.ts (unchanged)
├── api.ts (unchanged)
├── candidates.ts (unchanged)
└── types.ts (enhanced for ECharts)
```

### Benefits of ECharts Migration
- **Memory Efficiency**: Better memory management for large datasets
- **Performance**: Optimized rendering and interaction
- **Log Scale**: Better visualization of large stake differences
- **Interactive Tooltips**: More detailed information on hover
- **Export Features**: Save charts as images
- **Zoom/Pan**: Better exploration of data
- **Popularity View**: See voting patterns without stake influence
- **Responsive Design**: Better mobile and desktop experience

## API Endpoints (Unchanged)
- Nodely Algorand API: https://nodely.io/swagger/index.html?url=/swagger/api/4160/algod.oas3.yml
- Account transactions: `/v2/accounts/{address}/transactions`
- Account info: `/v2/accounts/{address}` 