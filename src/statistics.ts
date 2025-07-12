import { VotingService } from './votingService';
import { StatisticsService } from './statisticsService';
import * as echarts from 'echarts';

class StatisticsVisualization {
  private votingService: VotingService;
  private statisticsService: StatisticsService;
  private nonVotersChart: echarts.ECharts | null = null;
  private stakeBreakdownChart: echarts.ECharts | null = null;
  private updateInterval: number | null = null;

  constructor() {
    this.votingService = new VotingService();
    this.statisticsService = new StatisticsService();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadData();
      this.setupAutoRefresh();
      this.setupCandidateDropdown();
    } catch (error) {
      this.showError('Failed to initialize statistics visualization: ' + error);
    }
  }

  private async loadData(): Promise<void> {
    try {
      this.showLoading(true);
      
      await this.votingService.fetchAndProcessVotes();
      
      this.updateStats();
      this.createNonVotersChart();
      this.updateLastUpdated();
      
      this.showLoading(false);
    } catch (error) {
      this.showError('Failed to load statistics data: ' + error);
      this.showLoading(false);
    }
  }

  private updateStats(): void {
    const stats = this.statisticsService.getStatistics(this.votingService);
    
    const totalRegisteredEl = document.getElementById('total-registered');
    const totalVotedEl = document.getElementById('total-voted');
    const totalNonVotersEl = document.getElementById('total-non-voters');
    const participationRateEl = document.getElementById('participation-rate');

    if (totalRegisteredEl) totalRegisteredEl.textContent = stats.totalRegistered.toLocaleString();
    if (totalVotedEl) totalVotedEl.textContent = stats.totalVoted.toLocaleString();
    if (totalNonVotersEl) totalNonVotersEl.textContent = stats.totalNonVoters.toLocaleString();
    if (participationRateEl) participationRateEl.textContent = stats.participationRate.toFixed(1) + '%';
  }

  private createNonVotersChart(): void {
    const container = document.getElementById('non-voters-chart');
    if (!container) return;

    // Clear loading message
    container.innerHTML = '';

    // Dispose existing chart
    if (this.nonVotersChart) {
      this.nonVotersChart.dispose();
    }

    // Update chart title with total non-vote stake
    const nonVoters = this.statisticsService.getNonVoters(this.votingService);
    const totalNonVoteStake = nonVoters.reduce((sum, nonVoter) => sum + nonVoter.stake, 0);
    const chartTitleEl = document.querySelector('.chart-title');
    if (chartTitleEl) {
      chartTitleEl.textContent = `Non-Voters by Stake (Total: ${totalNonVoteStake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ALGO)`;
    }

    // Create new chart
    this.nonVotersChart = this.statisticsService.createNonVotersChart(container, this.votingService);

    // Handle window resize
    window.addEventListener('resize', () => {
      if (this.nonVotersChart) {
        this.nonVotersChart.resize();
      }
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
    const container = document.getElementById('non-voters-chart');
    if (!container) return;

    if (show) {
      container.innerHTML = '<div class="loading">Loading statistics data...</div>';
    }
  }

  private showError(message: string): void {
    const container = document.getElementById('non-voters-chart');
    if (!container) return;

    container.innerHTML = `<div class="error">${message}</div>`;
  }

  private setupAutoRefresh(): void {
    // Refresh every hour (3600000 ms)
    this.updateInterval = window.setInterval(() => {
      this.loadData();
    }, 3600000);
  }

  private setupCandidateDropdown(): void {
    const dropdown = document.getElementById('candidate-dropdown') as HTMLSelectElement;
    if (!dropdown) return;
    const candidates = this.votingService.getCandidates();
    dropdown.innerHTML = '';
    candidates.forEach(candidate => {
      const option = document.createElement('option');
      option.value = candidate.name;
      option.textContent = candidate.name;
      dropdown.appendChild(option);
    });
    dropdown.addEventListener('change', () => {
      this.createStakeBreakdownChart(dropdown.value);
    });
    // Initialize with first candidate
    if (candidates.length > 0) {
      this.createStakeBreakdownChart(candidates[0].name);
    }
  }

  private createStakeBreakdownChart(candidateName: string): void {
    const container = document.getElementById('stake-vote-breakdown-chart');
    if (!container) return;
    container.innerHTML = '';
    if (this.stakeBreakdownChart) {
      this.stakeBreakdownChart.dispose();
    }
    const candidateVotes = this.votingService.getCandidateVotes(candidateName);
    // Define stake buckets
    const buckets = [
      { min: 0, max: 100, label: '0-100' },
      { min: 101, max: 1000, label: '101-1,000' },
      { min: 1001, max: 10000, label: '1,001-10,000' },
      { min: 10001, max: 100000, label: '10,001-100,000' },
      { min: 100001, max: 1000000, label: '100,001-1,000,000' },
      { min: 1000001, max: 10000000, label: '1,000,001-10,000,000' },
      { min: 10000001, max: 100000000, label: '10,000,001-100,000,000' }
    ];
    // Helper to format stake
    function formatStake(val: number): string {
      if (val >= 1_000_000) return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (val >= 1_000) return (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
      return val.toString();
    }
    // Helper to format bucket label
    function formatBucketLabel(label: string): string {
      // e.g. '10,001-100,000' => '10K-100K', '1,000,001-10,000,000' => '1M-10M'
      const match = label.match(/(\d{1,3}(?:,\d{3})*|\d+)-(\d{1,3}(?:,\d{3})*|\d+)/);
      if (match) {
        const left = formatStake(parseInt(match[1].replace(/,/g, '')));
        const right = formatStake(parseInt(match[2].replace(/,/g, '')));
        return `${left}-${right}`;
      }
      return label;
    }
    // Group votes by bucket
    const bucketData = buckets.map(bucket => {
      const votesInBucket = candidateVotes.filter(v => v.stake >= bucket.min && v.stake <= bucket.max);
      const totalStake = votesInBucket.reduce((sum, v) => sum + v.stake, 0);
      return {
        label: bucket.label,
        totalStake,
        yesStake: votesInBucket.filter(v => v.vote === 'yes').reduce((sum, v) => sum + v.stake, 0),
        noStake: votesInBucket.filter(v => v.vote === 'no').reduce((sum, v) => sum + v.stake, 0),
        abstainStake: votesInBucket.filter(v => v.vote === 'abstain').reduce((sum, v) => sum + v.stake, 0)
      };
    });
    // Prepare Marimekko-style data
    const labels = bucketData.map(b => formatBucketLabel(b.label));
    // For each bucket, calculate segment proportions
    const marimekkoData = bucketData.map(b => {
      const total = b.yesStake + b.noStake + b.abstainStake;
      return {
        label: b.label,
        totalStake: b.totalStake,
        yes: total ? b.yesStake / total : 0,
        no: total ? b.noStake / total : 0,
        abstain: total ? b.abstainStake / total : 0,
        yesAbs: b.yesStake,
        noAbs: b.noStake,
        abstainAbs: b.abstainStake
      };
    });
    this.stakeBreakdownChart = echarts.init(container);
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const idx = params.dataIndex;
          const b = marimekkoData[idx];
          return `<b>${formatBucketLabel(b.label)}</b><br/>Total stake: ${formatStake(b.totalStake)} ALGO` +
            `<br/>Yes: ${formatStake(b.yesAbs)} (${(b.yes * 100).toFixed(1)}%)` +
            `<br/>No: ${formatStake(b.noAbs)} (${(b.no * 100).toFixed(1)}%)` +
            `<br/>Abstain: ${formatStake(b.abstainAbs)} (${(b.abstain * 100).toFixed(1)}%)`;
        }
      },
      legend: { data: ['Yes', 'No', 'Abstain'], top: 10, textStyle: { color: '#20B2AA' } },
      grid: { left: 40, right: 20, top: 50, bottom: 60, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#20B2AA', fontSize: 12, interval: 0 },
        axisLine: { lineStyle: { color: 'rgba(32, 178, 170, 0.2)' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'log',
        name: 'Stake (ALGO)',
        min: 1,
        max: 50000000,
        axisLabel: { color: '#20B2AA', formatter: (value: number) => formatStake(value) },
        nameTextStyle: { color: '#20B2AA' },
        splitLine: { lineStyle: { color: 'rgba(32, 178, 170, 0.1)' } }
      },
      series: [{
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const idx = params.dataIndex;
          const b = marimekkoData[idx];
          if (!b.totalStake || b.totalStake <= 0) return null; // skip empty buckets
          const x = api.coord([idx, 0])[0];
          const barWidth = 48;
          const yBase = api.coord([0, 1])[1]; // bottom of the chart (log scale)
          const yTop = api.coord([0, b.totalStake])[1]; // top of the bar
          const totalHeight = yBase - yTop;
          let yCurrent = yBase;
          const segments = [
            { key: 'yes', color: '#90EE90', value: b.yes },
            { key: 'no', color: '#FFB6C1', value: b.no },
            { key: 'abstain', color: '#F0E68C', value: b.abstain }
          ];
          const shapes: any[] = [];
          segments.forEach(seg => {
            let segHeight = totalHeight * seg.value;
            if (seg.value > 0 && segHeight < 2) segHeight = 2; // minimum height for visibility
            if (seg.value > 0) {
              shapes.push({
                type: 'rect',
                shape: {
                  x: x - barWidth / 2,
                  y: yCurrent - segHeight,
                  width: barWidth,
                  height: segHeight
                },
                style: api.style({ fill: seg.color, stroke: '#222', lineWidth: 1 })
              } as any);
              yCurrent -= segHeight;
            }
          });
          return shapes.length === 1 ? shapes[0] : { type: 'group', children: shapes };
        },
        data: marimekkoData.map((_, i) => i),
        encode: {},
        z: 2
      }],
      backgroundColor: 'transparent',
      animation: false
    };
    this.stakeBreakdownChart.setOption(option);
    window.addEventListener('resize', () => {
      if (this.stakeBreakdownChart) {
        this.stakeBreakdownChart.resize();
      }
    });
  }

  public destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.nonVotersChart) {
      this.nonVotersChart.dispose();
    }
    if (this.stakeBreakdownChart) {
      this.stakeBreakdownChart.dispose();
    }
  }
}

// Initialize the application
const app = new StatisticsVisualization();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  app.destroy();
}); 