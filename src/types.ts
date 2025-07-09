export interface Vote {
  voter: string;
  candidate: string;
  vote: 'yes' | 'no' | 'abstain';
  stake: number;
  timestamp: number;
  transactionId: string;
}

export interface Candidate {
  name: string;
  address: string;
  votes: Vote[];
  totalStake: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
}

export interface VotingStats {
  totalVotes: number;
  totalStake: number;
  uniqueVoters: number;
  participationRate: number;
}

export interface AlgorandTransaction {
  id: string;
  sender: string;
  'payment-transaction'?: {
    receiver: string;
    amount: number;
  };
  note?: string;
  'round-time': number;
}

export interface AlgorandAccount {
  address: string;
  amount: number;
  'amount-without-pending-rewards': number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
  }[];
} 