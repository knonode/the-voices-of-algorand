# xGov Council Voting Visualization

A real-time visualization of on-chain voting for the xGov council election on Algorand. This application fetches voting transactions from the xGov voting account and displays them as interactive charts showing voting patterns, stake distribution, and democratic governance in action.

## Features

- **Real-time Data**: Fetches voting data from Algorand blockchain using Nodely API
- **Interactive Charts**: Individual charts for each candidate showing voter distribution
- **Stake-based Visualization**: Column charts with stacked yes/no/abstain votes
- **Hover Details**: Shows truncated voter addresses and stake amounts on hover
- **Dark Theme**: Beautiful dark UI with teal highlights and pastel colors
- **Auto-refresh**: Updates data every hour automatically
- **Responsive Design**: Works on desktop and mobile devices

## Color Scheme

- **Background**: Dark gray (rgb(18, 18, 18))
- **Primary**: Teal variations (#008080, #20B2AA, #48D1CC)
- **Yes Votes**: Soft green (#90EE90)
- **No Votes**: Soft red (#FFB6C1)
- **Abstain**: Soft yellow (#F0E68C)

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

1. **Transaction Fetching**: The app fetches all transactions from the xGov voting account (`RW466IANOKLA36QARHMBX5VCY3PYDR3H2N5XHPDARG6UBOKCIK7WAMLSCA`)

2. **Note Parsing**: Transaction notes are decoded and parsed to extract:
   - Vote type (a=yes, b=no, c=abstain)
   - Candidate index (1-20)

3. **Balance Fetching**: For each unique voter, the app fetches their current ALGO balance to determine voting weight

4. **Data Processing**: Votes are grouped by candidate and voter, with stakes calculated

5. **Visualization**: Chart.js creates interactive stacked bar charts for each candidate

### API Usage

The application uses the Nodely Algorand API (free tier) with rate limiting:
- 20 requests per second maximum
- No API key required
- Endpoints used:
  - `/v2/accounts/{address}/transactions` - Fetch voting transactions
  - `/v2/accounts/{address}` - Fetch voter balances

### Voting Format

Transaction notes follow the format: `{vote_type}.{candidate_index}`
- `a.1` = Yes vote for candidate 1
- `b.5` = No vote for candidate 5
- `c.10` = Abstain for candidate 10

## Project Structure

```
src/
├── types.ts           # TypeScript interfaces
├── candidates.ts      # Candidate data and note parsing
├── api.ts            # Algorand API service with rate limiting
├── votingService.ts  # Core voting data processing
├── chartService.ts   # Chart.js visualization logic
└── main.ts          # Main application entry point
```

## Technical Details

### Rate Limiting

The application implements a sliding window rate limiter to respect the Nodely API's 20 requests/second limit.

### Error Handling

- Graceful handling of API failures
- Fallback for missing voter balances
- User-friendly error messages

### Performance

- Efficient data processing with Map data structures
- Lazy loading of chart components
- Memory cleanup on page unload

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Algorand Foundation for xGov governance
- Nodely for providing free Algorand API access
- Chart.js for the visualization library
- The Algorand community for on-chain governance innovation 