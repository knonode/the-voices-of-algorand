import * as echarts from 'echarts';
import { Candidate, Vote } from './types';
import { VotingService } from './votingService';

export class EChartsService {
  private static readonly COLORS = {
    yes: '#90EE90',      // Soft green
    no: '#FFB6C1',       // Soft red
    abstain: '#F0E68C',  // Soft yellow
    border: '#48D1CC'    // Teal border
  };

  static createStakeChart(
    container: HTMLElement,
    candidate: Candidate,
    votes: Vote[],
    votingService: VotingService
  ): echarts.ECharts {
    // Group votes by voter ID
    const voterGroups = new Map<number, { yes: number; no: number; abstain: number; total: number }>();
    
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

    // Prepare chart data
    const voters: string[] = [];
    const yesData: number[] = [];
    const noData: number[] = [];
    const abstainPos: number[] = [];
    const abstainNeg: number[] = [];
    const registry = votingService.getVoterRegistry();
    
    sortedVoters.forEach(([voterId, stakes]) => {
      // Exclude voters with all zero votes
      if (stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0) return;
      // Only display voters with total stake >= 10,000 Algo (visual filter only)
      if (stakes.total < 10000) return;
      
      voters.push(VotingService.truncateAddress(registry.getAddress(voterId)));
      yesData.push(stakes.yes);
      noData.push(-stakes.no); // Negative for downward bars
      abstainPos.push(stakes.abstain / 2); // Half above zero
      abstainNeg.push(-stakes.abstain / 2); // Half below zero
    });

    // Clean slate: set container height and width
    container.style.height = '500px';
    container.style.width = '100%';

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        axisPointer: { show: false },
        confine: true,
        show: true,
        alwaysShowContent: false,
        formatter: function(params: any) {
          const dataIndex = params.dataIndex;
          const voterAddress = registry.getAddress(sortedVoters
            .filter(([, stakes]) => !(stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0))
            .filter(([, stakes]) => stakes.total >= 10000)[dataIndex][0]);
          const truncatedAddress = voterAddress.length > 8 ? 
            voterAddress.substring(0, 4) + '...' + voterAddress.substring(voterAddress.length - 4) : 
            voterAddress;
          let result = `<b>Voter:</b> ${truncatedAddress}<br/>`;
          let abstainSum = 0;
          if (params.seriesName === 'Abstain') {
            abstainSum += Math.abs(params.value);
          } else if (params.value !== 0) {
            const value = Math.abs(params.value);
            const voteType = params.seriesName;
            result += `<b>${voteType}:</b> ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ALGO<br/>`;
          }
          if (abstainSum > 0) {
            result += `<b>Abstain:</b> ${abstainSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ALGO<br/>`;
          }
          return result;
        }
      },
      legend: { show: false },
      grid: {
        left: 40,
        right: 20,
        top: 30,
        bottom: 60,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: voters,
        axisLabel: {
          show: voters.length <= 30,
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
        splitLine: { show: false },
        min: function (value: any) { return value.min > 0 ? -1 : value.min * 1.1; },
        max: function (value: any) { return value.max < 0 ? 1 : value.max * 1.1; }
      },
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 16,
          bottom: 10,
          start: 0,
          end: voters.length > 30 ? 30 / voters.length * 100 : 100,
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
          end: voters.length > 30 ? 30 / voters.length * 100 : 100
        }
      ],
      series: [
        {
          name: 'Yes',
          type: 'bar',
          stack: 'votes',
          data: yesData,
          itemStyle: {
            color: this.COLORS.yes,
            borderWidth: 0,
            shadowBlur: 0
          },
          emphasis: {
            itemStyle: {
              color: this.COLORS.yes
            }
          }
        },
        {
          name: 'No',
          type: 'bar',
          stack: 'votes',
          data: noData,
          itemStyle: {
            color: this.COLORS.no,
            borderWidth: 0,
            shadowBlur: 0
          },
          emphasis: {
            itemStyle: {
              color: this.COLORS.no
            }
          }
        },
        {
          name: 'Abstain',
          type: 'bar',
          stack: 'votes',
          data: abstainPos,
          itemStyle: {
            color: this.COLORS.abstain,
            opacity: 0.85,
            borderWidth: 0,
            shadowBlur: 0
          },
          emphasis: {
            itemStyle: {
              color: this.COLORS.abstain
            }
          }
        },
        {
          name: 'Abstain',
          type: 'bar',
          stack: 'votes',
          data: abstainNeg,
          itemStyle: {
            color: this.COLORS.abstain,
            opacity: 0.85,
            borderWidth: 0,
            shadowBlur: 0
          },
          emphasis: {
            itemStyle: {
              color: this.COLORS.abstain
            }
          }
        }
      ],
      backgroundColor: 'transparent',
      animation: false
    };

    const chart = echarts.init(container);
    chart.setOption(option);

    // Add click handler for address copying
    chart.on('click', (params) => {
      if (params.componentType === 'series') {
        const dataIndex = params.dataIndex;
        const voterAddress = registry.getAddress(sortedVoters
          .filter(([, stakes]) => !(stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0))
          .filter(([, stakes]) => stakes.total >= 10000)[dataIndex][0]);
        navigator.clipboard.writeText(voterAddress).then(() => {
          EChartsService.showCopyFeedback();
        }).catch((err) => {
          console.error('Failed to copy address:', err);
          alert(`Address copied: ${voterAddress}`);
        });
      }
    });

    return chart;
  }

  static createSummaryChart(
    container: HTMLElement,
    candidates: Candidate[]
  ): echarts.ECharts {
    const labels = candidates.map(c => c.name);
    const yesData = candidates.map(c => c.yesVotes);
    const noData = candidates.map(c => c.noVotes);
    const abstainData = candidates.map(c => c.abstainVotes);

    const option: echarts.EChartsOption = {
      title: {
        text: 'Voting Summary by Candidate',
        textStyle: {
          color: '#008080',
          fontSize: 18
        },
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params: any) {
          let result = `<b>${params[0].name}</b><br/>`;
          params.forEach((param: any) => {
            if (param.value !== 0) {
              result += `<b>${param.seriesName}:</b> ${param.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ALGO<br/>`;
            }
          });
          return result;
        }
      },
      legend: {
        data: ['Yes Votes', 'No Votes', 'Abstain Votes'],
        top: '40px',
        left: '20px',
        textStyle: {
          color: '#20B2AA'
        },
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: this.COLORS.border,
        borderWidth: 1
      },
      grid: {
        left: '80px',
        right: '20px',
        top: '120px',
        bottom: '80px'
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          color: '#20B2AA',
          rotate: 45
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(32, 178, 170, 0.1)'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Total Stake (ALGO)',
        nameTextStyle: {
          color: '#20B2AA'
        },
        axisLabel: {
          color: '#20B2AA',
          formatter: function(value: number) {
            return value.toLocaleString();
          }
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(32, 178, 170, 0.1)'
          }
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(32, 178, 170, 0.1)'
          }
        }
      },
      series: [
        {
          name: 'Yes Votes',
          type: 'bar',
          stack: 'total',
          data: yesData,
          itemStyle: {
            color: this.COLORS.yes,
            borderColor: this.COLORS.border,
            borderWidth: 1
          }
        },
        {
          name: 'No Votes',
          type: 'bar',
          stack: 'total',
          data: noData,
          itemStyle: {
            color: this.COLORS.no,
            borderColor: this.COLORS.border,
            borderWidth: 1
          }
        },
        {
          name: 'Abstain Votes',
          type: 'bar',
          stack: 'total',
          data: abstainData,
          itemStyle: {
            color: this.COLORS.abstain,
            borderColor: this.COLORS.border,
            borderWidth: 1
          }
        }
      ],
      backgroundColor: 'transparent'
    };

    const chart = echarts.init(container);
    chart.setOption(option);

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