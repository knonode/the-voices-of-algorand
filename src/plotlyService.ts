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
    const abstainData: number[] = [];
    const abstainBase: number[] = [];
    const registry = VotingService.prototype.getVoterRegistry();
    
    sortedVoters.forEach(([voterId, stakes]) => {
      // Exclude voters with all zero votes
      if (stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0) return;
      // Only display voters with total stake >= 10,000 Algo (visual filter only)
      if (stakes.total < 10000) return;
      
      voters.push(VotingService.truncateAddress(registry.getAddress(voterId)));
      yesData.push(stakes.yes);
      noData.push(-stakes.no); // Negative for downward bars
      // For abstain: full height but starting from negative half
      abstainData.push(stakes.abstain);
      abstainBase.push(-stakes.abstain / 2);
    });

    const data: any[] = [
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
          '<b>Voter:</b> %{customdata}<br>' +
          '<b>Yes:</b> %{y:,.2f} ALGO<br>' +
          '<extra></extra>',
        customdata: sortedVoters
          .filter(([, stakes]) => !(stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0))
          .filter(([, stakes]) => stakes.total >= 10000)
          .map(([voterId]) => registry.getAddress(voterId))
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
          '<b>Voter:</b> %{customdata}<br>' +
          '<b>No:</b> %{y:,.2f} ALGO<br>' +
          '<extra></extra>',
        customdata: sortedVoters
          .filter(([, stakes]) => !(stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0))
          .filter(([, stakes]) => stakes.total >= 10000)
          .map(([voterId]) => registry.getAddress(voterId))
      },
      {
        x: voters,
        y: abstainData,
        base: abstainBase,
        type: 'bar',
        name: 'Abstain',
        marker: {
          color: this.COLORS.abstain,
          line: { width: 0 }
        },
        hovertemplate: 
          '<b>Voter:</b> %{customdata}<br>' +
          '<b>Abstain:</b> %{meta:,.2f} ALGO<br>' +
          '<extra></extra>',
        customdata: sortedVoters
          .filter(([, stakes]) => !(stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0))
          .filter(([, stakes]) => stakes.total >= 10000)
          .map(([voterId]) => registry.getAddress(voterId)),
        meta: sortedVoters
          .filter(([, stakes]) => !(stakes.yes === 0 && stakes.no === 0 && stakes.abstain === 0))
          .filter(([, stakes]) => stakes.total >= 10000)
          .map(([, stakes]) => stakes.abstain)
      }
    ];

    const layout: any = {
      title: {
        text: candidate.name,
        font: {
          color: '#008080',
          size: 16
        }
      },
      barmode: 'relative',
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

    const config: any = {
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

    Plotly.newPlot(container, data, layout, config).then(() => {
      // Attach click handler directly to the Plotly plot div
      (container as any).on('plotly_click', (eventData: any) => {
        if (eventData.points && eventData.points.length > 0) {
          const point = eventData.points[0];
          const voterAddress = point.customdata;
          if (voterAddress) {
            navigator.clipboard.writeText(voterAddress).then(() => {
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
            }).catch((err) => {
              console.error('Failed to copy address:', err);
              alert(`Address copied: ${voterAddress}`);
            });
          }
        }
      });
    });
  }

  static createSummaryChart(
    container: HTMLElement,
    candidates: Candidate[]
  ): void {
    const labels = candidates.map(c => c.name);
    const yesData = candidates.map(c => c.yesVotes);
    const noData = candidates.map(c => c.noVotes);
    const abstainData = candidates.map(c => c.abstainVotes);

    const data: any[] = [
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
        name: 'Abstain Votes',
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

    const layout: any = {
      title: {
        text: 'Voting Summary by Candidate',
        font: {
          color: '#008080',
          size: 18
        }
      },
      barmode: 'stack',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: {
        color: '#20B2AA'
      },
      xaxis: {
        gridcolor: 'rgba(32, 178, 170, 0.1)',
        zeroline: false
      },
      yaxis: {
        title: 'Total Stake (ALGO)',
        gridcolor: 'rgba(32, 178, 170, 0.1)',
        zeroline: false,
        tickformat: ',.0f'
      },
      showlegend: true,
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: 'rgba(0,0,0,0.8)',
        bordercolor: this.COLORS.border,
        borderwidth: 1
      },
      margin: {
        l: 80,
        r: 20,
        t: 80,
        b: 80
      },
      hovermode: 'closest'
    };

    const config: any = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: 'voting_summary_chart',
        height: 500,
        width: 800,
        scale: 2
      }
    };

    Plotly.newPlot(container, data, layout, config);
  }
} 