import { Vote, Candidate, VotingStats, AlgorandTransaction, CommitAmount } from './types';
import { CANDIDATES } from './candidates';
import { fetchVotingAccountTransactions, parseVotingOrRegistrationNote, getLatestVotes } from './api';

function parseCommitAmountCSV(csvText: string): Map<string, number> {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const map = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) { // skip header
    const cols = lines[i].split(',');
    if (cols.length < 3) continue;
    const address = cols[0].trim();
    const amount = parseInt(cols[2].trim(), 10);
    if (address && !isNaN(amount)) {
      map.set(address, amount / 1_000_000); // convert microAlgos to Algos
    }
  }
  return map;
}

export class VotingService {
  private votes: Vote[] = [];
  private candidates: Map<string, Candidate> = new Map();
  private voterWeights: Map<string, number> = new Map();
  private commitAmountLoaded = false;

  constructor() {
    this.initializeCandidates();
  }

  private initializeCandidates(): void {
    CANDIDATES.forEach(candidate => {
      this.candidates.set(candidate.name, {
        name: candidate.name,
        address: candidate.address,
        votes: [],
        totalStake: 0,
        yesVotes: 0,
        noVotes: 0,
        abstainVotes: 0
      });
    });
  }

  async loadCommitAmounts(): Promise<void> {
    if (this.commitAmountLoaded) return;
    const resp = await fetch('src/commit-amount.csv');
    const text = await resp.text();
    this.voterWeights = parseCommitAmountCSV(text);
    this.commitAmountLoaded = true;
    console.log(`Loaded ${this.voterWeights.size} voter weights from commit-amount.csv`);
  }

  private parseTransaction(tx: AlgorandTransaction): Vote[] {
    if (!tx.note) return [];
    const parsed = parseVotingOrRegistrationNote(tx.note);
    if (parsed.type !== 'voting') return [];
    
    // For voting notes, parse all candidate votes from the note array
    // Example: [1,"a","b","c",...] where arr[0] is candidate index, arr[1-23] are votes for all candidates
    const arr = parsed.data;
    if (!Array.isArray(arr) || arr.length < CANDIDATES.length + 1) return [];
    
    const votes: Vote[] = [];
    
    // Process votes for all candidates (arr[1] through arr[23])
    for (let i = 0; i < CANDIDATES.length; i++) {
      const voteCode = arr[i + 1];
      const voteType = voteCode === 'a' ? 'yes' : voteCode === 'b' ? 'no' : voteCode === 'c' ? 'abstain' : null;
      
      if (voteType) {
        votes.push({
          voter: tx.sender,
          candidate: CANDIDATES[i].name,
          vote: voteType,
          stake: 0, // Will be populated from registration weights
          timestamp: tx['round-time'],
          transactionId: tx.id
        });
      }
    }
    
    return votes;
  }

  async fetchAndProcessVotes(): Promise<void> {
    try {
      await this.loadCommitAmounts();
      console.log('Fetching voting transactions...');
      const transactions = await fetchVotingAccountTransactions();
      console.log(`Found ${transactions.length} transactions`);

      // voterWeights is now loaded from CSV, do not overwrite

      // Use only the latest vote per voter per candidate
      const latestVotesTxs = getLatestVotes(transactions);
      const parsedVotes: Vote[] = [];
      for (const tx of latestVotesTxs) {
        const votes = this.parseTransaction(tx);
        parsedVotes.push(...votes);
      }
      console.log(`Parsed ${parsedVotes.length} voting transactions`);

      // Assign registration weights to votes
      this.votes = parsedVotes.map(vote => ({
        ...vote,
        stake: this.voterWeights.get(vote.voter) || 0
      }));

      // Update candidate data
      this.updateCandidateData();
      console.log('Voting data processed successfully');
    } catch (error) {
      console.error('Error fetching and processing votes:', error);
      throw error;
    }
  }

  private updateCandidateData(): void {
    // Reset candidate data
    this.candidates.forEach(candidate => {
      candidate.votes = [];
      candidate.totalStake = 0;
      candidate.yesVotes = 0;
      candidate.noVotes = 0;
      candidate.abstainVotes = 0;
    });

    // Group votes by candidate
    this.votes.forEach(vote => {
      const candidate = this.candidates.get(vote.candidate);
      if (candidate) {
        candidate.votes.push(vote);
        candidate.totalStake += vote.stake;

        switch (vote.vote) {
          case 'yes':
            candidate.yesVotes += vote.stake;
            break;
          case 'no':
            candidate.noVotes += vote.stake;
            break;
          case 'abstain':
            candidate.abstainVotes += vote.stake;
            break;
        }
      }
    });
  }

  getCandidates(): Candidate[] {
    return Array.from(this.candidates.values());
  }

  getVotes(): Vote[] {
    return this.votes;
  }

  getVotingStats(): VotingStats {
    const totalVotes = this.votes.length;
    const totalStake = this.votes.reduce((sum, vote) => sum + vote.stake, 0);
    const uniqueVoters = new Set(this.votes.map(v => v.voter)).size;
    
    // Calculate participation rate based on registered voters
    const participationRate = this.voterWeights.size > 0 ? (uniqueVoters / this.voterWeights.size) * 100 : 0;

    return {
      totalVotes,
      totalStake,
      uniqueVoters,
      participationRate: Math.min(participationRate, 100)
    };
  }

  getCandidateVotes(candidateName: string): Vote[] {
    return this.votes.filter(vote => vote.candidate === candidateName);
  }

  getVoterWeights(): Map<string, number> {
    return new Map(this.voterWeights);
  }

  // Helper method to truncate account addresses for display
  static truncateAddress(address: string): string {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }
} 