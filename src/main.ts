import { VotingService } from './votingService';
import { ChartService } from './chartService';

class VotingVisualization {
  private votingService: VotingService;
  private charts: Map<string, any> = new Map();
  private updateInterval: number | null = null;

  constructor() {
    this.votingService = new VotingService();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadData();
      this.setupAutoRefresh();
    } catch (error) {
      this.showError('Failed to initialize voting visualization: ' + error);
    }
  }

  private async loadData(): Promise<void> {
    try {
      this.showLoading(true);
      
      await this.votingService.fetchAndProcessVotes();
      
      this.updateStats();
      this.createCharts();
      this.updateLastUpdated();
      
      this.showLoading(false);
    } catch (error) {
      this.showError('Failed to load voting data: ' + error);
      this.showLoading(false);
    }
  }

  private updateStats(): void {
    const stats = this.votingService.getVotingStats();
    
    const totalVotesEl = document.getElementById('total-votes');
    const totalStakeEl = document.getElementById('total-stake');
    const uniqueVotersEl = document.getElementById('unique-voters');
    const participationRateEl = document.getElementById('participation-rate');

    if (totalVotesEl) totalVotesEl.textContent = stats.totalVotes.toString();
    if (totalStakeEl) totalStakeEl.textContent = stats.totalStake.toFixed(2);
    if (uniqueVotersEl) uniqueVotersEl.textContent = stats.uniqueVoters.toString();
    if (participationRateEl) participationRateEl.textContent = stats.participationRate.toFixed(1) + '%';
  }

  private createCharts(): void {
    const container = document.getElementById('charts-container');
    if (!container) return;

    // Clear existing charts
    container.innerHTML = '';
    this.charts.clear();

    let candidates = this.votingService.getCandidates();

    // Sort by number of unique voters (descending)
    candidates = candidates.slice().sort((a, b) => {
      const aVoters = new Set(a.votes.map(v => v.voter)).size;
      const bVoters = new Set(b.votes.map(v => v.voter)).size;
      return bVoters - aVoters;
    });

    candidates.forEach(candidate => {
      const chartWrapper = document.createElement('div');
      chartWrapper.className = 'chart-wrapper';
      
      const chartTitle = document.createElement('h3');
      chartTitle.className = 'chart-title';
      chartTitle.textContent = candidate.name;
      
      // Add candidate address under the name
      const chartAddress = document.createElement('div');
      chartAddress.className = 'chart-address';
      chartAddress.textContent = candidate.address;
      chartAddress.style.textAlign = 'center';
      chartAddress.style.color = '#20B2AA';
      chartAddress.style.fontSize = '0.95rem';
      chartAddress.style.marginBottom = '10px';
      
      chartWrapper.appendChild(chartTitle);
      chartWrapper.appendChild(chartAddress);

      if (candidate.votes.length === 0) {
        // Show message for candidates with no votes
        const noVotesMsg = document.createElement('div');
        noVotesMsg.style.textAlign = 'center';
        noVotesMsg.style.color = '#888';
        noVotesMsg.style.fontSize = '1.1rem';
        noVotesMsg.style.marginTop = '120px';
        noVotesMsg.textContent = 'No votes yet';
        chartWrapper.appendChild(noVotesMsg);
      } else {
        const canvas = document.createElement('canvas');
        chartWrapper.appendChild(canvas);
        // Create chart
        const votes = this.votingService.getCandidateVotes(candidate.name);
        const chart = ChartService.createCandidateChart(canvas, candidate, votes);
        this.charts.set(candidate.name, chart);
      }
      container.appendChild(chartWrapper);
    });
  }

  private updateLastUpdated(): void {
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl) {
      const now = new Date();
      lastUpdatedEl.textContent = now.toLocaleString();
    }
  }

  private showLoading(show: boolean): void {
    const container = document.getElementById('charts-container');
    if (!container) return;

    if (show) {
      container.innerHTML = '<div class="loading">Loading voting data...</div>';
    }
  }

  private showError(message: string): void {
    const container = document.getElementById('charts-container');
    if (!container) return;

    container.innerHTML = `<div class="error">${message}</div>`;
  }

  private setupAutoRefresh(): void {
    // Refresh every hour (3600000 ms)
    this.updateInterval = window.setInterval(() => {
      this.loadData();
    }, 3600000);
  }

  public destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Destroy all charts
    this.charts.forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.charts.clear();
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new VotingVisualization();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  // Cleanup will be handled by garbage collection
}); 