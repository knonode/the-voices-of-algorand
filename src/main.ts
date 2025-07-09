import { VotingService } from './votingService';
import { PlotlyService } from './plotlyService';
import { PopularityChartService } from './popularityChartService';
import Plotly from 'plotly.js-dist-min';

class VotingVisualization {
  private votingService: VotingService;
  private charts: Map<string, { stakeChart: HTMLElement; popularityChart: HTMLElement }> = new Map();
  private updateInterval: number | null = null;

  constructor() {
    this.votingService = new VotingService();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadData();
      this.setupAutoRefresh();
      this.setupControls();
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
        // Create charts grid
        const chartsGrid = document.createElement('div');
        chartsGrid.className = 'charts-grid';
        
        // Create stake chart container
        const stakeChartContainer = document.createElement('div');
        stakeChartContainer.className = 'stake-chart';
        stakeChartContainer.id = `stake-chart-${candidate.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create popularity chart container
        const popularityChartContainer = document.createElement('div');
        popularityChartContainer.className = 'popularity-chart';
        popularityChartContainer.id = `popularity-chart-${candidate.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        chartsGrid.appendChild(stakeChartContainer);
        chartsGrid.appendChild(popularityChartContainer);
        chartWrapper.appendChild(chartsGrid);
        
        // Store chart containers for later reference
        this.charts.set(candidate.name, {
          stakeChart: stakeChartContainer,
          popularityChart: popularityChartContainer
        });
        
        // Create charts
        const votes = this.votingService.getCandidateVotes(candidate.name);
        PlotlyService.createStakeChart(stakeChartContainer, candidate, votes);
        PopularityChartService.createPopularityChart(popularityChartContainer, candidate, votes, this.votingService);
      }
      
      container.appendChild(chartWrapper);
    });
  }

  private setupControls(): void {
    const logScaleToggle = document.getElementById('log-scale-toggle') as HTMLInputElement;
    if (logScaleToggle) {
      logScaleToggle.addEventListener('change', (e) => {
        const useLogScale = (e.target as HTMLInputElement).checked;
        this.toggleLogScaleOnAllCharts(useLogScale);
      });
    }
  }

  private toggleLogScaleOnAllCharts(useLogScale: boolean): void {
    this.charts.forEach((chartContainers) => {
      PlotlyService.toggleLogScale(chartContainers.stakeChart, useLogScale);
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
    
    // Clean up Plotly charts
    this.charts.forEach((chartContainers) => {
      Plotly.purge(chartContainers.stakeChart);
      Plotly.purge(chartContainers.popularityChart);
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