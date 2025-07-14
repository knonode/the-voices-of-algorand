import { VotingService } from './votingService';
import { EChartsService } from './echartsService';
import { PopularityChartService } from './popularityChartService';
import { StatisticsService } from './statisticsService';
import { Candidate, Vote } from './types';
import * as echarts from 'echarts';
import confetti from 'canvas-confetti';

const GOVERNANCE_API_PERIODS_URL = 'https://governance.algorand.foundation/api/periods/active';

class VotingVisualization {
  private votingService: VotingService;
  private statisticsService: StatisticsService;
  private currentCharts: { stakeChart: echarts.ECharts; popularityChart: echarts.ECharts } | null = null;
  private nonVotersChart: echarts.ECharts | null = null;
  private stakeBreakdownChart: echarts.ECharts | null = null;
  private updateInterval: number | null = null;
  private racingBarChart: echarts.ECharts | null = null;
  private racingBarData: { timestamps: number[]; candidates: string[]; series: Record<string, number[]> } | null = null;
  private popularityData: { name: string; value: number; color: string }[] | null = null; // Property for final popularity data
  private popularityRacingData: { timestamps: number[]; candidates: string[]; series: Record<string, number[]> } | null = null; // New property for time-series popularity data
  private isPopularityView: boolean = false; // Property to track current view mode
  private racingBarTimer: number | null = null;
  private votingPeriod: { start: number; end: number } | null = null;
  private countdownInterval: number | null = null;
  private confettiTimeout: number | null = null;
  private winnerOverlay: HTMLElement | null = null;

  constructor() {
    this.votingService = new VotingService();
    this.statisticsService = new StatisticsService();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadData();
      this.setupCandidateDropdown();
      this.setupBreakdownDropdown();
      this.setupAutoRefresh();
      this.setupPopularVoteToggle();
      this.startCountdownTimer();
      this.createNonVotersChart();
    } catch (error) {
      this.showError('Failed to initialize voting visualization: ' + error);
    }
  }

  private async loadData(): Promise<void> {
    try {
      this.showLoading(true);
      await this.votingService.fetchAndProcessVotes();
      await this.fetchVotingPeriod();
      this.prepareRacingBarData();
      this.preparePopularityRacingData(); // Add this line to prepare popularity data
      this.updateStats();
      this.initRacingBarChart();
      this.setupRacingBarPlayButton(); // Add this line to initialize the play button
      this.showLoading(false);
    } catch (error) {
      this.showLoading(false);
      this.showError('Failed to load voting data: ' + error);
    }
  }

  private updateStats(): void {
    const stats = this.votingService.getVotingStats();
    const totalStakeEl = document.getElementById('total-stake');
    const uniqueVotersEl = document.getElementById('unique-voters');
    const participationRateEl = document.getElementById('participation-rate');
    if (totalStakeEl) totalStakeEl.textContent = stats.totalStake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (uniqueVotersEl) uniqueVotersEl.textContent = `${stats.uniqueVoters.toLocaleString()}`;
    if (participationRateEl) participationRateEl.textContent = stats.participationRate.toFixed(1) + '%';
  }

  private startCountdownTimer(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    const countdownEl = document.getElementById('total-votes');
    if (!countdownEl || !this.votingPeriod) return;
    const update = () => {
      const now = Date.now();
      const end = this.votingPeriod!.end;
      let diff = end - now;
      if (diff < 0) diff = 0;
      if (diff <= 60 * 1000) {
        // Last minute: show seconds
        const seconds = Math.floor(diff / 1000);
        countdownEl.textContent = `${seconds}s`;
        if (diff === 0) {
          this.triggerCelebration();
        }
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        countdownEl.textContent = `${hours}h ${minutes}m`;
      }
    };
    update();
    this.countdownInterval = window.setInterval(update, 1000);
  }

  private raiseConfettiZIndex(): void {
    // Find all confetti canvases and raise their z-index above the overlay
    document.querySelectorAll('canvas').forEach((canvas: any) => {
      if (canvas.style) {
        canvas.style.zIndex = '2147483647'; // One above overlay
        canvas.style.pointerEvents = 'none'; // Don't block clicks
      }
    });
  }

  private triggerCelebration(): void {
    if (this.confettiTimeout) return; // Prevent multiple triggers
    // Fire a lot of confetti: explode from different locations across the window
    const burst = (originX: number, originY: number) => {
      confetti({
        particleCount: 100,
        spread: 80,
        startVelocity: 45, // more natural
        gravity: 1.1, // falls faster
        scalar: 1.2,
        origin: { x: originX, y: originY },
        ticks: 100,
      });
      this.raiseConfettiZIndex();
    };
    // Explode from random locations across the window
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        for (let j = 0; j < 4; j++) {
          const x = Math.random() * 0.8 + 0.1; // avoid extreme edges
          const y = Math.random() * 0.7 + 0.1; // avoid extreme top/bottom
          burst(x, y);
        }
      }, i * 200);
    }
    // Show winner overlay after confetti
    this.confettiTimeout = window.setTimeout(() => {
      this.showWinnerOverlay();
    }, 4500);
  }

  private showWinnerOverlay(): void {
    if (this.winnerOverlay) return;
    // Get top 11 candidates from the final scoreboard
    let winners: string[] = [];
    if (this.racingBarData && this.racingBarData.candidates && this.racingBarData.series) {
      const latestIdx = this.racingBarData.timestamps.length - 1;
      const frameData = this.racingBarData.candidates.map((c: string, _: number) => ({
        name: c,
        value: this.racingBarData!.series[c][latestIdx],
      }));
      frameData.sort((a, b) => b.value - a.value);
      winners = frameData.slice(0, 11).map(d => d.name);
    }
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(10, 11, 22, 0.98)';
    overlay.style.zIndex = '2147483647'; // Max z-index for most browsers
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.gap = '2rem';
    overlay.style.pointerEvents = 'auto';
    // Title
    const title = document.createElement('div');
    title.textContent = '🏆 Council Winners! 🏆';
    title.style.fontSize = '3rem';
    title.style.color = '#FFD700';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '2rem';
    overlay.appendChild(title);
    // Winner names
    winners.forEach((name, idx) => {
      const winnerDiv = document.createElement('div');
      winnerDiv.textContent = name;
      winnerDiv.style.fontSize = '2.5rem';
      winnerDiv.style.color = '#FFD700';
      winnerDiv.style.fontWeight = 'bold';
      winnerDiv.style.opacity = '0';
      winnerDiv.style.transition = 'opacity 0.7s';
      winnerDiv.style.margin = '0.5rem 0';
      overlay.appendChild(winnerDiv);
      setTimeout(() => {
        winnerDiv.style.opacity = '1';
      }, 500 + idx * 400);
    });
    // Dismiss button
    const btn = document.createElement('button');
    btn.textContent = 'Close';
    btn.style.marginTop = '3rem';
    btn.style.fontSize = '1.5rem';
    btn.style.padding = '1rem 2.5rem';
    btn.style.background = '#20B2AA';
    btn.style.color = '#0A0B16';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.onclick = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      this.winnerOverlay = null;
    };
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
    this.winnerOverlay = overlay;
  }

  private setupCandidateDropdown(): void {
    const dropdown = document.getElementById('candidate-dropdown') as HTMLSelectElement;
    if (!dropdown) return;
    
    const candidates = this.votingService.getCandidates();
    
    // Sort by number of unique voters (descending)
    const sortedCandidates = candidates.slice().sort((a, b) => {
      const aVoters = new Set(a.votes.map(v => v.voter)).size;
      const bVoters = new Set(b.votes.map(v => v.voter)).size;
      return bVoters - aVoters;
    });

    dropdown.innerHTML = '';
    sortedCandidates.forEach(candidate => {
      const option = document.createElement('option');
      option.value = candidate.name;
      option.textContent = candidate.name;
      dropdown.appendChild(option);
    });

    dropdown.addEventListener('change', () => {
      if (dropdown.value) {
        this.showCandidateCharts(dropdown.value);
      } else {
        this.hideAllCharts();
      }
    });

    // Initialize with first candidate
    if (sortedCandidates.length > 0) {
      this.showCandidateCharts(sortedCandidates[0].name);
    }
  }

  private showCandidateCharts(candidateName: string): void {
    const candidate = this.votingService.getCandidates().find(c => c.name === candidateName);
    if (!candidate) return;

    // Update candidate info
    const candidateAddress = document.getElementById('candidate-address');
    const candidateInfo = document.getElementById('candidate-info');
    if (candidateAddress && candidateInfo) {
      candidateAddress.textContent = candidate.address;
      candidateInfo.style.display = 'block';
    }

    // Hide no votes message
    const noVotesMessage = document.getElementById('no-votes-message');
    if (noVotesMessage) {
      noVotesMessage.style.display = 'none';
    }

    if (candidate.votes.length === 0) {
      // Show no votes message
      if (noVotesMessage) {
        noVotesMessage.style.display = 'block';
      }
      this.hideChartsGrid();
      return;
    }

    // Show charts grid
    this.showChartsGrid();
    
    // Create charts
    this.createChartsForCandidate(candidate);
  }

  private showChartsGrid(): void {
    const chartsGrid = document.getElementById('charts-grid');
    if (chartsGrid) {
      chartsGrid.style.display = 'grid';
    }
  }

  private hideChartsGrid(): void {
    const chartsGrid = document.getElementById('charts-grid');
    if (chartsGrid) {
      chartsGrid.style.display = 'none';
    }
  }

  private hideAllCharts(): void {
    const candidateInfo = document.getElementById('candidate-info');
    const chartsGrid = document.getElementById('charts-grid');
    const noVotesMessage = document.getElementById('no-votes-message');
    
    if (candidateInfo) candidateInfo.style.display = 'none';
    if (chartsGrid) chartsGrid.style.display = 'none';
    if (noVotesMessage) noVotesMessage.style.display = 'none';
    
    // Dispose current charts
    this.disposeCurrentCharts();
  }

  private createChartsForCandidate(candidate: Candidate): void {
    // Dispose existing charts
    this.disposeCurrentCharts();

    const stakeChartContainer = document.getElementById('stake-chart-container');
    const popularityChartContainer = document.getElementById('popularity-chart-container');
    
    if (!stakeChartContainer || !popularityChartContainer) return;

    // Clear containers
    stakeChartContainer.innerHTML = '';
    popularityChartContainer.innerHTML = '';

    const votes = this.votingService.getCandidateVotes(candidate.name);
    
    // Create stake chart
    const stakeChart = EChartsService.createStakeChart(stakeChartContainer, candidate, votes, this.votingService);
    
    // Create popularity chart
    const popularityChart = PopularityChartService.createPopularityChart(
      popularityChartContainer,
      candidate,
      votes,
      this.votingService,
      { noTitle: true }
    );

    // Update popularity counts
    this.updatePopularityCounts(candidate, votes);

    // Store current charts
    this.currentCharts = {
      stakeChart: stakeChart,
      popularityChart: popularityChart
    };

    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private updatePopularityCounts(_candidate: Candidate, votes: Vote[]): void {
    const popCounts = document.getElementById('popularity-counts');
    if (!popCounts) return;

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
  }

  private handleResize(): void {
    if (this.currentCharts) {
      this.currentCharts.stakeChart.resize();
      this.currentCharts.popularityChart.resize();
    }
  }

  private disposeCurrentCharts(): void {
    if (this.currentCharts) {
      this.currentCharts.stakeChart.dispose();
      this.currentCharts.popularityChart.dispose();
      this.currentCharts = null;
    }
  }



  private showLoading(show: boolean): void {
    const container = document.getElementById('charts-container');
    if (!container) return;

    if (show) {
      // Instead of replacing the entire content, just show a loading overlay
      const loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'loading';
      loadingOverlay.textContent = 'Loading voting data...';
      loadingOverlay.style.position = 'absolute';
      loadingOverlay.style.top = '0';
      loadingOverlay.style.left = '0';
      loadingOverlay.style.right = '0';
      loadingOverlay.style.bottom = '0';
      loadingOverlay.style.backgroundColor = 'rgba(10, 11, 22, 0.9)';
      loadingOverlay.style.display = 'flex';
      loadingOverlay.style.alignItems = 'center';
      loadingOverlay.style.justifyContent = 'center';
      loadingOverlay.style.zIndex = '1000';
      
      container.style.position = 'relative';
      container.appendChild(loadingOverlay);
    } else {
      // Remove loading overlay
      const loadingOverlay = container.querySelector('.loading');
      if (loadingOverlay) {
        loadingOverlay.remove();
      }
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

  private createNonVotersChart(): void {
    const container = document.getElementById('non-voters-chart');
    if (!container) return;
    container.innerHTML = '';
    if (this.nonVotersChart) {
      this.nonVotersChart.dispose();
    }
    // Update chart title with total non-vote stake
    const nonVoters = this.statisticsService.getNonVoters(this.votingService);
    const totalNonVoteStake = nonVoters.reduce((sum, nonVoter) => sum + nonVoter.stake, 0);
    const chartTitleEl = container.parentElement?.querySelector('.chart-title');
    if (chartTitleEl) {
      chartTitleEl.textContent = `Non-Voters by Stake (Total: ${totalNonVoteStake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Algo)`;
    }
    this.nonVotersChart = this.statisticsService.createNonVotersChart(container, this.votingService);
    window.addEventListener('resize', () => {
      if (this.nonVotersChart) {
        this.nonVotersChart.resize();
      }
    });
  }

  private setupBreakdownDropdown(): void {
    const dropdown = document.getElementById('candidate-breakdown-dropdown') as HTMLSelectElement;
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
      { min: 101, max: 1000, label: '100-1K' },
      { min: 1001, max: 10000, label: '1K-10K' },
      { min: 10001, max: 100000, label: '10K-100K' },
      { min: 100001, max: 1000000, label: '100K-1M' },
      { min: 1000001, max: 10000000, label: '1M-10M' },
      { min: 10000001, max: 100000000, label: '10M-100M' }
    ];
    function formatStake(val: number): string {
      if (val >= 1_000_000) return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (val >= 1_000) return (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
      return val.toString();
    }
    const bucketData = buckets.map(bucket => {
      const votesInBucket = candidateVotes.filter(v => v.stake >= bucket.min && v.stake <= bucket.max);
      const totalStake = votesInBucket.reduce((sum, v) => sum + v.stake, 0);
      return {
        label: bucket.label,
        totalStake,
        yesStake: votesInBucket.filter(v => v.vote === 'yes').reduce((sum, v) => sum + v.stake, 0),
        noStake: votesInBucket.filter(v => v.vote === 'no').reduce((sum, v) => sum + v.stake, 0),
        abstainStake: votesInBucket.filter(v => v.vote === 'abstain').reduce((sum, v) => sum + v.stake, 0),
        voterCount: votesInBucket.length
      };
    });
    const labels = bucketData.map(b => b.label);
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
        abstainAbs: b.abstainStake,
        voterCount: b.voterCount
      };
    });
    this.stakeBreakdownChart = echarts.init(container);
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const idx = params.dataIndex;
          const b = marimekkoData[idx];
          function formatSmallStake(val: number): string {
            if (val > 0 && val < 1000) return '<1K';
            return formatStake(val);
          }
          return `<b>${b.label}</b><br/>Total stake: ${formatStake(b.totalStake)}` +
            `<br/>Voters: ${b.voterCount}` +
            `<br/>Yes: ${formatSmallStake(b.yesAbs)} (${(b.yes * 100).toFixed(1)}%)` +
            `<br/>No: ${formatSmallStake(b.noAbs)} (${(b.no * 100).toFixed(1)}%)` +
            `<br/>Abstain: ${formatSmallStake(b.abstainAbs)} (${(b.abstain * 100).toFixed(1)}%)`;
        }
      },
      // Legend removed - custom chart shows vote types with different colors
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
                style: { fill: seg.color, stroke: '#222', lineWidth: 1 } // FIXED: pass style directly
              } as any);
              yCurrent -= segHeight;
            }
          });
          return shapes.length === 1 ? shapes[0] : { type: 'group', children: shapes };
        },
        data: marimekkoData.map((_, idx) => idx),
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

  private async fetchVotingPeriod(): Promise<void> {
    try {
      const res = await fetch(GOVERNANCE_API_PERIODS_URL);
      const data = await res.json();
      console.log('Voting period API response:', data);
      if (data && data.voting_sessions && data.voting_sessions.length > 0) {
        this.votingPeriod = {
          start: new Date(data.voting_sessions[0].voting_start_datetime).getTime(),
          end: new Date(data.voting_sessions[0].voting_end_datetime).getTime(),
        };
      } else if (data && data.start_datetime && data.end_datetime) {
        this.votingPeriod = {
          start: new Date(data.start_datetime).getTime(),
          end: new Date(data.end_datetime).getTime(),
        };
      } else {
        // fallback: use current time as both start and end
        const now = Date.now();
        this.votingPeriod = { start: now, end: now };
      }
    } catch (e) {
      console.error('Failed to fetch voting period:', e);
      const now = Date.now();
      this.votingPeriod = { start: now, end: now };
    }
  }

  private prepareRacingBarData(): void {
    if (!this.votingPeriod) return;
    const { start, end } = this.votingPeriod;
    console.log('Voting period:', start, end, new Date(start).toLocaleString(), new Date(end).toLocaleString());
    const votes = this.votingService.getVotes();
    const candidates: string[] = Array.from(new Set(votes.map((v: any) => v.candidate)));
    
    // Build more granular time buckets for longer animation
    // Target ~200 frames for a ~60 second animation (300ms per frame)
    const targetFrames = 200;
    const interval = Math.max(Math.floor((end - start) / targetFrames), 5 * 60 * 1000); // 5 min minimum or target frames
    const timestamps: number[] = [];
    const now = Date.now();
    for (let t = start; t <= Math.min(end, now); t += interval) {
      timestamps.push(t);
    }
    
    console.log(`Created ${timestamps.length} time buckets with ${interval / (60 * 1000)} minute intervals`);
    
    // For each candidate, build net yes stake at each timestamp
    const series: Record<string, number[]> = {};
    candidates.forEach((candidate: string) => {
      let yesStake = 0, noStake = 0;
      let idx = 0;
      const candidateVotes = votes.filter((v: any) => v.candidate === candidate).sort((a: any, b: any) => a.timestamp - b.timestamp);
      let vIdx = 0;
      for (let t of timestamps) {
        while (vIdx < candidateVotes.length && candidateVotes[vIdx].timestamp <= t) {
          if (candidateVotes[vIdx].vote === 'yes') yesStake += candidateVotes[vIdx].stake;
          if (candidateVotes[vIdx].vote === 'no') noStake += candidateVotes[vIdx].stake;
          vIdx++;
        }
        if (!series[candidate]) series[candidate] = [];
        series[candidate].push(yesStake - noStake);
        idx++;
      }
    });
    this.racingBarData = { timestamps, candidates, series };
    console.log('prepareRacingBarData:', this.racingBarData);
  }

  private preparePopularityRacingData(): void {
    if (!this.votingPeriod) return;
    const { start, end } = this.votingPeriod;
    const votes = this.votingService.getVotes();
    const candidates: string[] = Array.from(new Set(votes.map((v: any) => v.candidate)));
    
    // Use the same timestamps as the stake-weighted chart for consistency
    const targetFrames = 200;
    const interval = Math.max(Math.floor((end - start) / targetFrames), 5 * 60 * 1000);
    const timestamps: number[] = [];
    const now = Date.now();
    for (let t = start; t <= Math.min(end, now); t += interval) {
      timestamps.push(t);
    }
    
    console.log(`Created ${timestamps.length} time buckets for popularity data`);
    
    // For each candidate, build net unique (YES - NO) voter counts at each timestamp
    const series: Record<string, number[]> = {};
    candidates.forEach((candidate: string) => {
      const uniqueYesAtTimestamp: Set<number>[] = timestamps.map(() => new Set<number>());
      const uniqueNoAtTimestamp: Set<number>[] = timestamps.map(() => new Set<number>());
      
      // Get all YES and NO votes for this candidate, sorted by timestamp
      const candidateVotes = votes
        .filter((v: any) => v.candidate === candidate && (v.vote === 'yes' || v.vote === 'no'))
        .sort((a: any, b: any) => a.timestamp - b.timestamp);
      
      candidateVotes.forEach(vote => {
        const voterID = vote.voter;
        const voteTime = vote.timestamp;
        const startIdx = timestamps.findIndex(t => t >= voteTime);
        if (startIdx === -1) return;
        for (let _ = startIdx; _ < timestamps.length; _++) {
          if (vote.vote === 'yes') uniqueYesAtTimestamp[_].add(voterID);
          if (vote.vote === 'no') uniqueNoAtTimestamp[_].add(voterID);
        }
      });
      // Net unique votes = YES - NO
      series[candidate] = uniqueYesAtTimestamp.map((yesSet, _) => yesSet.size - uniqueNoAtTimestamp[_].size);
    });
    
    this.popularityRacingData = { timestamps, candidates, series };
    console.log('preparePopularityRacingData:', this.popularityRacingData);
  }

  private formatStake(val: number): string {
    const absVal = Math.abs(val);
    if (absVal >= 1_000_000_000) return (val / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + 'B';
    if (absVal >= 1_000_000) return (val / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
    if (absVal >= 1_000) return (val / 1_000).toFixed(2).replace(/\.00$/, '') + 'K';
    return Math.round(val).toString();
  }

  private updateTimeCounter(timestamp: number): void {
    const timeCounter = document.getElementById('racing-bar-time-counter');
    if (!timeCounter) return;
    
    const date = new Date(timestamp);
    const formattedTime = date.toLocaleString();
    timeCounter.textContent = `Time: ${formattedTime}`;
  }

  private updateProgressIndicator(timestamp: number): void {
    const progressElement = document.getElementById('racing-bar-progress');
    if (!progressElement || !this.votingPeriod) return;
    
    const { start, end } = this.votingPeriod;
    const totalDuration = end - start;
    const elapsed = timestamp - start;
    const percentage = Math.min(Math.max(Math.round((elapsed / totalDuration) * 100), 0), 100);
    progressElement.textContent = `Progress: ${percentage}%`;
  }

  private initRacingBarChart(): void {
    const container = document.getElementById('racing-bar-chart');
    if (!container || !this.racingBarData) return;
    if (this.racingBarChart) this.racingBarChart.dispose();
    const { candidates, series, timestamps } = this.racingBarData as { timestamps: number[]; candidates: string[]; series: Record<string, number[]> };
    // Show latest frame by default
    const latestIdx = timestamps.length - 1;
    
    // Update time counter with the latest timestamp
    this.updateTimeCounter(timestamps[latestIdx]);
    
    // Update progress indicator to show progress for latest timestamp
    this.updateProgressIndicator(timestamps[latestIdx]);
    
    // Build and sort data by net yes stake descending (highest at top)
    const frameData = candidates.map((c: string, i: number) => {
      const value = series[c][latestIdx];
      return {
        name: c,
        value,
        color: value < 0 ? '#FF6B6B' : '#90EE90',
        stake: value
      };
    });
    frameData.sort((a, b) => b.value - a.value);
    // Insert separator between rank 11 and 12
    const sortedCandidates = frameData.map(d => d.name);
    if (sortedCandidates.length > 11) {
      sortedCandidates.splice(11, 0, '---COUNCIL_SEAT_CUTOFF---');
      frameData.splice(11, 0, { name: '---COUNCIL_SEAT_CUTOFF---', value: 0, color: 'rgba(0,0,0,0.01)', stake: 0 });
    }
    // Find max absolute value for axis
    const maxAbs = Math.max(1, ...frameData.map(d => Math.abs(d.value)));
    this.racingBarChart = echarts.init(container);
    const option: echarts.EChartsOption = {
      grid: { left: 40, right: 40, top: 60, bottom: 40, containLabel: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: Math.ceil(maxAbs * 1.1),
        show: true,
        axisLabel: {
          color: '#20B2AA',
          formatter: (val: number) => this.formatStake(val)
        }
      },
      yAxis: {
        type: 'category',
        data: sortedCandidates,
        inverse: true,
        axisLabel: { color: '#20B2AA' }
      },
      series: [{
        type: 'bar',
        data: frameData.map(d => ({
          value: Math.abs(d.value),
          itemStyle: {
            color: d.name === '---COUNCIL_SEAT_CUTOFF---' ? 'rgba(0,0,0,0.01)' : d.color
          },
          stake: d.stake
        })),
        barCategoryGap: '30%',
        itemStyle: { borderRadius: 0 },
        label: {
          show: true,
          position: 'right',
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: 'normal',
          fontFamily: 'inherit',
          formatter: (params: any) => {
            if (params.name === '---COUNCIL_SEAT_CUTOFF---') return '';
            return `${params.data.stake >= 0 ? '' : '-'}${this.formatStake(Math.abs(params.data.stake))}`;
          }
        },
        z: 2,
        markLine: sortedCandidates.includes('---COUNCIL_SEAT_CUTOFF---') ? {
          symbol: ['none', 'none'],
          lineStyle: {
            color: '#096b4f',
            width: 3,
            type: 'solid'
          },
          data: [
            {
              yAxis: '---COUNCIL_SEAT_CUTOFF---',
              label: { show: false }
            }
          ]
        } : undefined
      }],
      animationDuration: 300,
      animationDurationUpdate: 300,
      animationEasing: 'linear',
      animationEasingUpdate: 'linear',
      backgroundColor: 'transparent',
      title: undefined
    };
    this.racingBarChart.setOption(option);
  }

  private setupRacingBarPlayButton(): void {
    const btn = document.getElementById('racing-bar-play-btn');
    if (!btn || !this.racingBarData) return;
    btn.onclick = () => {
      if (this.racingBarTimer) {
        clearInterval(this.racingBarTimer);
        this.racingBarTimer = null;
        btn.textContent = 'Play';
        return;
      }
      btn.textContent = 'Pause';
      
      // Different animation logic based on the current view
      if (this.isPopularityView) {
        this.animatePopularityChart();
      } else {
        this.animateStakeWeightedChart();
      }
    };
  }
  
  private animateStakeWeightedChart(): void {
    if (!this.racingBarData || !this.racingBarChart) return;
    
    let frame = 0;
    const { candidates, series, timestamps } = this.racingBarData;
    
    // Reset progress indicator to 0% (start of voting period)
    this.updateProgressIndicator(timestamps[0]);
    
    this.racingBarTimer = window.setInterval(() => {
      if (!this.racingBarChart) return;
      if (frame >= timestamps.length) {
        clearInterval(this.racingBarTimer!);
        this.racingBarTimer = null;
        const btn = document.getElementById('racing-bar-play-btn');
        if (btn) btn.textContent = 'Play';
        return;
      }
      
      // Update time counter with current frame timestamp
      this.updateTimeCounter(timestamps[frame]);
      
      // Update progress indicator based on current timestamp
      this.updateProgressIndicator(timestamps[frame]);
      
      // Build and sort data by net yes stake (yes - no) descending
      const frameData = candidates.map((c: string, i: number) => {
        const value = series[c][frame];
        return {
          name: c,
          value,
          color: value < 0 ? '#FF6B6B' : '#90EE90',
          stake: value
        };
      });
      frameData.sort((a, b) => b.value - a.value);
      
      // Insert separator between rank 11 and 12 (council seat cutoff)
      const sortedCandidates = frameData.map(d => d.name);
      if (sortedCandidates.length > 11 && !sortedCandidates.includes('---COUNCIL_SEAT_CUTOFF---')) {
        sortedCandidates.splice(11, 0, '---COUNCIL_SEAT_CUTOFF---');
        frameData.splice(11, 0, {
          name: '---COUNCIL_SEAT_CUTOFF---',
          value: 0,
          color: 'rgba(0,0,0,0.01)',
          stake: 0
        });
      }
      // Find max absolute value for axis
      const maxAbs = Math.max(1, ...frameData.map(d => Math.abs(d.value)));
      this.racingBarChart.setOption({
        xAxis: {
          type: 'value',
          min: 0,
          max: Math.ceil(maxAbs * 1.1),
          show: true,
          axisLabel: {
            color: '#20B2AA',
            formatter: (val: number) => this.formatStake(val)
          }
        },
        yAxis: {
          type: 'category',
          data: sortedCandidates,
          inverse: true,
          axisLabel: {
            color: '#20B2AA',
          }
        },
        series: [{
          type: 'bar',
          data: frameData.map(d => ({
            value: Math.abs(d.value),
            itemStyle: {
              color: d.name === '---COUNCIL_SEAT_CUTOFF---' ? 'rgba(0,0,0,0.01)' : d.color
            },
            stake: d.stake
          })),
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => {
              if (params.name === '---COUNCIL_SEAT_CUTOFF---') return '';
              return `${params.data.stake >= 0 ? '' : '-'}${this.formatStake(Math.abs(params.data.stake))}`;
            },
            color: '#FFFFFF'
          },
          markLine: sortedCandidates.includes('---COUNCIL_SEAT_CUTOFF---') ? {
            symbol: ['none', 'none'],
            lineStyle: {
              color: '#096b4f',
              width: 3,
              type: 'solid'
            },
            data: [
              {
                yAxis: '---COUNCIL_SEAT_CUTOFF---',
                label: { show: false }
              }
            ]
          } : undefined
        }]
      });
      
      frame++;
    }, 500);
  }
  
  private animatePopularityChart(): void {
    if (!this.popularityRacingData || !this.racingBarChart) return;
    
    const { timestamps, candidates, series } = this.popularityRacingData;
    let frame = 0;
    const totalFrames = timestamps.length;
    
    // Reset progress indicator to 0%
    if (timestamps && timestamps.length > 0) {
      this.updateProgressIndicator(timestamps[0]);
    }
    
    this.racingBarTimer = window.setInterval(() => {
      if (!this.racingBarChart || !this.popularityRacingData || frame >= totalFrames) {
        if (this.racingBarTimer) {
          clearInterval(this.racingBarTimer);
          this.racingBarTimer = null;
          const playBtn = document.getElementById('racing-bar-play-btn');
          if (playBtn) playBtn.textContent = 'Play';
        }
        return;
      }
      
      // Update time counter and progress indicator
      this.updateTimeCounter(timestamps[frame]);
      this.updateProgressIndicator(timestamps[frame]);
      
      // Build frame data for current timestamp
      const frameData = candidates.map((c: string) => {
        const value = series[c][frame];
        return {
          name: c,
          value,
          color: value < 0 ? '#FF6B6B' : '#90EE90'
        };
      });
      
      // Sort by net votes (highest at top)
      frameData.sort((a, b) => b.value - a.value);
      
      // No council seat cutoff bar in popular vote leaderboard
      const sortedCandidates = frameData.map(d => d.name);
      // Find max absolute value for axis
      const maxAbs = Math.max(1, ...frameData.map(d => Math.abs(d.value)));
      // Update chart
      this.racingBarChart.setOption({
        xAxis: {
          type: 'value',
          min: 0,
          max: Math.ceil(maxAbs * 1.1),
          show: true,
          axisLabel: {
            color: '#20B2AA',
          }
        },
        yAxis: {
          type: 'category',
          data: sortedCandidates,
          inverse: true,
          axisLabel: {
            color: '#20B2AA',
          }
        },
        series: [{
          type: 'bar',
          data: frameData.map(d => ({
            value: Math.abs(d.value),
            itemStyle: {
              color: d.color
            }
          })),
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => `${params.data.value >= 0 ? '' : '-'}${Math.abs(params.data.value)} votes`,
            color: '#FFFFFF'
          }
        }]
      });
      
      frame++;
    }, 500); // Same interval as stake-weighted animation
  }
  
  private setupPopularVoteToggle(): void {
    const playButtonContainer = document.querySelector('#racing-bar-chart-wrapper div');
    if (!playButtonContainer) return;
    
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-popular-vote-btn';
    toggleButton.textContent = 'Show Popular Vote';
    toggleButton.style.padding = '8px 24px';
    toggleButton.style.borderRadius = '6px';
    toggleButton.style.border = '1px solid #48D1CC';
    toggleButton.style.background = 'transparent';
    toggleButton.style.color = '#20B2AA';
    toggleButton.style.fontSize = '1rem';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.marginLeft = '10px';
    
    playButtonContainer.appendChild(toggleButton);
    
    toggleButton.addEventListener('click', () => {
      // Stop any running animation
      if (this.racingBarTimer) {
        clearInterval(this.racingBarTimer);
        this.racingBarTimer = null;
        const playBtn = document.getElementById('racing-bar-play-btn');
        if (playBtn) playBtn.textContent = 'Play';
      }
      
      const isPopularView = toggleButton.textContent === 'Show Stake Weighted';
      if (isPopularView) {
        toggleButton.textContent = 'Show Popular Vote';
        const titleElement = document.querySelector('#racing-bar-chart-wrapper h2');
        if (titleElement) titleElement.textContent = 'Stake Weighted Leaderboard';
        this.isPopularityView = false;
        this.initRacingBarChart();
      } else {
        toggleButton.textContent = 'Show Stake Weighted';
        const titleElement = document.querySelector('#racing-bar-chart-wrapper h2');
        if (titleElement) titleElement.textContent = 'Popular Vote Leaderboard';
        this.isPopularityView = true;
        this.createPopularVoteLeaderboard();
      }
    });
  }

  private createPopularVoteLeaderboard(): void {
    const container = document.getElementById('racing-bar-chart');
    if (!container || !this.popularityRacingData) return;
    
    // Dispose existing chart
    if (this.racingBarChart) this.racingBarChart.dispose();
    
    const { candidates, series, timestamps } = this.popularityRacingData;
    // Show latest frame by default
    const latestIdx = timestamps.length - 1;
    
    // Update time counter with the latest timestamp
    this.updateTimeCounter(timestamps[latestIdx]);
    
    // Update progress indicator to show progress for latest timestamp
    this.updateProgressIndicator(timestamps[latestIdx]);
    
    // Build and sort data by net votes descending
    this.popularityData = candidates.map((c: string, i: number) => ({ 
      name: c, 
      value: series[c][latestIdx], 
      color: series[c][latestIdx] < 0 ? '#FF6B6B' : '#90EE90'
    }));
    
    // Sort by net votes (highest at top)
    this.popularityData.sort((a, b) => b.value - a.value);
    
    // No council seat cutoff bar in popular vote leaderboard
    // Find max absolute value for axis
    const maxAbs = Math.max(1, ...this.popularityData.map(d => Math.abs(d.value)));
    // Create chart
    this.racingBarChart = echarts.init(container);
    
    const option: echarts.EChartsOption = {
      grid: { left: 40, right: 40, top: 60, bottom: 40, containLabel: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: Math.ceil(maxAbs * 1.1), // Add 10% for spacing
        show: true,
        axisLabel: {
          color: '#20B2AA',
        }
      },
      yAxis: {
        type: 'category',
        data: this.popularityData.map(d => d.name),
        inverse: true,
        axisLabel: {
          color: '#20B2AA',
        }
      },
      series: [
        {
          type: 'bar',
          data: this.popularityData.map(d => ({
            value: Math.abs(d.value),
            itemStyle: {
              color: d.color
            }
          })),
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => `${params.data.value >= 0 ? '' : '-'}${Math.abs(params.data.value)} votes`,
            color: '#FFFFFF'
          }
        }
      ],
      title: {
        text: 'Popular Vote (Net Unique Voters)',
        left: 'center',
        top: 10,
        textStyle: {
          color: '#20B2AA',
          fontSize: 18
        }
      }
    };
    
    this.racingBarChart.setOption(option);
  }

  public destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    if (this.racingBarTimer) {
      clearInterval(this.racingBarTimer);
    }
    if (this.confettiTimeout) {
      clearTimeout(this.confettiTimeout);
    }
    
    this.disposeCurrentCharts();
    
    // Remove resize listener
    window.removeEventListener('resize', this.handleResize.bind(this));
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new VotingVisualization();
  (window as any).__xgovApp = app; // Expose for debugging/testing
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  // Cleanup will be handled by garbage collection
}); 