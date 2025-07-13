import * as echarts from 'echarts';
import { Candidate, Vote } from './types';
import { VotingService } from './votingService';

export class PopularityChartService {
  static createPopularityChart(
    container: HTMLElement,
    _candidate: Candidate,
    votes: Vote[],
    votingService: VotingService,
    options?: { noTitle?: boolean }
  ): echarts.ECharts {
    // Clean slate: set container height and width
    container.innerHTML = '';
    container.style.height = '400px';
    container.style.width = '100%';

    // Prepare heatmap data
    const voterWeights = votingService.getVoterWeights();
    const registry = votingService.getVoterRegistry();
    const allVoterIds = Array.from(voterWeights.keys()).map(addr => registry.getId(addr));
    const totalVoters = allVoterIds.length;
    const voteMap = new Map<number, 'yes' | 'no' | 'abstain'>();
    votes.forEach(vote => {
      voteMap.set(vote.voter, vote.vote);
    });
    const pixelData: {
      voterId: number;
      vote: 'yes' | 'no' | 'abstain' | 'none';
    }[] = allVoterIds.map(id => ({
      voterId: id,
      vote: voteMap.get(id) || 'none',
    }));
    // Sort: yes, abstain, no, none
    pixelData.sort((a, b) => {
      const order = { yes: 0, abstain: 1, no: 2, none: 3 };
      return order[a.vote] - order[b.vote];
    });
    // Map vote types to numbers for visualMap
    const voteTypeToNum = { yes: 0, abstain: 1, no: 2, none: 3 } as const;
    // Grid layout (denser grid)
    const cols = Math.ceil(Math.sqrt(totalVoters) * 1.2); // denser grid
    const rows = Math.ceil(totalVoters / cols);
    // Calculate symbol size to fill grid tightly
    const containerWidth = container.offsetWidth || 400;
    const containerHeight = parseInt(container.style.height) || 400;
    const symbolSizeX = Math.floor(containerWidth / cols);
    const symbolSizeY = Math.floor(containerHeight / rows);
    const symbolSize = Math.max(4, Math.min(symbolSizeX, symbolSizeY) - 2); // -2 for minimal gap, min 4px
    const data: [number, number, number, string, string, string][] = [];
    pixelData.forEach((pixel, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const voterAddress = registry.getAddress(pixel.voterId);
      const voteText = pixel.vote === 'none' ? 'No vote' : pixel.vote.charAt(0).toUpperCase() + pixel.vote.slice(1);
      data.push([col, row, voteTypeToNum[pixel.vote], voterAddress, voteText, pixel.vote]);
    });
    // Count votes for subtitle
    const yesCount = pixelData.filter(p => p.vote === 'yes').length;
    const abstainCount = pixelData.filter(p => p.vote === 'abstain').length;
    const noCount = pixelData.filter(p => p.vote === 'no').length;
    const noneCount = pixelData.filter(p => p.vote === 'none').length;
    // Create separate series for each vote type to ensure colors work
    const yesData: [number, number, string, string][] = [];
    const abstainData: [number, number, string, string][] = [];
    const noData: [number, number, string, string][] = [];
    const noneData: [number, number, string, string][] = [];

    pixelData.forEach((pixel, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const voterAddress = registry.getAddress(pixel.voterId);
      const voteText = pixel.vote === 'none' ? 'No vote' : pixel.vote.charAt(0).toUpperCase() + pixel.vote.slice(1);
      
      const pointData: [number, number, string, string] = [col, row, voterAddress, voteText];
      
      switch (pixel.vote) {
        case 'yes':
          yesData.push(pointData);
          break;
        case 'abstain':
          abstainData.push(pointData);
          break;
        case 'no':
          noData.push(pointData);
          break;
        case 'none':
          noneData.push(pointData);
          break;
      }
    });

    // Slightly increase symbol size to overlap squares and remove visible gaps
    const overlap = 1;
    const tightSymbolSize = symbolSize + overlap;

    const option: echarts.EChartsOption = {
      backgroundColor: 'rgb(10, 11, 22)',
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: function(params: any) {
          const voterAddress = params.data[2];
          const voteText = params.data[3];
          const truncatedAddress = voterAddress.length > 8 ? 
            voterAddress.substring(0, 4) + '...' + voterAddress.substring(voterAddress.length - 4) : 
            voterAddress;
          return `<b>Voter:</b> ${truncatedAddress}<br/><b>Vote:</b> ${voteText}`;
        }
      },
      grid: {
        left: 20,
        right: 20,
        top: 20,
        bottom: 30,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: cols - 1,
        show: false
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: rows - 1,
        show: false
      },
      series: [
        {
          name: 'Yes',
          type: 'scatter',
          data: yesData,
          symbolSize: tightSymbolSize,
          symbol: 'rect',
          itemStyle: {
            color: '#90EE90',
            opacity: 1
          },
          emphasis: {
            itemStyle: {
              borderColor: '#48D1CC',
              borderWidth: 2
            }
          }
        },
        {
          name: 'Abstain',
          type: 'scatter',
          data: abstainData,
          symbolSize: tightSymbolSize,
          symbol: 'rect',
          itemStyle: {
            color: '#F0E68C',
            opacity: 1
          },
          emphasis: {
            itemStyle: {
              borderColor: '#48D1CC',
              borderWidth: 2
            }
          }
        },
        {
          name: 'No',
          type: 'scatter',
          data: noData,
          symbolSize: tightSymbolSize,
          symbol: 'rect',
          itemStyle: {
            color: '#FFB6C1',
            opacity: 1
          },
          emphasis: {
            itemStyle: {
              borderColor: '#48D1CC',
              borderWidth: 2
            }
          }
        },
        {
          name: 'None',
          type: 'scatter',
          data: noneData,
          symbolSize: tightSymbolSize,
          symbol: 'rect',
          itemStyle: {
            color: 'transparent',
            opacity: 0
          },
          emphasis: {
            itemStyle: {
              borderColor: '#48D1CC',
              borderWidth: 2
            }
          }
        }
      ]
    };
    if (!options || !options.noTitle) {
      option.title = {
        text: 'Popular vote',
        subtext: `Yes: ${yesCount}   Abstain: ${abstainCount}   No: ${noCount}   None: ${noneCount}`,
        left: 'center',
        top: 10,
        textStyle: {
          color: '#20B2AA',
          fontSize: 18,
          fontWeight: 'bold'
        },
        subtextStyle: {
          color: '#aaa',
          fontSize: 14
        }
      };
    }
    const chart = echarts.init(container);
    chart.setOption(option);
    return chart;
  }
} 