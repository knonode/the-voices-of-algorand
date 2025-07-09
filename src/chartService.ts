import { Chart } from 'chart.js/auto';
import { Candidate, Vote } from './types';
import { VotingService } from './votingService';

export class ChartService {
  private static readonly COLORS = {
    yes: '#90EE90',      // Soft green
    no: '#FFB6C1',       // Soft red
    abstain: '#F0E68C',  // Soft yellow
    border: '#48D1CC'    // Teal border
  };

  static createCandidateChart(
    canvas: HTMLCanvasElement,
    _candidate: Candidate,
    votes: Vote[]
  ): Chart {
    // Group votes by voter
    const voterGroups = new Map<string, { yes: number; no: number; abstain: number; total: number }>();
    
    votes.forEach(vote => {
      if (!voterGroups.has(vote.voter)) {
        voterGroups.set(vote.voter, { yes: 0, no: 0, abstain: 0, total: 0 });
      }
      
      const group = voterGroups.get(vote.voter)!;
      group[vote.vote] += vote.stake;
      group.total += vote.stake;
    });

    // Convert to array and sort by total stake (biggest first)
    const sortedVoters = Array.from(voterGroups.entries())
      .sort(([, a], [, b]) => b.total - a.total);

    // Prepare chart data - separate datasets for better control
    const labels: string[] = [];
    const yesData: number[] = [];
    const noData: number[] = [];
    const abstainData: number[] = [];

    sortedVoters.forEach(([voter, stakes]) => {
      // Exclude voters with all zero votes
      if (stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0) return;
      // Only display voters with total stake >= 10,000 Algo (visual filter only)
      if (stakes.total < 10000) return;
      labels.push(VotingService.truncateAddress(voter));
      yesData.push(stakes.yes);
      noData.push(-stakes.no); // Negative for downward bars
      abstainData.push(stakes.abstain);
    });

    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Yes',
            data: yesData,
            backgroundColor: this.COLORS.yes,
            yAxisID: 'y'
          },
          {
            label: 'No',
            data: noData,
            backgroundColor: this.COLORS.no,
            yAxisID: 'y'
          },
          {
            label: 'Abstain',
            data: abstainData,
            backgroundColor: this.COLORS.abstain,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: false,
            text: '',
            color: '#008080',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: false,
            labels: {
              color: '#20B2AA',
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(18, 18, 18, 0.9)',
            titleColor: '#008080',
            bodyColor: '#20B2AA',
            borderColor: '#48D1CC',
            borderWidth: 1,
            callbacks: {
              title: (context) => {
                const dataIndex = context[0].dataIndex;
                const voter = sortedVoters.filter(([, stakes]) => !(stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0))[dataIndex][0];
                return `Voter: ${voter}`;
              },
              label: (context) => {
                const label = context.dataset.label || '';
                let value = context.parsed.y;
                if (value === 0) return '';
                value = Math.abs(value); // Always show positive value in tooltip
                return `${label}: ${value.toFixed(2)} ALGO`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#20B2AA',
              maxRotation: 45,
              display: false // Hide x-axis labels since we show addresses on hover
            },
            grid: {
              color: 'rgba(32, 178, 170, 0.1)'
            }
          },
          y: {
            type: 'linear',
            ticks: {
              color: '#20B2AA',
              callback: (value) => `${value} ALGO`
            },
            grid: {
              color: 'rgba(32, 178, 170, 0.1)'
            },
            beginAtZero: true,
            min: undefined, // Let Chart.js auto-calculate
            max: undefined, // Let Chart.js auto-calculate
            grace: '10%' // Add 10% padding above and below the data
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  static createSummaryChart(
    canvas: HTMLCanvasElement,
    candidates: Candidate[]
  ): Chart {
    const labels = candidates.map(c => c.name);
    const yesData = candidates.map(c => c.yesVotes);
    const noData = candidates.map(c => c.noVotes);
    const abstainData = candidates.map(c => c.abstainVotes);

    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Yes Votes',
            data: yesData,
            backgroundColor: this.COLORS.yes,
            borderColor: this.COLORS.border,
            borderWidth: 1
          },
          {
            label: 'No Votes',
            data: noData,
            backgroundColor: this.COLORS.no,
            borderColor: this.COLORS.border,
            borderWidth: 1
          },
          {
            label: 'Abstain',
            data: abstainData,
            backgroundColor: this.COLORS.abstain,
            borderColor: this.COLORS.border,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Overall Voting Summary',
            color: '#008080',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            labels: {
              color: '#20B2AA',
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(18, 18, 18, 0.9)',
            titleColor: '#008080',
            bodyColor: '#20B2AA',
            borderColor: '#48D1CC',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                return `${label}: ${value.toFixed(2)} ALGO`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#20B2AA',
              maxRotation: 45
            },
            grid: {
              color: 'rgba(32, 178, 170, 0.1)'
            }
          },
          y: {
            type: 'linear', // Use linear scale instead of logarithmic for better stability
            ticks: {
              color: '#20B2AA',
              callback: (value) => `${value} ALGO`
            },
            grid: {
              color: 'rgba(32, 178, 170, 0.1)'
            },
            beginAtZero: true // Start from zero for better visualization
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }
} 