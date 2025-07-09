import Plotly from 'plotly.js-dist-min';
import { Candidate, Vote } from './types';
import { VotingService } from './votingService';

export class PlotlyService {
  private static readonly COLORS = {
    yes: '#90EE90',      // Soft green
    no: '#FFB6C1',       // Soft red
    abstain: '#F0E68C',  // Soft yellow
    border: '#48D1CC'    // Teal border
  };

  static createStakeChart(
    container: HTMLElement,
    candidate: Candidate,
    votes: Vote[]
  ): void {
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

    // Prepare chart data
    const voters: string[] = [];
    const yesData: number[] = [];
    const noData: number[] = [];
    const abstainData: number[] = [];

    sortedVoters.forEach(([voter, stakes]) => {
      // Exclude voters with all zero votes
      if (stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0) return;
      // Only display voters with total stake >= 10,000 Algo (visual filter only)
      if (stakes.total < 10000) return;
      
      voters.push(VotingService.truncateAddress(voter));
      yesData.push(stakes.yes);
      noData.push(-stakes.no); // Negative for downward bars
      abstainData.push(stakes.abstain);
    });

    const data: Plotly.Data[] = [
      {
        x: voters,
        y: yesData,
        type: 'bar',
        name: 'Yes',
        marker: {
          color: this.COLORS.yes,
          line: { width: 0 }
        },
        hovertemplate: 
          '<b>Voter:</b> %{text}<br>' +
          '<b>Yes:</b> %{y:,.2f} ALGO<br>' +
          '<extra></extra>',
        text: sortedVoters
          .filter(([, stakes]) => !(stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0))
          .filter(([, stakes]) => stakes.total >= 10000)
          .map(([voter]) => voter)
      },
      {
        x: voters,
        y: noData,
        type: 'bar',
        name: 'No',
        marker: {
          color: this.COLORS.no,
          line: { width: 0 }
        },
        hovertemplate: 
          '<b>Voter:</b> %{text}<br>' +
          '<b>No:</b> %{y:,.2f} ALGO<br>' +
          '<extra></extra>',
        text: sortedVoters
          .filter(([, stakes]) => !(stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0))
          .filter(([, stakes]) => stakes.total >= 10000)
          .map(([voter]) => voter)
      },
      {
        x: voters,
        y: abstainData,
        type: 'bar',
        name: 'Abstain',
        marker: {
          color: this.COLORS.abstain,
          line: { width: 0 }
        },
        hovertemplate: 
          '<b>Voter:</b> %{text}<br>' +
          '<b>Abstain:</b> %{y:,.2f} ALGO<br>' +
          '<extra></extra>',
        text: sortedVoters
          .filter(([, stakes]) => !(stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0))
          .filter(([, stakes]) => stakes.total >= 10000)
          .map(([voter]) => voter)
      }
    ];

    const layout: Partial<Plotly.Layout> = {
      title: {
        text: candidate.name,
        font: {
          color: '#008080',
          size: 16
        }
      },
      barmode: 'stack',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: {
        color: '#20B2AA'
      },
      xaxis: {
        showticklabels: false, // Hide x-axis labels since we show addresses on hover
        gridcolor: 'rgba(32, 178, 170, 0.1)',
        zeroline: false
      },
      yaxis: {
        title: 'Stake (ALGO)',
        type: 'linear',
        gridcolor: 'rgba(32, 178, 170, 0.1)',
        zeroline: false,
        tickformat: ',.0f'
      },
      showlegend: false,
      margin: {
        l: 60,
        r: 20,
        t: 60,
        b: 40
      },
      hovermode: 'closest'
    };

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: `${candidate.name.replace(/[^a-zA-Z0-9]/g, '_')}_stake_chart`,
        height: 400,
        width: 600,
        scale: 2
      }
    };

    Plotly.newPlot(container, data, layout, config);
  }

  static createSummaryChart(
    container: HTMLElement,
    candidates: Candidate[]
  ): void {
    const labels = candidates.map(c => c.name);
    const yesData = candidates.map(c => c.yesVotes);
    const noData = candidates.map(c => c.noVotes);
    const abstainData = candidates.map(c => c.abstainVotes);

    const data: Plotly.Data[] = [
      {
        x: labels,
        y: yesData,
        type: 'bar',
        name: 'Yes Votes',
        marker: {
          color: this.COLORS.yes,
          line: { color: this.COLORS.border, width: 1 }
        },
        hovertemplate: 
          '<b>%{x}</b><br>' +
          '<b>Yes:</b> %{y:,.2f} ALGO<br>' +
          '<extra></extra>'
      },
      {
        x: labels,
        y: noData,
        type: 'bar',
        name: 'No Votes',
        marker: {
          color: this.COLORS.no,
          line: { color: this.COLORS.border, width: 1 }
        },
        hovertemplate: 
          '<b>%{x}</b><br>' +
          '<b>No:</b> %{y:,.2f} ALGO<br>' +
          '<extra></extra>'
      },
      {
        x: labels,
        y: abstainData,
        type: 'bar',
        name: 'Abstain',
        marker: {
          color: this.COLORS.abstain,
          line: { color: this.COLORS.border, width: 1 }
        },
        hovertemplate: 
          '<b>%{x}</b><br>' +
          '<b>Abstain:</b> %{y:,.2f} ALGO<br>' +
          '<extra></extra>'
      }
    ];

    const layout: Partial<Plotly.Layout> = {
      title: {
        text: 'Overall Voting Summary',
        font: {
          color: '#008080',
          size: 16
        }
      },
      barmode: 'stack',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: {
        color: '#20B2AA'
      },
      xaxis: {
        tickangle: 45,
        gridcolor: 'rgba(32, 178, 170, 0.1)',
        zeroline: false
      },
      yaxis: {
        title: 'Stake (ALGO)',
        type: 'linear',
        gridcolor: 'rgba(32, 178, 170, 0.1)',
        zeroline: false,
        tickformat: ',.0f'
      },
      showlegend: true,
      legend: {
        font: { color: '#20B2AA' }
      },
      margin: {
        l: 60,
        r: 20,
        t: 80,
        b: 80
      },
      hovermode: 'closest'
    };

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: 'voting_summary_chart',
        height: 400,
        width: 800,
        scale: 2
      }
    };

    Plotly.newPlot(container, data, layout, config);
  }

  static toggleLogScale(container: HTMLElement, useLogScale: boolean): void {
    const update: Partial<Plotly.Layout> = {
      yaxis: {
        type: useLogScale ? 'log' : 'linear'
      }
    };
    
    Plotly.relayout(container, update);
  }
} 