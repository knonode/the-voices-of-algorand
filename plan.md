# xGov Council Voting Visualization Plan

## Overview
Create a real-time visualization of on-chain voting for the xGov council election, showing voting patterns, stake distribution, and democratic governance in action.

## Current Status ✅
- [x] TypeScript project with Vite build system
- [x] Chart.js implementation with stacked bar charts
- [x] Data fetching from Algorand blockchain
- [x] Real-time updates and responsive design
- [x] Dark theme with teal color scheme
- [x] Stake-weighted voting visualization
- [x] Candidate sorting by unique voters
- [x] Address display under candidate names

## Migration to Plotly.js + New Popularity Chart 🚀

### Phase 1: Dependencies & Setup
- [ ] Install Plotly.js and remove Chart.js
- [ ] Update package.json dependencies
- [ ] Test Plotly.js integration

### Phase 2: Core Chart Migration
- [ ] Migrate stake-weighted bar charts from Chart.js to Plotly.js
- [ ] Implement log scale support for better data visualization
- [ ] Enhance tooltips with Plotly.js interactive features
- [ ] Maintain current color scheme and styling
- [ ] Preserve all existing functionality (filtering, sorting, etc.)

### Phase 3: New Popularity Vote Chart
- [ ] Design pixel canvas layout for popularity votes
- [ ] Implement vote grouping: Yes (left), Abstain (middle), No (right)
- [ ] Create individual pixels for each vote (no stake weighting)
- [ ] Use same color scheme: green (yes), yellow (abstain), red (no)
- [ ] Add interactive tooltips showing voter information
- [ ] Ensure responsive design for different screen sizes

### Phase 4: Layout & UI Updates
- [ ] Update HTML structure to accommodate dual charts per candidate
- [ ] Modify CSS for new chart layout (stake chart + popularity chart)
- [ ] Implement chart switching or side-by-side display
- [ ] Update main.ts to handle both chart types
- [ ] Ensure proper chart sizing and responsiveness

### Phase 5: Enhanced Features
- [ ] Add log scale toggle for stake charts
- [ ] Implement zoom and pan functionality
- [ ] Add chart export capabilities (PNG, SVG)
- [ ] Enhance tooltips with more detailed information
- [ ] Add chart legends and better labeling

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

### New Chart Types

#### 1. Stake-Weighted Chart (Plotly.js Migration)
- **Type**: Stacked bar chart with log scale support
- **Data**: Stake-weighted votes per voter
- **Features**: 
  - Log scale toggle
  - Enhanced tooltips
  - Zoom/pan functionality
  - Export capabilities

#### 2. Popularity Vote Chart (New)
- **Type**: Pixel canvas/scatter plot
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

interface ChartData {
  stakeChart: Plotly.Data[];
  popularityChart: Plotly.Data[];
}
```

### Implementation Order
1. **Setup**: Install Plotly.js, remove Chart.js
2. **Migration**: Convert existing bar charts to Plotly.js
3. **Popularity Chart**: Implement pixel canvas for individual votes
4. **Layout**: Update HTML/CSS for dual chart display
5. **Enhancement**: Add log scale, zoom, export features
6. **Testing**: Ensure all functionality works correctly

### File Structure Changes
```
src/
├── main.ts (updated for dual charts)
├── plotlyService.ts (new - replaces chartService.ts)
├── popularityChartService.ts (new)
├── votingService.ts (unchanged)
├── api.ts (unchanged)
├── candidates.ts (unchanged)
└── types.ts (enhanced)
```

### Benefits of Migration
- **Log Scale**: Better visualization of large stake differences
- **Interactive Tooltips**: More detailed information on hover
- **Export Features**: Save charts as images
- **Zoom/Pan**: Better exploration of data
- **Popularity View**: See voting patterns without stake influence
- **Better Performance**: Plotly.js optimized for large datasets

## API Endpoints (Unchanged)
- Nodely Algorand API: https://nodely.io/swagger/index.html?url=/swagger/api/4160/algod.oas3.yml
- Account transactions: `/v2/accounts/{address}/transactions`
- Account info: `/v2/accounts/{address}` 