'use client';

import { useState } from 'react';
import { ChevronDown, Plus, Filter } from 'lucide-react';
import { PipelineBoard } from '@/components/pipeline-board';
import { cn } from '@/lib/utils';

// --- Mock Data ---------------------------------------------------------------

const pipelines = [
  { id: '1', name: 'Sales Pipeline', type: 'sales' },
  { id: '2', name: 'Recruiting Pipeline', type: 'recruiting' },
];

const mockColumns = [
  {
    id: 'discovery',
    name: 'Discovery',
    cards: [
      {
        id: '1',
        contactName: 'Ryan Kim',
        company: 'DataFlow',
        value: 45000,
        score: 55,
        daysInStage: 3,
      },
      {
        id: '2',
        contactName: 'Elena Vasquez',
        company: 'Notion',
        value: 80000,
        score: 63,
        daysInStage: 7,
      },
      {
        id: '3',
        contactName: 'Tom Anderson',
        company: 'Vercel',
        value: 35000,
        score: 48,
        daysInStage: 2,
      },
    ],
  },
  {
    id: 'qualified',
    name: 'Qualified',
    cards: [
      {
        id: '4',
        contactName: 'Marcus Johnson',
        company: 'Stripe',
        value: 120000,
        score: 74,
        daysInStage: 12,
      },
      {
        id: '5',
        contactName: 'Lisa Wang',
        company: 'Figma',
        value: 90000,
        score: 68,
        daysInStage: 5,
      },
    ],
  },
  {
    id: 'proposal',
    name: 'Proposal',
    cards: [
      {
        id: '6',
        contactName: 'Sarah Chen',
        company: 'Sequoia Capital',
        value: 500000,
        score: 92,
        daysInStage: 4,
      },
      {
        id: '7',
        contactName: 'David Park',
        company: 'NexGen AI',
        value: 150000,
        score: 82,
        daysInStage: 8,
      },
    ],
  },
  {
    id: 'negotiation',
    name: 'Negotiation',
    cards: [
      {
        id: '8',
        contactName: 'James Wright',
        company: 'Acme Corp',
        value: 200000,
        score: 88,
        daysInStage: 15,
      },
    ],
  },
  {
    id: 'closed_won',
    name: 'Closed Won',
    cards: [
      {
        id: '9',
        contactName: 'Amy Rodriguez',
        company: 'TechStart',
        value: 75000,
        score: 95,
        daysInStage: 0,
      },
      {
        id: '10',
        contactName: 'Kevin Chang',
        company: 'Amplitude',
        value: 110000,
        score: 98,
        daysInStage: 0,
      },
    ],
  },
];

// --- Component ---------------------------------------------------------------

export default function PipelinePage() {
  const [selectedPipeline, setSelectedPipeline] = useState(pipelines[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const totalValue = mockColumns.reduce(
    (sum, col) => sum + col.cards.reduce((s, c) => s + c.value, 0),
    0,
  );
  const totalDeals = mockColumns.reduce(
    (sum, col) => sum + col.cards.length,
    0,
  );

  return (
    <div className="max-w-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Pipeline Selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-outline-variant rounded-full text-sm font-medium text-onSurface hover:border-outline transition-m3"
            >
              {selectedPipeline.name}
              <ChevronDown className="w-4 h-4 text-onSurface-variant" />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-surface-containerHigh border border-outline-variant rounded-md shadow-elevation-2 z-10 py-1">
                {pipelines.map((pipeline) => (
                  <button
                    key={pipeline.id}
                    onClick={() => {
                      setSelectedPipeline(pipeline);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm transition-m3',
                      selectedPipeline.id === pipeline.id
                        ? 'bg-secondary-container text-onSecondary-container font-medium'
                        : 'text-onSurface hover:bg-surface-container',
                    )}
                  >
                    {pipeline.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-4 text-sm text-onSurface-variant">
            <span>
              <span className="font-medium text-onSurface">{totalDeals}</span>{' '}
              deals
            </span>
            <span>
              <span className="font-medium text-onSurface">
                ${(totalValue / 1000).toFixed(0)}K
              </span>{' '}
              total value
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-4 h-10 text-sm text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh rounded-full transition-m3">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="flex items-center gap-1.5 px-6 h-10 text-sm font-medium bg-primary text-onPrimary rounded-full hover:shadow-elevation-1 transition-m3">
            <Plus className="w-4 h-4" />
            Add Deal
          </button>
        </div>
      </div>

      {/* Pipeline Board */}
      <PipelineBoard columns={mockColumns} />
    </div>
  );
}
