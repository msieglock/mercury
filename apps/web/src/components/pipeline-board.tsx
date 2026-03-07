'use client';

import { useState } from 'react';
import { Plus, GripVertical, MoreHorizontal } from 'lucide-react';
import { cn, formatCurrency, getInitials } from '@/lib/utils';

interface PipelineCard {
  id: string;
  contactName: string;
  company: string;
  value: number;
  score: number;
  daysInStage: number;
  avatarUrl?: string | null;
}

interface PipelineColumnData {
  id: string;
  name: string;
  cards: PipelineCard[];
}

interface PipelineBoardProps {
  columns: PipelineColumnData[];
  onMoveCard?: (cardId: string, fromColumn: string, toColumn: string) => void;
  onAddItem?: (columnId: string) => void;
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full h-1.5 bg-warm-gray-100 rounded-full overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-warm-gray-300',
        )}
        style={{ width: `${Math.min(score, 100)}%` }}
      />
    </div>
  );
}

function KanbanCard({ card }: { card: PipelineCard }) {
  return (
    <div
      className={cn(
        'bg-white rounded-mercury border border-warm-gray-200 p-4 cursor-grab active:cursor-grabbing',
        'hover:shadow-mercury hover:border-warm-gray-300 transition-mercury group',
      )}
      draggable
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-mercury pt-0.5">
          <GripVertical className="w-3.5 h-3.5 text-warm-gray-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-warm-gray-300 to-warm-gray-400 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-semibold text-white">
                  {getInitials(card.contactName)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">
                  {card.contactName}
                </p>
                <p className="text-xs text-warm-gray-500 truncate">
                  {card.company}
                </p>
              </div>
            </div>
            <button className="p-1 opacity-0 group-hover:opacity-100 text-warm-gray-400 hover:text-charcoal transition-mercury rounded">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-charcoal">
              {formatCurrency(card.value)}
            </span>
            <span className="text-xs text-warm-gray-400">
              {card.daysInStage}d
            </span>
          </div>

          <div className="mt-2">
            <ScoreBar score={card.score} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PipelineBoard({
  columns,
  onMoveCard,
  onAddItem,
}: PipelineBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-mercury pb-4 -mx-2 px-2">
      {columns.map((column) => {
        const totalValue = column.cards.reduce((sum, c) => sum + c.value, 0);
        return (
          <div
            key={column.id}
            className="flex-shrink-0 w-[300px]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-charcoal">
                  {column.name}
                </h3>
                <span className="text-xs font-medium text-warm-gray-400 bg-warm-gray-100 px-2 py-0.5 rounded-full">
                  {column.cards.length}
                </span>
              </div>
              <span className="text-xs font-medium text-warm-gray-500">
                {formatCurrency(totalValue)}
              </span>
            </div>

            {/* Column Body */}
            <div className="bg-warm-gray-50 rounded-mercury-lg p-2 min-h-[200px] space-y-2">
              {column.cards.map((card) => (
                <KanbanCard key={card.id} card={card} />
              ))}

              {/* Add Button */}
              <button
                onClick={() => onAddItem?.(column.id)}
                className={cn(
                  'w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium',
                  'text-warm-gray-400 hover:text-warm-gray-600 hover:bg-warm-gray-100',
                  'rounded-mercury border border-dashed border-warm-gray-200 hover:border-warm-gray-300',
                  'transition-mercury',
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                Add item
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
