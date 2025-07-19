import { Vote, Candidate, VotingStats, AlgorandTransaction } from './types';
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

function parseWithdrawalCSV(csvText: string): Map<string, number> {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const map = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) { // skip header
    const cols = lines[i].split(',');
    if (cols.length < 2) continue;
    const address = cols[0].trim();
    const amount = parseInt(cols[1].trim(), 10);
    if (address && !isNaN(amount)) {
      map.set(address, amount / 1_000_000); // convert microAlgos to Algos
    }
  }
  return map;
}

// Add VoterRegistry for deduplication
class VoterRegistryImpl {
  private addressToId = new Map<string, number>();
  private idToAddress = new Map<number, string>();
  private nextId = 1;

  getId(address: string): number {
    if (!this.addressToId.has(address)) {
      const id = this.nextId++;
      this.addressToId.set(address, id);
      this.idToAddress.set(id, address);
    }
    return this.addressToId.get(address)!;
  }

  getAddress(id: number): string {
    return this.idToAddress.get(id) || '';
  }

  getAllAddresses(): string[] {
    return Array.from(this.addressToId.keys());
  }
}

const VoterRegistry = new VoterRegistryImpl();

export class VotingService {
  private votes: Vote[] = [];
  private candidates: Map<string, Candidate> = new Map();
  private voterWeights: Map<string, number> = new Map();
  private finalEligibleVoters: Map<string, number> = new Map();
  private withdrawalData: Map<string, number> = new Map();
  private commitAmountLoaded = false;
  private allTransactions: AlgorandTransaction[] = [];

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
    
    // Load registration data
    const resp = await fetch('/commit-amount.csv');
    const text = await resp.text();
    this.voterWeights = parseCommitAmountCSV(text);
    
    // Load final eligible voters for correct count
    const finalResp = await fetch('/governance-period-15-eligible-governors-2025-07-15-16-14.csv');
    const finalText = await finalResp.text();
    this.finalEligibleVoters = parseCommitAmountCSV(finalText);
    
    // Load withdrawal data
    const withdrawalResp = await fetch('/withdrawn-addresses.csv');
    const withdrawalText = await withdrawalResp.text();
    this.withdrawalData = parseWithdrawalCSV(withdrawalText);
    
    this.commitAmountLoaded = true;
    console.log(`Loaded ${this.voterWeights.size} voter weights from commit-amount.csv`);
    console.log(`Loaded ${this.finalEligibleVoters.size} final eligible voters`);
    console.log(`Loaded ${this.withdrawalData.size} withdrawn addresses`);
    
    // Debug: Calculate total withdrawn amount
    let totalWithdrawn = 0;
    this.withdrawalData.forEach(amount => {
      totalWithdrawn += amount;
    });
    console.log(`Total withdrawn amount: ${totalWithdrawn.toFixed(2)} Algo`);
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
    const voterId = VoterRegistry.getId(tx.sender);
    
    // Process votes for all candidates (arr[1] through arr[23])
    for (let i = 0; i < CANDIDATES.length; i++) {
      const voteCode = arr[i + 1];
      const voteType = voteCode === 'a' ? 'yes' : voteCode === 'b' ? 'no' : voteCode === 'c' ? 'abstain' : null;
      
      if (voteType) {
        votes.push({
          voter: voterId, // Use ID
          candidate: CANDIDATES[i].name,
          vote: voteType,
          stake: 0, // Will be populated from registration weights
          timestamp: tx['round-time'] * 1000,
          transactionId: tx.id
        });
      }
    }
    
    return votes;
  }

  async fetchAndProcessVotes(): Promise<void> {
    try {
      console.log('Starting fetchAndProcessVotes...');
      await this.loadCommitAmounts();
      console.log('Commit amounts loaded successfully');
      console.log('Fetching voting transactions...');
      const transactions = await fetchVotingAccountTransactions();
      this.allTransactions = transactions; // Store all transactions
      console.log(`Found ${transactions.length} transactions`);

      // voterWeights is now loaded from CSV, do not overwrite

      // Use only the latest vote per voter per candidate
      const latestVotesTxs = getLatestVotes(transactions);
      console.log(`Found ${latestVotesTxs.length} latest voting transactions`);
      const parsedVotes: Vote[] = [];
      for (const tx of latestVotesTxs) {
        const votes = this.parseTransaction(tx);
        parsedVotes.push(...votes);
      }
      console.log(`Parsed ${parsedVotes.length} voting transactions`);

      // Assign registration weights to votes and apply withdrawal corrections
      this.votes = parsedVotes.map(vote => {
        const voterAddress = VoterRegistry.getAddress(vote.voter);
        const registrationStake = this.voterWeights.get(voterAddress) || 0;
        const withdrawalAmount = this.withdrawalData.get(voterAddress) || 0;
        const correctedStake = Math.max(0, registrationStake - withdrawalAmount);
        
        return {
          ...vote,
          stake: correctedStake
        };
      });
      console.log(`Assigned stakes to ${this.votes.length} votes with withdrawal corrections`);

      // Update candidate data
      this.updateCandidateData();
      console.log('Voting data processed successfully');
      console.log('Candidates with votes:', this.getCandidates().filter(c => c.votes.length > 0).map(c => ({ name: c.name, voteCount: c.votes.length })));
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
    
    // Calculate total stake from ALL eligible voters (not just those who voted)
    let totalStake = 0;
    this.finalEligibleVoters.forEach((registrationStake, address) => {
      const withdrawalAmount = this.withdrawalData.get(address) || 0;
      const correctedStake = Math.max(0, registrationStake - withdrawalAmount);
      totalStake += correctedStake;
    });
    
    const votersWhoVoted = new Set(this.votes.map(v => v.voter)).size;
    const totalRegisteredVoters = this.voterWeights.size; // Total registered voters (2162)
    const totalFinalEligibleVoters = this.finalEligibleVoters.size; // Final eligible voters (1394)
    
    // Calculate participation rate based on registered voters
    const participationRate = totalRegisteredVoters > 0 ? (votersWhoVoted / totalRegisteredVoters) * 100 : 0;

    return {
      totalVotes,
      totalStake,
      uniqueVoters: totalFinalEligibleVoters, // Show final eligible voters (1394)
      participationRate: Math.min(participationRate, 100)
    };
  }

  getCandidateVotes(candidateName: string): Vote[] {
    return this.votes.filter(vote => vote.candidate === candidateName);
  }

  getVoterWeights(): Map<string, number> {
    return new Map(this.voterWeights);
  }

  getVoterRegistry() {
    return VoterRegistry;
  }

  getAllTransactions(): AlgorandTransaction[] {
    return this.allTransactions;
  }

  // Helper method to truncate account addresses for display
  static truncateAddress(address: string): string {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }
} 