import React, { useState, useRef } from 'react';
import { SubtitleCue, SavedAudioItem, AppLanguage } from '../types';
import { SAMPLE_SRT, SAMPLE_SRT_KHMER, CURATED_VOICES } from '../data/presets';
import { parseSRT, formatSRT, secondsToSrtTime, SubtitleCue as CueType } from '../utils/audioMath';
import { voiceEngine } from '../services/voiceEngine';
import { ExportSettingsModal } from './ExportSettingsModal';
import { AudioExportConfig } from '../utils/audioMath';
import {
  Subtitles,
  Play,
  Square,
  Upload,
  Download,
  Plus,
  Trash2,
  FileText,
  Volume2,
  BookmarkPlus,
  Sparkles,
  Check,
  Settings2,
} from 'lucide-react';

interface SubtitleStudioProps {
  onSaveToLibrary: (item: SavedAudioItem) => void;
  uiLang?: AppLanguage;
}

export const SubtitleStudio: React.FC<SubtitleStudioProps> = ({ onSaveToLibrary, uiLang = 'en' }) => {
  const isKhmer = uiLang === 'km';
  const [cues, setCues] = useState<CueType[]>(() => parseSRT(isKhmer ? SAMPLE_SRT_KHMER : SAMPLE_SRT));
  const [isPlayingAll, setIsPlayingAll] = useState<boolean>(false);
  const [activeCueId, setActiveCueId] = useState<number | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(CURATED_VOICES[0].id);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [rawView, setRawView] = useState<boolean>(false);
  const [rawText, setRawText] = useState<string>(SAMPLE_SRT);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportConfig, setExportConfig] = useState<AudioExportConfig>({
    format: 'wav',
    sampleRate: 48000, // Video dubbing broadcast default
    bitrate: 192,
    channels: 'stereo',
    normalizeGain: true,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedVoice = CURATED_VOICES.find((v) => v.id === selectedVoiceId) || CURATED_VOICES[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseSRT(content);
        setCues(parsed);
        setRawText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateCue = (id: number, field: keyof CueType, value: any) => {
    setCues((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, [field]: value };
        if (field === 'startSeconds' || field === 'endSeconds') {
          updated.duration = Math.max(0.1, updated.endSeconds - updated.startSeconds);
          updated.startTime = secondsToSrtTime(updated.startSeconds);
          updated.endTime = secondsToSrtTime(updated.endSeconds);
        }
        return updated;
      })
    );
  };

  const handleDeleteCue = (id: number) => {
    setCues((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddCue = () => {
    const lastCue = cues[cues.length - 1];
    const newStart = lastCue ? Math.round((lastCue.endSeconds + 0.5) * 10) / 10 : 0;
    const newEnd = Math.round((newStart + 3.0) * 10) / 10;
    const newId = (lastCue?.id || 0) + 1;

    const newCue: SubtitleCue = {
      id: newId,
      startSeconds: newStart,
      endSeconds: newEnd,
      duration: 3.0,
      startTime: secondsToSrtTime(newStart),
      endTime: secondsToSrtTime(newEnd),
      text: 'New subtitle narration segment...',
      speaker: 'Narrator',
    };

    setCues((prev) => [...prev, newCue]);
  };

  const handlePlaySingleCue = (cue: CueType) => {
    if (isPlayingAll) {
      voiceEngine.stopSpeaking();
      setIsPlayingAll(false);
    }
    setActiveCueId(cue.id);
    voiceEngine.speakText(cue.text, {
      voiceProfile: selectedVoice,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      onEnd: () => setActiveCueId(null),
      onError: () => setActiveCueId(null),
    });
  };

  const handleSynthesizeAll = async () => {
    if (isPlayingAll) {
      voiceEngine.stopSpeaking();
      setIsPlayingAll(false);
      setActiveCueId(null);
      return;
    }

    setIsPlayingAll(true);

    for (const cue of cues) {
      setActiveCueId(cue.id);
      await voiceEngine.speakText(cue.text, {
        voiceProfile: selectedVoice,
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
      });
      // Short breath gap between subtitle lines
      await new Promise((r) => setTimeout(r, 400));
    }

    setIsPlayingAll(false);
    setActiveCueId(null);
  };

  const handleExportWithConfig = (cfg: AudioExportConfig) => {
    setExportConfig(cfg);
    const combinedText = cues.map((c) => c.text).join(' [pause 0.6s] ');
    const generated = voiceEngine.generateAudioWav(combinedText, {
      rate: 1.0,
      pitchMultiplier: 1.0,
      voiceGender: selectedVoice.gender,
      sampleRate: cfg.sampleRate,
      bitrate: cfg.bitrate,
      channels: cfg.channels,
      format: cfg.format,
    });

    const ext = cfg.format;
    const link = document.createElement('a');
    link.href = generated.url;
    link.download = `VoiceTool_Dubbed_Subtitles_${(cfg.sampleRate / 1000).toFixed(1)}kHz_${cfg.bitrate}kbps_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSRT = () => {
    const formatted = formatSRT(cues);
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subtitles_${Date.now()}.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToLibrary = () => {
    const combinedText = cues.map((c) => c.text).join(' ');
    const generated = voiceEngine.generateAudioWav(combinedText, {
      rate: 1.0,
      pitchMultiplier: 1.0,
      voiceGender: selectedVoice.gender,
    });

    const totalDuration = cues.length > 0 ? cues[cues.length - 1].endSeconds : 10;

    const item: SavedAudioItem = {
      id: `srt-${Date.now()}`,
      title: `Dubbed Subtitle (${cues.length} cues)`,
      type: 'subtitle',
      createdAt: Date.now(),
      durationSeconds: Math.round(totalDuration),
      audioBlobUrl: generated.url,
      transcript: cues.map((c) => `${c.speaker || 'Narrator'}: ${c.text}`).join(' | '),
      voiceName: selectedVoice.name,
      fileSizeFormatted: `${Math.round(totalDuration * 172)} KB`,
    };

    onSaveToLibrary(item);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const totalDuration = cues.length > 0 ? cues[cues.length - 1].endSeconds : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Subtitles className="w-5 h-5 text-emerald-400" />
            {isKhmer ? 'ស្ទូឌីយោបម្លែងចំណងជើងរងជាសំឡេង (SRT Dubbing)' : 'Subtitle to Speech Studio (SRT to Audio)'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isKhmer
              ? 'បម្លែងឯកសារចំណងជើងរង (.srt, .vtt) ទៅជាសំឡេងនិយាយស្របតាមពេលវេលាក្នុងវីដេអូ'
              : 'Turn subtitle files (.srt, .vtt) into fully dubbed voiceover audio tracks with timecode synchronization.'}
          </p>
        </div>

        {/* Upload & Sample Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".srt,.vtt,.txt"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isKhmer ? 'បញ្ចូលឯកសារ .SRT' : 'Upload .SRT File'}</span>
          </button>

          <button
            onClick={() => {
              setCues(parseSRT(SAMPLE_SRT_KHMER));
              setRawText(SAMPLE_SRT_KHMER);
              const khmerVoice = CURATED_VOICES.find((v) => v.lang === 'km-KH');
              if (khmerVoice) setSelectedVoiceId(khmerVoice.id);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/80 text-xs font-medium text-indigo-300 border border-indigo-700/60 transition-colors"
            title="Load Khmer Subtitles"
          >
            <span>🇰🇭</span>
            <span>{isKhmer ? 'គំរូអក្សរខ្មែរ (SRT)' : 'Khmer Sample'}</span>
          </button>

          <button
            onClick={() => {
              setCues(parseSRT(SAMPLE_SRT));
              setRawText(SAMPLE_SRT);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors"
          >
            {isKhmer ? 'គំរូអង់គ្លេស' : 'EN Sample'}
          </button>

          <button
            onClick={() => {
              if (rawView) {
                setCues(parseSRT(rawText));
              } else {
                setRawText(formatSRT(cues));
              }
              setRawView(!rawView);
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>{rawView ? (isKhmer ? 'ទម្រង់កាត' : 'Visual Cues View') : (isKhmer ? 'ទម្រង់អត្ថបទដើម' : 'Raw Text View')}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-4">
        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {/* Voice Model Selector for Dubbing */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Dubbing Voice:</span>
              <select
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {CURATED_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.country} {v.name} ({v.languageLabel} - {v.gender})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-400">
              <strong className="text-slate-200">{cues.length}</strong> Cues &bull;{' '}
              <strong className="text-slate-200">{Math.round(totalDuration)}s</strong> Total Duration
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Synthesize All Audio Playback */}
            <button
              onClick={handleSynthesizeAll}
              disabled={cues.length === 0}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all ${
                isPlayingAll
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              } disabled:opacity-50`}
            >
              {isPlayingAll ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Dubbing</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Full Audio Track</span>
                </>
              )}
            </button>

            {/* Advanced Export Settings */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              disabled={cues.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Configure Sample Rate (44.1kHz / 48kHz) & Bitrate (128k, 192k, 320k)"
            >
              <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Settings ({(exportConfig.sampleRate / 1000).toFixed(1)}kHz &bull; {exportConfig.bitrate}k)</span>
            </button>

            {/* Download Dubbed Audio */}
            <button
              onClick={() => handleExportWithConfig(exportConfig)}
              disabled={cues.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ({exportConfig.format.toUpperCase()} &bull; {(exportConfig.sampleRate / 1000).toFixed(1)}kHz)</span>
            </button>

            {/* Export SRT */}
            <button
              onClick={handleDownloadSRT}
              disabled={cues.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Export .SRT</span>
            </button>

            {/* Save to library */}
            <button
              onClick={handleSaveToLibrary}
              disabled={cues.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isSaved
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Save to Library</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Cues Table / Raw Textarea */}
        {rawView ? (
          <div className="space-y-2">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={14}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-3 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Paste raw .srt format here..."
            />
            <button
              onClick={() => {
                setCues(parseSRT(rawText));
                setRawView(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
            >
              Apply and Convert to Visual Cues
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {cues.map((cue, index) => {
                const isActive = activeCueId === cue.id;
                return (
                  <div
                    key={cue.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded flex items-center justify-center bg-slate-800 text-slate-300 text-xs font-bold font-mono">
                          {index + 1}
                        </span>

                        {/* Speaker tag input */}
                        <input
                          type="text"
                          value={cue.speaker || 'Narrator'}
                          onChange={(e) => handleUpdateCue(cue.id, 'speaker', e.target.value)}
                          className="w-28 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-xs font-semibold text-emerald-300 focus:outline-none focus:border-emerald-500"
                          title="Speaker Name"
                        />

                        {/* Timecode markers */}
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                          <input
                            type="number"
                            step="0.1"
                            value={cue.startSeconds}
                            onChange={(e) =>
                              handleUpdateCue(cue.id, 'startSeconds', parseFloat(e.target.value) || 0)
                            }
                            className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-center text-slate-200"
                          />
                          <span>s &rarr;</span>
                          <input
                            type="number"
                            step="0.1"
                            value={cue.endSeconds}
                            onChange={(e) =>
                              handleUpdateCue(cue.id, 'endSeconds', parseFloat(e.target.value) || 0)
                            }
                            className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-center text-slate-200"
                          />
                          <span>s ({cue.duration}s)</span>
                        </div>
                      </div>

                      {/* Cue action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handlePlaySingleCue(cue)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white'
                          }`}
                          title="Audition this subtitle line"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Audition</span>
                        </button>

                        <button
                          onClick={() => handleDeleteCue(cue.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete cue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subtitle Text Editable */}
                    <input
                      type="text"
                      value={cue.text}
                      onChange={(e) => handleUpdateCue(cue.id, 'text', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Subtitle narration content..."
                    />
                  </div>
                );
              })}
            </div>

            {/* Add Cue Button */}
            <button
              onClick={handleAddCue}
              className="w-full py-2.5 rounded-lg border border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/40 hover:bg-emerald-950/10 text-xs font-semibold text-slate-300 hover:text-emerald-300 flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subtitle Cue</span>
            </button>
          </div>
        )}
      </div>

      {/* Export Settings Modal */}
      <ExportSettingsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        durationSeconds={totalDuration}
        initialConfig={exportConfig}
        onExport={handleExportWithConfig}
        title="Subtitle Dubbing Audio Export Settings"
        defaultFilename="VoiceTool_Dubbed_Subtitles"
      />
    </div>
  );
};
