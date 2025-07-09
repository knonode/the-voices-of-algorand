import Plotly from 'plotly.js-dist-min';
import { Candidate, Vote } from './types';
import { VotingService } from './votingService';

export class PopularityChartService {
  private static readonly COLORS = {
    yes: '#90EE90',      // Soft green
    no: '#FFB6C1',       // Soft red
    abstain: '#F0E68C',  // Soft yellow
    none: '#222',        // Gray for no vote
  };

  static createPopularityChart(
    container: HTMLElement,
    _candidate: Candidate,
    votes: Vote[],
    votingService: VotingService
  ): void {
    // Clear container
    container.innerHTML = '';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'stretch';
    wrapper.style.height = '100%';

    // Get all registered voters (IDs)
    const voterWeights = votingService.getVoterWeights();
    const registry = votingService.getVoterRegistry();
    const allVoterIds = Array.from(voterWeights.keys()).map(addr => registry.getId(addr));
    const totalVoters = allVoterIds.length;
    // Map voter ID to vote type for this candidate
    const voteMap = new Map<number, 'yes' | 'no' | 'abstain'>();
    votes.forEach(vote => {
      voteMap.set(vote.voter, vote.vote);
    });
    // Build pixel data
    const pixelData: {
      voterId: number;
      vote: 'yes' | 'no' | 'abstain' | 'none';
    }[] = allVoterIds.map(id => ({
      voterId: id,
      vote: voteMap.get(id) || 'none',
    }));

    // Count votes
    let yesCount = 0, abstainCount = 0, noCount = 0, noneCount = 0;
    pixelData.forEach(pixel => {
      if (pixel.vote === 'yes') yesCount++;
      else if (pixel.vote === 'abstain') abstainCount++;
      else if (pixel.vote === 'no') noCount++;
      else noneCount++;
    });

    // Add counts display above the chart
    const countsDiv = document.createElement('div');
    countsDiv.className = 'popularity-counts';
    countsDiv.style.display = 'flex';
    countsDiv.style.justifyContent = 'center';
    countsDiv.style.gap = '2.5rem';
    countsDiv.style.marginBottom = '10px';
    countsDiv.innerHTML = `
      <span style="color: ${PopularityChartService.COLORS.yes}; font-weight: bold;">Yes: ${yesCount}</span>
      <span style="color: ${PopularityChartService.COLORS.abstain}; font-weight: bold;">Abstain: ${abstainCount}</span>
      <span style="color: ${PopularityChartService.COLORS.no}; font-weight: bold;">No: ${noCount}</span>
      <span style="color: #888; font-weight: bold;">Not voted: ${noneCount}</span>
    `;
    wrapper.appendChild(countsDiv);

    // Chart div
    const chartDiv = document.createElement('div');
    chartDiv.style.flex = '1 1 auto';
    chartDiv.style.height = '100%';
    wrapper.appendChild(chartDiv);
    container.appendChild(wrapper);

    // Sort: yes (left), abstain (middle), no (right), none (far right)
    pixelData.sort((a, b) => {
      const order = { yes: 0, abstain: 1, no: 2, none: 3 };
      return order[a.vote] - order[b.vote];
    });

    // Grid layout (left-to-right, row by row)
    const cols = Math.ceil(Math.sqrt(totalVoters));
    const rows = Math.ceil(totalVoters / cols);

    const x: number[] = [];
    const y: number[] = [];
    const markerColors: string[] = [];
    const text: string[] = [];

    pixelData.forEach((pixel, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      x.push(col);
      y.push(row); // row index, top to bottom
      markerColors.push(PopularityChartService.COLORS[pixel.vote]);
      text.push(`${registry.getAddress(pixel.voterId)}<br>Vote: ${pixel.vote === 'none' ? 'No vote' : pixel.vote.charAt(0).toUpperCase() + pixel.vote.slice(1)}`);
    });

    const data: any[] = [
      {
        x,
        y,
        type: 'scatter',
        mode: 'markers',
        marker: {
          color: markerColors,
          size: 8,
          line: { width: 0 }
        },
        text,
        hovertemplate: '<b>Voter:</b> %{text}<extra></extra>',
        showlegend: false
      }
    ];

    const layout: any = {
      title: {
        text: 'Popularity Votes',
        font: { color: '#008080', size: 14 }
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#20B2AA' },
      xaxis: {
        range: [-0.5, cols - 0.5],
        showticklabels: false,
        showgrid: false,
        zeroline: false,
        fixedrange: true
      },
      yaxis: {
        range: [-0.5, rows - 0.5],
        showticklabels: false,
        showgrid: false,
        zeroline: false,
        fixedrange: true
      },
      showlegend: false,
      margin: { l: 20, r: 20, t: 60, b: 40 },
      hovermode: 'closest',
      autosize: true
    };

    const config: any = {
      responsive: true,
      displayModeBar: false, // Hide mode bar for popularity chart
      staticPlot: false
    };

    Plotly.newPlot(chartDiv, data, layout, config);
  }
} 