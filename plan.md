# xGov Council Voting Visualization Plan

## Overview
Create a real-time visualization of on-chain voting for the xGov council election, showing voting patterns, stake distribution, and democratic governance in action.

## Tasks

### 1. Project Setup & Dependencies
- [ ] Initialize TypeScript project with necessary dependencies
- [ ] Set up HTML structure with dark theme
- [ ] Configure build system (Vite/Webpack)
- [ ] Install charting library (Chart.js or D3.js)

### 2. Data Fetching & Processing
- [ ] Create TypeScript service to fetch transactions from Algorand account
- [ ] Implement rate limiting (20 requests/second for Nodely API)
- [ ] Parse transaction notes to extract voting data (yes/no/abstain)
- [ ] Fetch account balances for voting weight calculation
- [ ] Create data structures for candidates and votes

### 3. Candidate Data Management
- [ ] Extract candidate list from GitHub repository
- [ ] Create mapping between transaction notes and candidates
- [ ] Handle edge cases (invalid notes, unknown candidates)

### 4. Visualization Components
- [ ] Design responsive layout with dark theme
- [ ] Create individual chart components for each candidate
- [ ] Implement stacked column charts showing yes/no/abstain
- [ ] Add hover effects with account truncation (Q8DH...LQ94)
- [ ] Style with teal highlights and pastel colors

### 5. Real-time Updates
- [ ] Implement hourly data refresh
- [ ] Add loading states and error handling
- [ ] Optimize performance for large datasets

### 6. UI/UX Enhancements
- [ ] Add summary statistics (total votes, participation rate)
- [ ] Implement responsive design for mobile
- [ ] Add filters and sorting options
- [ ] Include timestamp of last update

## Technical Specifications

### Color Scheme
- Background: rgb(18, 18, 18)
- Primary: Teal variations (#008080, #20B2AA, #48D1CC)
- Yes votes: Soft green (#90EE90)
- No votes: Soft red (#FFB6C1)
- Abstain: Soft yellow (#F0E68C)

### Data Structure
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
  votes: Vote[];
  totalStake: number;
}
```

### API Endpoints
- Nodely Algorand API: https://nodely.io/swagger/index.html?url=/swagger/api/4160/algod.oas3.yml
- Account transactions: `/v2/accounts/{address}/transactions`
- Account info: `/v2/accounts/{address}`

## Implementation Order
1. Basic project setup
2. Data fetching service
3. Static visualization
4. Real-time updates
5. UI polish and optimization 