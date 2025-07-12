import { VotingService } from './votingService';
import { EChartsService } from './echartsService';
import { PopularityChartService } from './popularityChartService';
import * as echarts from 'echarts';

class VotingVisualization {
  private votingService: VotingService;
  private charts: Map<string, { stakeChart: echarts.ECharts; popularityChart: echarts.ECharts }> = new Map();
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

    if (totalVotesEl) totalVotesEl.textContent = stats.totalVotes.toLocaleString();
    if (totalStakeEl) totalStakeEl.textContent = stats.totalStake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (uniqueVotersEl) uniqueVotersEl.textContent = stats.uniqueVoters.toLocaleString();
    if (participationRateEl) participationRateEl.textContent = stats.participationRate.toFixed(1) + '%';
  }

  private createCharts(): void {
    const container = document.getElementById('charts-container');
    if (!container) return;

    console.log('Creating charts...');

    // Dispose existing charts to free memory
    this.disposeCharts();

    // Clear existing charts
    container.innerHTML = '';
    this.charts.clear();

    let candidates = this.votingService.getCandidates();
    console.log(`Found ${candidates.length} candidates`);

    // Sort by number of unique voters (descending)
    candidates = candidates.slice().sort((a, b) => {
      const aVoters = new Set(a.votes.map(v => v.voter)).size;
      const bVoters = new Set(b.votes.map(v => v.voter)).size;
      return bVoters - aVoters;
    });

    candidates.forEach(candidate => {
      console.log(`Processing candidate: ${candidate.name} with ${candidate.votes.length} votes`);
      
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
        container.appendChild(chartWrapper);
      } else {
        // Create charts grid
        const chartsGrid = document.createElement('div');
        chartsGrid.className = 'charts-grid';
        chartsGrid.style.alignItems = 'flex-start'; // top-align both columns

        // Create stake chart container
        const stakeChartContainer = document.createElement('div');
        stakeChartContainer.className = 'stake-chart';
        stakeChartContainer.id = `stake-chart-${candidate.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // Create popularity chart wrapper (for title and chart)
        const popularityWrapper = document.createElement('div');
        popularityWrapper.className = 'popularity-wrapper';
        popularityWrapper.style.display = 'flex';
        popularityWrapper.style.flexDirection = 'column';
        popularityWrapper.style.alignItems = 'center';
        popularityWrapper.style.width = '100%';

        // Create popularity chart title and vote counts
        const popTitle = document.createElement('div');
        popTitle.className = 'popularity-title';
        popTitle.style.color = '#20B2AA';
        popTitle.style.fontWeight = 'bold';
        popTitle.style.fontSize = '1.2rem';
        popTitle.style.marginBottom = '4px';
        popTitle.textContent = 'Popular vote';

        const popCounts = document.createElement('div');
        popCounts.className = 'popularity-counts';
        popCounts.style.color = '#aaa';
        popCounts.style.fontSize = '1rem';
        popCounts.style.marginBottom = '8px';
        // We'll fill this in after chart creation

        // Create popularity chart container
        const popularityChartContainer = document.createElement('div');
        popularityChartContainer.className = 'popularity-chart';
        popularityChartContainer.id = `popularity-chart-${candidate.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

        popularityWrapper.appendChild(popTitle);
        popularityWrapper.appendChild(popCounts);
        popularityWrapper.appendChild(popularityChartContainer);

        chartsGrid.appendChild(stakeChartContainer);
        chartsGrid.appendChild(popularityWrapper);
        chartWrapper.appendChild(chartsGrid);
        container.appendChild(chartWrapper);

        // Defer ECharts creation to next frame so containers have size
        requestAnimationFrame(() => {
          const votes = this.votingService.getCandidateVotes(candidate.name);
          const stakeChart = EChartsService.createStakeChart(stakeChartContainer, candidate, votes, this.votingService);
          // Create popularity chart with no title/subtext
          const popularityChart = PopularityChartService.createPopularityChart(
            popularityChartContainer,
            candidate,
            votes,
            this.votingService,
            { noTitle: true }
          );
          // Fill in vote counts
          const voterWeights = this.votingService.getVoterWeights();
          const registry = this.votingService.getVoterRegistry();
          const allVoterIds = Array.from(voterWeights.keys()).map(addr => registry.getId(addr));
          const voteMap = new Map();
          votes.forEach(vote => { voteMap.set(vote.voter, vote.vote); });
          const yesCount = allVoterIds.filter(id => voteMap.get(id) === 'yes').length;
          const abstainCount = allVoterIds.filter(id => voteMap.get(id) === 'abstain').length;
          const noCount = allVoterIds.filter(id => voteMap.get(id) === 'no').length;
          const noneCount = allVoterIds.filter(id => !voteMap.has(id)).length;
          popCounts.textContent = `Yes: ${yesCount}   Abstain: ${abstainCount}   No: ${noCount}   None: ${noneCount}`;
          this.charts.set(candidate.name, {
            stakeChart: stakeChart,
            popularityChart: popularityChart
          });
        });
      }
    });

    console.log('Charts creation completed');

    // Handle window resize for responsive charts
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize(): void {
    // Resize all charts when window size changes
    this.charts.forEach((chartContainers) => {
      chartContainers.stakeChart.resize();
      chartContainers.popularityChart.resize();
    });
  }

  private disposeCharts(): void {
    // Dispose all existing charts to free memory
    this.charts.forEach((chartContainers) => {
      chartContainers.stakeChart.dispose();
      chartContainers.popularityChart.dispose();
    });
  }

  private setupControls(): void {
    // Remove all logic related to log scale toggle, including:
    // - const logScaleToggle = ...
    // - logScaleToggle.addEventListener(...)
    // - this.toggleLogScaleOnAllCharts(...)
    // - private toggleLogScaleOnAllCharts(...)
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
    
    // Clean up ECharts instances
    this.disposeCharts();
    this.charts.clear();
    
    // Remove resize listener
    window.removeEventListener('resize', this.handleResize.bind(this));
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