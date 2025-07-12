import * as echarts from 'echarts';
import { VotingService } from './votingService';

export interface StatisticsData {
  totalRegistered: number;
  totalVoted: number;
  totalNonVoters: number;
  participationRate: number;
}

export interface NonVoter {
  address: string;
  stake: number;
  truncatedAddress: string;
}

export class StatisticsService {
  private static readonly COLORS = {
    nonVoter: '#FF6B6B',      // Soft red for non-voters
    border: '#48D1CC'         // Teal border
  };

  getStatistics(votingService: VotingService): StatisticsData {
    const voterWeights = votingService.getVoterWeights();
    const registry = votingService.getVoterRegistry();
    const votes = votingService.getVotes();
    
    const totalRegistered = voterWeights.size;
    
    // Get unique voters who have voted
    const votedVoterIds = new Set(votes.map(vote => vote.voter));
    const totalVoted = votedVoterIds.size;
    
    const totalNonVoters = totalRegistered - totalVoted;
    const participationRate = totalRegistered > 0 ? (totalVoted / totalRegistered) * 100 : 0;

    return {
      totalRegistered,
      totalVoted,
      totalNonVoters,
      participationRate: Math.min(participationRate, 100)
    };
  }

  getNonVoters(votingService: VotingService): NonVoter[] {
    const voterWeights = votingService.getVoterWeights();
    const registry = votingService.getVoterRegistry();
    const votes = votingService.getVotes();
    
    // Get unique voters who have voted
    const votedVoterIds = new Set(votes.map(vote => vote.voter));
    
    // Find non-voters
    const nonVoters: NonVoter[] = [];
    
    voterWeights.forEach((stake, address) => {
      const voterId = registry.getId(address);
      if (!votedVoterIds.has(voterId)) {
        nonVoters.push({
          address,
          stake,
          truncatedAddress: VotingService.truncateAddress(address)
        });
      }
    });
    
    // Sort by stake (highest first)
    return nonVoters.sort((a, b) => b.stake - a.stake);
  }

  createNonVotersChart(container: HTMLElement, votingService: VotingService): echarts.ECharts {
    const nonVoters = this.getNonVoters(votingService);
    
    // Calculate total non-vote stake
    const totalNonVoteStake = nonVoters.reduce((sum, nonVoter) => sum + nonVoter.stake, 0);
    
    // Prepare chart data
    const addresses: string[] = [];
    const stakes: number[] = [];
    
    nonVoters.forEach(nonVoter => {
      addresses.push(nonVoter.truncatedAddress);
      stakes.push(nonVoter.stake);
    });

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        axisPointer: { show: false },
        confine: true,
        show: true,
        alwaysShowContent: false,
        formatter: function(params: any) {
          const dataIndex = params.dataIndex;
          const nonVoter = nonVoters[dataIndex];
          const truncatedAddress = nonVoter.address.length > 8 ? 
            nonVoter.address.substring(0, 4) + '...' + nonVoter.address.substring(nonVoter.address.length - 4) : 
            nonVoter.address;
          return `
            <b>Address:</b> ${truncatedAddress}<br/>
            <b>Stake:</b> ${nonVoter.stake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ALGO
          `;
        }
      },
      grid: {
        left: 60,
        right: 20,
        top: 30,
        bottom: 80,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: addresses,
        axisLabel: {
          show: addresses.length <= 50,
          rotate: 45,
          color: '#20B2AA',
          fontSize: 10,
          overflow: 'truncate',
          width: 60
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(32, 178, 170, 0.2)'
          }
        },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'Stake (ALGO)',
        nameTextStyle: {
          color: '#20B2AA'
        },
        axisLabel: {
          color: '#20B2AA',
          formatter: function(value: number) {
            if (value === 0) return '0';
            if (Math.abs(value) >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
            if (Math.abs(value) >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
            return value.toString();
          }
        },
        axisLine: { show: false },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(32, 178, 170, 0.1)'
          }
        }
      },
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 16,
          bottom: 20,
          start: 0,
          end: addresses.length > 50 ? 50 / addresses.length * 100 : 100,
          handleIcon: 'path://M8.7,11.3v-6c0-0.7-0.6-1.3-1.3-1.3H6.6C5.9,4,5.3,4.6,5.3,5.3v6c0,0.7,0.6,1.3,1.3,1.3h0.8C8.1,12.7,8.7,12.1,8.7,11.3z',
          handleSize: '120%',
          handleStyle: {
            color: '#008080'
          },
          backgroundColor: 'rgba(32, 178, 170, 0.1)',
          fillerColor: 'rgba(0, 128, 128, 0.2)',
          borderColor: '#20B2AA',
          borderRadius: 4
        },
        {
          type: 'inside',
          xAxisIndex: 0,
          start: 0,
          end: addresses.length > 50 ? 50 / addresses.length * 100 : 100
        }
      ],
      series: [
        {
          name: 'Non-Voters',
          type: 'bar',
          data: stakes,
          itemStyle: {
            color: StatisticsService.COLORS.nonVoter,
            borderWidth: 0,
            shadowBlur: 0
          },
          emphasis: {
            itemStyle: {
              color: StatisticsService.COLORS.nonVoter
            }
          }
        }
      ]
    };

    const chart = echarts.init(container);
    chart.setOption(option);

    // Add click handler for address copying
    chart.on('click', (params) => {
      if (params.componentType === 'series') {
        const dataIndex = params.dataIndex;
        const nonVoter = nonVoters[dataIndex];
        navigator.clipboard.writeText(nonVoter.address).then(() => {
          StatisticsService.showCopyFeedback();
        }).catch((err) => {
          console.error('Failed to copy address:', err);
          alert(`Address copied: ${nonVoter.address}`);
        });
      }
    });

    return chart;
  }

  private static showCopyFeedback(): void {
    const feedback = document.createElement('div');
    feedback.textContent = 'Address copied to clipboard!';
    feedback.style.position = 'fixed';
    feedback.style.top = '20px';
    feedback.style.right = '20px';
    feedback.style.background = '#008080';
    feedback.style.color = 'white';
    feedback.style.padding = '10px 15px';
    feedback.style.borderRadius = '5px';
    feedback.style.zIndex = '10000';
    feedback.style.fontSize = '14px';
    feedback.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    document.body.appendChild(feedback);
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 2000);
  }
} 