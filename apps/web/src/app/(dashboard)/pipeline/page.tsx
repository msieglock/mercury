'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Filter } from 'lucide-react';
import { PipelineBoard } from '@/components/pipeline-board';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { LoadingSkeleton, ApiErrorState } from '@/components/loading-skeleton';

interface Pipeline {
  id: string;
  name: string;
  type: string;
}

interface PipelineColumn {
  id: string;
  name: string;
  cards: {
    id: string;
    contactName: string;
    company: string;
    value: number;
    score: number;
    daysInStage: number;
  }[];
}

// --- Component ---

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch pipelines
  useEffect(() => {
    apiClient('/api/pipelines')
      .then((data) => {
        const raw = data.pipelines || data || [];
        const mapped: Pipeline[] = raw.map((p: Record<string, unknown>) => ({
          id: String(p.id || ''),
          name: String(p.name || ''),
          type: String(p.type || 'sales'),
        }));
        setPipelines(mapped);
        if (mapped.length > 0) {
          setSelectedPipeline(mapped[0]);
        }
      })
      .catch(() => {
        setError(true);
        setPipelines([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch pipeline items when selected pipeline changes
  useEffect(() => {
    if (!selectedPipeline) return;

    apiClient(`/api/pipelines/${selectedPipeline.id}/items`)
      .then((data) => {
        const items = data.items || data || [];
        // Group items by stage
        const stageMap = new Map<string, PipelineColumn['cards']>();
        for (const item of items) {
          const stage = String(item.stage || item.stage_name || 'Unknown');
          if (!stageMap.has(stage)) stageMap.set(stage, []);
          stageMap.get(stage)!.push({
            id: String(item.id || ''),
            contactName: String(item.contactName || item.contact_name || 'Unknown'),
            company: String(item.company || item.company_name || ''),
            value: Number(item.value || item.deal_value || 0),
            score: Number(item.score || item.confidence || 50),
            daysInStage: Number(item.daysInStage || item.days_in_stage || 0),
          });
        }

        const cols: PipelineColumn[] = Array.from(stageMap.entries()).map(
          ([name, cards]) => ({
            id: name.toLowerCase().replace(/\s+/g, '_'),
            name,
            cards,
          }),
        );
        setColumns(cols);
      })
      .catch(() => {
        setColumns([]);
      });
  }, [selectedPipeline]);

  if (loading) {
    return (
      <div className="max-w-full space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-48 bg-surface-containerHigh rounded-full animate-pulse" />
          <div className="h-4 w-32 bg-surface-containerHigh rounded animate-pulse" />
        </div>
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[300px] flex-shrink-0">
              <div className="h-5 w-24 bg-surface-containerHigh rounded animate-pulse mb-3" />
              <div className="bg-surface-container rounded-lg p-2 min-h-[200px] space-y-2">
                {Array.from({ length: Math.max(1, 3 - i) }).map((_, j) => (
                  <div
                    key={j}
                    className="bg-surface-containerLow rounded-md border border-outline-variant p-4 space-y-2"
                  >
                    <div className="h-3 w-24 bg-surface-containerHigh rounded animate-pulse" />
                    <div className="h-3 w-16 bg-surface-containerHigh rounded animate-pulse" />
                    <div className="h-1.5 w-full bg-surface-containerHigh rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && pipelines.length === 0) {
    return <ApiErrorState />;
  }

  const totalValue = columns.reduce(
    (sum, col) => sum + col.cards.reduce((s, c) => s + c.value, 0),
    0,
  );
  const totalDeals = columns.reduce(
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
              {selectedPipeline?.name || 'Select Pipeline'}
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
                      selectedPipeline?.id === pipeline.id
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
      {columns.length > 0 ? (
        <PipelineBoard columns={columns} />
      ) : (
        <div className="text-center py-16 text-sm text-onSurface-variant">
          No pipeline items found. Add your first deal to get started.
        </div>
      )}
    </div>
  );
}
