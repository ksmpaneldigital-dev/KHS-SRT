import React, { useState } from 'react';
import { SavedAudioItem } from '../types';
import {
  FolderHeart,
  Play,
  Pause,
  Download,
  Trash2,
  Volume2,
  Mic,
  Subtitles,
  Sliders,
  Calendar,
  Clock,
  Search,
} from 'lucide-react';

interface LibraryModalProps {
  items: SavedAudioItem[];
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  items,
  onDeleteItem,
  onClearAll,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);

  const handlePlayToggle = (item: SavedAudioItem) => {
    if (!item.audioBlobUrl) return;

    if (playingId === item.id) {
      activeAudio?.pause();
      setPlayingId(null);
    } else {
      activeAudio?.pause();
      const audio = new Audio(item.audioBlobUrl);
      audio.onended = () => setPlayingId(null);
      audio.play();
      setActiveAudio(audio);
      setPlayingId(item.id);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (
      searchQuery &&
      !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.transcript?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getTypeIcon = (type: SavedAudioItem['type']) => {
    switch (type) {
      case 'tts':
        return <Volume2 className="w-4 h-4 text-indigo-400" />;
      case 'recording':
        return <Mic className="w-4 h-4 text-rose-400" />;
      case 'subtitle':
        return <Subtitles className="w-4 h-4 text-emerald-400" />;
      case 'tool':
        return <Sliders className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderHeart className="w-5 h-5 text-amber-400" />
            Audio Project Library &amp; History
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Access, re-listen, and download all generated voiceovers and recorded clips.
          </p>
        </div>

        {items.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-xs font-medium text-rose-300 border border-rose-800/60 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Library</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audio titles or transcripts..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'tts', 'recording', 'subtitle', 'tool'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                filterType === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {t === 'tts' ? 'TTS Studio' : t === 'subtitle' ? 'Dubbed SRT' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
          <FolderHeart className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-medium text-slate-400">
            {items.length === 0
              ? 'Your audio library is empty. Generate a TTS voiceover or record audio to save it here!'
              : 'No items found matching your search filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isPlaying = playingId === item.id;
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        {getTypeIcon(item.type)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white line-clamp-1">{item.title}</h4>
                        {item.voiceName && (
                          <span className="text-[10px] text-indigo-400 font-medium">
                            {item.voiceName}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete audio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {item.transcript && (
                    <p className="text-[11px] text-slate-400 mt-2.5 line-clamp-2 italic bg-slate-950/60 p-2 rounded border border-slate-800/60">
                      "{item.transcript}"
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {item.durationSeconds}s
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <span>{item.fileSizeFormatted}</span>
                  </div>

                  {/* Play & Download Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePlayToggle(item)}
                      disabled={!item.audioBlobUrl}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isPlaying
                          ? 'bg-rose-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                      } disabled:opacity-40`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3 h-3" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>Play Audio</span>
                        </>
                      )}
                    </button>

                    {item.audioBlobUrl && (
                      <a
                        href={item.audioBlobUrl}
                        download={`${item.title.replace(/\s+/g, '_')}.wav`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                        title="Download WAV"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
