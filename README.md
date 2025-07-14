# xGov Council Voting Visualization

A real-time visualization of on-chain voting for the xGov council election on Algorand. This application fetches voting transactions from the xGov voting account, processes them using committed amounts from CSV, and displays interactive charts using ECharts to show voting patterns, stake distribution, and governance metrics.

## Features

- **Real-time Data**: Fetches voting data from Algorand blockchain using Nodely API
- **Interactive Charts**: 
  - Scoreboard: Animated racing bar chart showing net yes stake over time
  - Stake-Weighted Chart: Bar chart per candidate with yes/no/abstain stakes (log scale)
  - Popularity Chart: Pixel scatter plot showing individual votes
  - Non-Voters Chart: Shows non-voters by stake
  - Stake Breakdown Chart: Marimekko chart of votes by stake buckets
- **Statistics Cards**: Display time left, voted stake, unique voters, participation rate
- **Auto-refresh**: Updates data every hour automatically and on reload
- **Responsive Design**: Works on desktop and mobile devices
- **Animations**: Confetti on voting end, playback for scoreboard
- **Copy Address**: Click on displayed addresses to copy full voter or candidate addresses to clipboard


## Setup Instructions

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd xgov-voting-visualization
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## How It Works

### Data Flow

1. **Load Committed Amounts**: Reads `commit-amount.csv` for voter stakes in Algos
2. **Transaction Fetching**: Fetches transactions from xGov voting account (`RW466IANOKLA36QARHMBX5VCY3PYDR3H2N5XHPDARG6UBOKCIK7WAMLSCA`) starting from block 51363025
3. **Note Parsing**: Decodes Base64 notes, parses JSON arrays for votes across all candidates (a=yes, b=no, c=abstain)
4. **Process Latest Votes**: Keeps only the most recent vote per voter
5. **Assign Stakes**: Maps stakes from CSV to votes
6. **Data Aggregation**: Groups by candidates, calculates totals
7. **Visualization**: Uses ECharts to render various interactive charts

### API Usage

The application uses the Nodely Algorand Indexer API with rate limiting:
- 20 requests per second maximum
- No API key required
- Endpoints used:
  - `/v2/accounts/{address}/transactions` - Fetch voting transactions
  - Governance API for voting periods

### Voting Format

Transaction notes are Base64 encoded JSON: `af/gov1:j[period, "a"/"b"/"c" for each candidate]`
- Array index corresponds to candidate (1-23)
- "a" = Yes, "b" = No, "c" = Abstain

## Project Structure

```
src/
├── api.ts                    # Algorand API service with rate limiting
├── candidates.ts             # List of candidates
├── echartsService.ts         # Stake-weighted chart creation
├── main.ts                   # Main application entry point and visualization logic
├── popularityChartService.ts # Popularity pixel chart creation
├── statistics.ts             # Statistics visualization (partial overlap with main)
├── statisticsService.ts      # Statistics computation
├── types.ts                  # TypeScript interfaces
├── votingService.ts          # Voting data fetching and processing
```

## Technical Details

### Rate Limiting

Implements a sliding window rate limiter (20 requests/second) for Nodely API.

### Error Handling

- Graceful handling of API failures
- User-friendly error messages
- Console logging for debugging

### Performance

- Uses Maps for efficient data processing
- Chart disposal for memory management
- Rate limiting to prevent API overload
- CSV for stake data to avoid per-voter queries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Nodely for providing free Algorand API access