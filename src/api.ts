import { AlgorandTransaction, AlgorandAccount } from './types';

const NODELY_INDEXER_BASE = 'https://mainnet-idx.4160.nodely.dev';
const VOTING_ACCOUNT = 'RW466IANOKLA36QARHMBX5VCY3PYDR3H2N5XHPDARG6UBOKCIK7WAMLSCA';
const VOTING_START_BLOCK = 51363025;

// Rate limiting: 20 requests per second
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 20;
  private readonly timeWindow = 1000; // 1 second

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    this.requests.push(now);
  }
}

const rateLimiter = new RateLimiter();

async function makeIndexerRequest<T>(endpoint: string): Promise<T> {
  await rateLimiter.waitForSlot();
  const response = await fetch(`${NODELY_INDEXER_BASE}${endpoint}`, {
    headers: {
      'Accept': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`Indexer API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}



// Robust note parsing for registration and voting
export function parseVotingOrRegistrationNote(note: string): { type: 'registration' | 'voting' | 'unknown', data: any } {
  try {
    const decoded = atob(note);
    if (decoded.startsWith('af/gov1:j{')) {
      // Registration note
      const jsonStr = decoded.substring('af/gov1:j'.length);
      return { type: 'registration', data: JSON.parse(jsonStr) };
    } else if (decoded.startsWith('af/gov1:j[')) {
      // Voting note
      const jsonStr = decoded.substring('af/gov1:j'.length);
      return { type: 'voting', data: JSON.parse(jsonStr) };
    }
  } catch {}
  return { type: 'unknown', data: null };
}

// Get latest block round
export async function getLatestBlockRound(): Promise<number> {
  try {
    const status = await makeIndexerRequest<any>('/v2/status');
    return status['last-round'];
  } catch (error) {
    console.error('Failed to get latest block round:', error);
    throw error;
  }
}

// Fetch a specific block
export async function fetchBlock(round: number): Promise<any> {
  try {
    return await makeIndexerRequest<any>(`/v2/blocks/${round}`);
  } catch (error) {
    console.error(`Failed to fetch block ${round}:`, error);
    throw error;
  }
}

// Fetch all transactions for the voting account using the indexer
export async function fetchAccountTransactions(
  address: string
): Promise<AlgorandTransaction[]> {
  let endpoint = `/v2/accounts/${address}/transactions?limit=1000&min-round=${VOTING_START_BLOCK}`;
  let allTransactions: AlgorandTransaction[] = [];
  let nextToken: string | undefined = undefined;

  do {
    const url = nextToken ? `${endpoint}&next=${nextToken}` : endpoint;
    console.log(`Indexer: Fetching ${url}`);
    const data: { transactions: AlgorandTransaction[]; 'next-token'?: string } = await makeIndexerRequest(url);
    if (data.transactions && Array.isArray(data.transactions)) {
      allTransactions.push(...data.transactions);
    }
    nextToken = data['next-token'];
  } while (nextToken);

  console.log(`Total transactions fetched from indexer: ${allTransactions.length}`);
  return allTransactions;
}

export async function fetchAccountInfo(address: string): Promise<AlgorandAccount> {
  const endpoints = [
    `/v2/accounts/${address}`,
    `/v2/account/${address}`
  ];
  
  for (const endpoint of endpoints) {
    try {
      const data = await makeIndexerRequest<any>(endpoint);
      
      // Handle different response formats
      if (data.account) {
        return data.account;
      } else if (data.address) {
        return data;
      } else if (data.amount !== undefined) {
        return data;
      }
    } catch (error) {
      console.warn(`Failed with endpoint ${endpoint}:`, error);
      continue;
    }
  }
  
  throw new Error('All account info endpoints failed');
}

export async function fetchVotingAccountTransactions(): Promise<AlgorandTransaction[]> {
  return fetchAccountTransactions(VOTING_ACCOUNT);
}

// New function to get only the latest vote per voter per candidate
export function getLatestVotes(transactions: AlgorandTransaction[]): AlgorandTransaction[] {
  // Map: voterAddress -> latestTx
  const latestVotes = new Map<string, AlgorandTransaction>();

  for (const tx of transactions) {
    if (!tx.note) continue;
    const parsed = parseVotingOrRegistrationNote(tx.note);
    if (parsed.type !== 'voting') continue;
    
    // If this voter already has a vote, keep the latest one (by round-time)
    if (!latestVotes.has(tx.sender) || tx['round-time'] > latestVotes.get(tx.sender)!['round-time']) {
      latestVotes.set(tx.sender, tx);
    }
  }

  // Return array of latest voting transactions (one per voter)
  return Array.from(latestVotes.values());
}

export async function fetchVotingPeriod(periodId: number = 15): Promise<{ start: number; end: number }> {
  try {
    const response = await fetch(`https://governance.algorand.foundation/api/periods/governance-period-15/`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Governance API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Governance API response:', data);
    
    if (data && data.registration_end_datetime && data.end_datetime) {
      return {
        start: new Date(data.registration_end_datetime).getTime(),
        end: new Date(data.end_datetime).getTime(),
      };
    } else {
      throw new Error('Invalid period data structure');
    }
  } catch (error) {
    console.error('Failed to fetch voting period:', error);
    throw error;
  }
}