import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FolderOpen, FileText, Settings, Play, Download, CheckCircle, Loader2, Maximize2, X, Flag, CheckSquare, Square, Info, 
  Languages, FileUp, Edit3, Bot, ZoomIn, ZoomOut, Type, MapPin, Users, Building, Calendar, Mail, User, Filter, Cloud, Code, 
  LayoutGrid, Save, FileJson, RotateCw, RotateCcw, Library, AlertTriangle, Upload, ChevronDown, Hash, ListChecks, ArrowRightLeft,
  Search, ExternalLink, Globe, UserCheck, Tag, FileOutput, Package, Briefcase, Sparkles, Bookmark, CloudUpload, Clock, Trash2,
  ChevronRight, PanelLeft, StickyNote, Activity, PieChart, Database, ListFilter, Briefcase as RoleIcon, Plus, Link as LinkIcon, Link2Off,
  FileSpreadsheet, ShieldCheck, Star, Fingerprint, History, Check, UserMinus, UserPlus, Save as SaveIcon, BookOpen, Layers,
  ChevronDown as ChevronDownIcon, FileSearch, GraduationCap, FlagTriangleLeft, HandMetal, Heart, Landmark, Send, UserCircle, Eye,
  RefreshCw, Maximize, Minimize, User as UserIcon, Zap, Cpu, AlertCircle, ChevronLeft, Trash, ArrowDownAz, ArrowUpAz
} from 'lucide-react';
import { ArchivalPage, AppState, AnalysisMode, Tier, ProcessingStatus, Cluster, ClusterPageRef, Correspondent, EntityReference, NamedEntities, ReconciliationRecord, SourceAppearance, DocType } from '../types';
import { analyzePageContent, transcribeAndTranslatePage, reanalyzeClusterMetadata, clusterPagesPairwise } from '../services/geminiService';
import { listFilesFromDrive, fetchFileFromDrive, uploadFileToDrive } from '../services/googleDriveService';
import { generateTSV, generateClustersTSV, generateVocabularyCSV, generateMasterVocabularyCSV, generateFullJSON, generateProjectBackup, generateProjectZip, downloadFile, createImagePreview } from '../utils/fileUtils';
import { CONTROLLED_VOCABULARY, SUBJECTS_LIST, DOCUMENT_TYPES, PRISON_MASTER_LIST } from '../services/vocabulary';

const PRESET_ARCHIVES = [
  "CAHJP - Central Archives for the History of the Jewish People (Magnes)",
  "CZA - Central Zionist Archive",
  "HA - Haganah Archives",
  "HMA - Haifa Municipality Archives",
  "IPA - Israeli Press Archive",
  "ISA - Israel State Archives",
  "JIA - Jabotinsky Institute Archives",
  "JMA - Jerusalem Municipal Archives",
  "Press",
  "TAMA - Tel Aviv Municipal Archives"
];

const NATIONALITIES = ["Arab", "British", "German", "Jew", "Other"];

const APP_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.API_KEY ||
  null;

const INITIAL_STATE: AppState = {
  apiKey: APP_API_KEY,
  userName: "",
  mode: null,
  tier: Tier.FREE,
  files: [],
  clusters: [],
  reconciliationList: [],
  masterVocabulary: CONTROLLED_VOCABULARY as EntityReference[],
  processingStatus: { total: 0, processed: 0, currentStep: 'idle', isComplete: false },
  uiState: 'welcome',
  archiveName: "",
};

const TagInput: React.FC<{ 
  items: string[]; 
  onAdd: (item: string) => void; 
  onRemove: (idx: number) => void; 
  placeholder?: string;
  label?: string;
}> = ({ items, onAdd, onRemove, placeholder, label }) => {
  const [val, setVal] = useState("");
  return (
    <div className="space-y-3">
      {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>}
      <div className="flex flex-wrap gap-2 min-h-[44px] p-2 bg-slate-50 border border-slate-200 rounded-2xl">
        {items.map((item, i) => (
          <span key={i} className="px-3 py-1 bg-white border rounded-xl text-xs font-bold flex items-center gap-2 group">
            {item}
            <button onClick={() => onRemove(i)} className="text-slate-300 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input 
          type="text" 
          value={val} 
          onChange={e => setVal(e.target.value)} 
          onKeyDown={e => { if(e.key === 'Enter' && val) { e.preventDefault(); onAdd(val); setVal(""); } }}
          placeholder={placeholder}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-xs font-bold p-1" 
        />
      </div>
    </div>
  );
};

const CorrespondentListEditor: React.FC<{ 
  correspondents: Correspondent[]; 
  onChange: (updated: Correspondent[]) => void; 
  label: string;
  icon: React.ReactNode;
}> = ({ correspondents, onChange, label, icon }) => {
  const add = () => onChange([...correspondents, { name: "", role: "", nationality: "Other", organizationCategory: "" }]);
  const remove = (idx: number) => onChange(correspondents.filter((_, i) => i !== idx));
  const update = (idx: number, patch: Partial<Correspondent>) => onChange(correspondents.map((c, i) => i === idx ? { ...c, ...patch } : c));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">{icon} {label}</label>
        <button onClick={add} className="p-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Plus className="w-4 h-4" /></button>
      </div>
      <div className="space-y-3">
        {correspondents.map((c, i) => (
          <div key={i} className="p-4 bg-slate-50 rounded-2xl border flex flex-col gap-3 group relative">
            <button onClick={() => remove(i)} className="absolute -top-2 -right-2 p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm"><Trash className="w-3 h-3" /></button>
            <input 
              placeholder="Name" 
              className="bg-white border rounded-xl px-3 py-1.5 text-xs font-black outline-none focus:border-blue-500" 
              value={c.name} onChange={e => update(i, { name: e.target.value })} 
            />
            <div className="grid grid-cols-2 gap-2">
              <input 
                placeholder="Role" 
                className="bg-white border rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none" 
                value={c.role} onChange={e => update(i, { role: e.target.value })} 
              />
              <select 
                className="bg-white border rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none" 
                value={c.nationality} onChange={e => update(i, { nationality: e.target.value })}
              >
                {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <input 
              placeholder="Organization Category" 
              className="bg-white border rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none" 
              value={c.organizationCategory} onChange={e => update(i, { organizationCategory: e.target.value })} 
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const EntityListEditor: React.FC<{ 
  entities: EntityReference[]; 
  onChange: (updated: EntityReference[]) => void; 
  label: string;
  type: 'person' | 'organization' | 'prison' | 'role';
}> = ({ entities, onChange, label, type }) => {
  const add = () => onChange([...entities, { name: "", type }]);
  const remove = (idx: number) => onChange(entities.filter((_, i) => i !== idx));
  const update = (idx: number, patch: Partial<EntityReference>) => onChange(entities.map((e, i) => i === idx ? { ...e, ...patch } : e));

  const handlePrisonSelect = (idx: number, prisonName: string) => {
    const master = PRISON_MASTER_LIST.find(p => p.name === prisonName);
    update(idx, { name: prisonName, id: master?.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
        <button onClick={add} className="p-1 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-900 hover:text-white transition-all"><Plus className="w-4 h-4" /></button>
      </div>
      <div className="space-y-2">
        {entities.map((ent, i) => (
          <div key={i} className="bg-slate-50 rounded-xl border p-3 flex flex-col gap-2 group relative">
            <button onClick={() => remove(i)} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X className="w-3.5 h-3.5" /></button>
            
            {type === 'prison' ? (
              <div className="flex flex-col gap-1">
                <select 
                  className="bg-white border rounded-lg px-2 py-1 text-xs font-bold outline-none" 
                  value={ent.name || ""} 
                  onChange={e => handlePrisonSelect(i, e.target.value)}
                >
                  <option value="">-- Select Master Prison or Add New --</option>
                  {PRISON_MASTER_LIST.map(p => <option key={p.id} value={p.name}>{p.name} (ID: {p.id})</option>)}
                  {ent.name && !PRISON_MASTER_LIST.some(p => p.name === ent.name) && <option value={ent.name}>{ent.name} (Custom)</option>}
                </select>
                <input 
                  placeholder="Or type custom prison name..." 
                  className="bg-white border rounded-lg px-2 py-1 text-[10px] outline-none" 
                  value={ent.name} 
                  onChange={e => update(i, { name: e.target.value, id: PRISON_MASTER_LIST.find(p => p.name === e.target.value)?.id })} 
                />
              </div>
            ) : (
              <input 
                placeholder="Name" 
                className="bg-white border rounded-lg px-2 py-1 text-xs font-bold outline-none" 
                value={ent.name} onChange={e => update(i, { name: e.target.value })} 
              />
            )}

            {type === 'person' && (
              <div className="grid grid-cols-2 gap-2">
                <select 
                  className="bg-white border rounded-lg px-2 py-1 text-[10px] outline-none" 
                  value={ent.nationality} onChange={e => update(i, { nationality: e.target.value })}
                >
                  <option value="">Nationality</option>
                  {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <input 
                  placeholder="Category" 
                  className="bg-white border rounded-lg px-2 py-1 text-[10px] outline-none" 
                  value={ent.organizationCategory} onChange={e => update(i, { organizationCategory: e.target.value })} 
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ClusterEditor: React.FC<{ 
  cluster: Cluster; 
  onClose: () => void; 
  onSave: (updated: Cluster) => void;
}> = ({ cluster, onClose, onSave }) => {
  const [edited, setEdited] = React.useState<Cluster>({ ...cluster });

  const handleSave = () => {
    onSave(edited);
  };

  const updateEntities = (patch: Partial<NamedEntities>) => {
    setEdited({
      ...edited,
      entities: {
        people: edited.entities?.people || [],
        organizations: edited.entities?.organizations || [],
        roles: edited.entities?.roles || [],
        prisons: edited.entities?.prisons || [],
        ...patch
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-8 overflow-hidden">
      <div className="bg-white w-full max-w-6xl rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">
        <header className="p-8 border-b flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 text-white text-xs font-black px-5 py-2 rounded-2xl uppercase flex items-center gap-2 shadow-lg">
              <Bot className="w-4 h-4" /> Cluster #{cluster.id}
            </div>
            <h3 className="text-2xl font-black italic uppercase tracking-tight text-slate-800">Metadata Studio</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-2xl transition-all"><X className="w-7 h-7 text-slate-400" /></button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-4 space-y-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Type className="w-4 h-4" /> Document Title
              </label>
              <input 
                type="text" 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-inner" 
                value={edited.title} 
                onChange={e => setEdited({ ...edited, title: e.target.value })} 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Standardized Date
                </label>
                <input 
                  type="text" 
                  placeholder="YYYY-MM-DD"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500 transition-all shadow-inner" 
                  value={edited.standardizedDate || ''} 
                  onChange={e => setEdited({ ...edited, standardizedDate: e.target.value })} 
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Original Date Text
                </label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500 transition-all shadow-inner" 
                  value={edited.originalDate || ''} 
                  onChange={e => setEdited({ ...edited, originalDate: e.target.value })} 
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <StickyNote className="w-4 h-4" /> Executive Summary
              </label>
              <textarea 
                className="w-full bg-slate-50 border border-slate-200 rounded-[32px] p-6 text-sm font-medium outline-none focus:border-blue-500 h-48 resize-none shadow-inner leading-relaxed" 
                value={edited.summary} 
                onChange={e => setEdited({ ...edited, summary: e.target.value })} 
              />
            </div>

            <TagInput 
              label="Subjects" 
              items={edited.subjects || []} 
              onAdd={s => setEdited({ ...edited, subjects: [...(edited.subjects || []), s] })} 
              onRemove={idx => setEdited({ ...edited, subjects: (edited.subjects || []).filter((_, i) => i !== idx) })} 
              placeholder="Press Enter to add..."
            />
          </div>

          <div className="lg:col-span-4 space-y-10 border-x px-8">
            <h4 className="text-xl font-black italic uppercase text-slate-900 border-b pb-4">Correspondence</h4>
            <CorrespondentListEditor 
              label="Senders (From)" 
              correspondents={edited.senders || []} 
              icon={<Send className="w-3.5 h-3.5" />}
              onChange={s => setEdited({ ...edited, senders: s })} 
            />
            <CorrespondentListEditor 
              label="Recipients (To)" 
              correspondents={edited.recipients || []} 
              icon={<Mail className="w-3.5 h-3.5" />}
              onChange={r => setEdited({ ...edited, recipients: r })} 
            />
          </div>

          <div className="lg:col-span-4 space-y-10">
            <h4 className="text-xl font-black italic uppercase text-slate-900 border-b pb-4">Mentioned Entities</h4>
            <div className="grid grid-cols-1 gap-8">
              <EntityListEditor 
                label="People Mentioned" 
                type="person" 
                entities={edited.entities?.people || []} 
                onChange={p => updateEntities({ people: p })} 
              />
              <EntityListEditor 
                label="Organizations Mentioned" 
                type="organization" 
                entities={edited.entities?.organizations || []} 
                onChange={o => updateEntities({ organizations: o })} 
              />
              <EntityListEditor 
                label="Prisons Mentioned" 
                type="prison" 
                entities={edited.entities?.prisons || []} 
                onChange={p => updateEntities({ prisons: p })} 
              />
            </div>
          </div>
        </div>

        <footer className="p-8 border-t bg-slate-50/50 flex gap-4 shrink-0">
          <button onClick={onClose} className="flex-1 py-5 bg-white border border-slate-200 text-slate-500 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-slate-100 transition-all">Discard Changes</button>
          <button 
            onClick={handleSave} 
            className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-2xl active:scale-95"
          >
            Update Project Metadata
          </button>
        </footer>
      </div>
    </div>
  );
};

const getTextDirection = (text: string | undefined): 'rtl' | 'ltr' => {
  if (!text) return 'ltr';
  return /[\u0590-\u05FF]/.test(text) ? 'rtl' : 'ltr';
};

const ProcessingBanner: React.FC<{ status: ProcessingStatus }> = ({ status }) => {
  if (status.total === 0 || status.isComplete) return null;
  const percentage = Math.round((status.processed / status.total) * 100);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-lg px-4">
      <div className="bg-slate-900 text-white rounded-[32px] shadow-2xl p-6 border border-white/10 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-xl animate-pulse">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gemini Task Active</div>
              <div className="text-sm font-black italic uppercase tracking-tight">{status.currentStep}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black italic tracking-tighter">{percentage}%</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">{status.processed} / {status.total} pages</div>
          </div>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(37,99,235,0.5)]" 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageViewId, setPageViewId] = useState<string | null>(null);
  const [pageViewField, setPageViewField] = useState<'manualTranscription' | 'manualDescription' | 'generatedTranslation'>('manualTranscription');
  const [projectTitle, setProjectTitle] = useState<string>("Archival Project");
  const [archiveName, setArchiveName] = useState<string>("");
  const [editingClusterId, setEditingClusterId] = useState<number | null>(null);
  const [clusterPast, setClusterPast] = useState<Cluster[][]>([]);
  const [clusterFuture, setClusterFuture] = useState<Cluster[][]>([]);
  const [dirtyClusterIds, setDirtyClusterIds] = useState<Set<number>>(new Set());
  const [reanalyzingClusterIds, setReanalyzingClusterIds] = useState<Set<number>>(new Set());
  const [dragReorderState, setDragReorderState] = useState<{ pageId: string; clusterId: number } | null>(null);
  const [splitMenuState, setSplitMenuState] = useState<{ clusterId: number; pageId: string } | null>(null);
  const [pagesCollapsed, setPagesCollapsed] = useState(() => false);
  const prevClusterCountRef = useRef(0);
  
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLanguage, setFilterLanguage] = useState<string>("All");
  const [filterProductionMode, setFilterProductionMode] = useState<string>("All");
  const [filterConfidence, setFilterConfidence] = useState<string>("All");

  const [rangeStart, setRangeStart] = useState<string>("1");
  const [rangeEnd, setRangeEnd] = useState<string>("");

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isZipping, setIsZipping] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);

  // Research Index States
  const [indexSubTab, setIndexSubTab] = useState<'project' | 'master'>('project');
  const [recSearch, setRecSearch] = useState("");
  const [activeRecId, setActiveRecId] = useState<string | null>(null);
  const [recFilterType, setRecFilterType] = useState<'all' | 'person' | 'organization' | 'role' | 'prison'>('all');

  useEffect(() => {
    if (state.files.length > 0 && !rangeEnd) {
      setRangeEnd(state.files.length.toString());
    }
  }, [state.files]);

  useEffect(() => {
    if (state.uiState === 'welcome') return;
    if (state.files.length === 0) return;
    syncReconciliation();
  }, [state.clusters, state.files, state.masterVocabulary]);

  useEffect(() => {
    if (prevClusterCountRef.current === 0 && state.clusters.length > 0) setPagesCollapsed(true);
    prevClusterCountRef.current = state.clusters.length;
  }, [state.clusters.length]);

  useEffect(() => {
    if (!splitMenuState) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-split-menu]')) setSplitMenuState(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [splitMenuState]);

  const normalizeIndexPart = (value: string): string =>
    String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[.,;:!?()\[\]{}"'`~_\-/\\]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const buildIndexKey = (sourceDocumentName: string, fileName: string, sourcePageNumber?: number, sourcePath?: string): string => {
    const base = [sourceDocumentName, fileName, sourcePath || '', sourcePageNumber?.toString() || '0']
      .map(normalizeIndexPart)
      .join('|');
    return base;
  };

  const ensurePageIndexMetadata = (page: ArchivalPage, fallbackOrder: number): ArchivalPage => {
    const pageNoFromFile = page.fileName.match(/_page_(\d+)/i)?.[1];
    const derivedPageNo = pageNoFromFile ? parseInt(pageNoFromFile, 10) : undefined;
    const sourceDocumentName = page.sourceDocumentName || page.fileName.replace(/_page_\d+\.[^/.]+$/i, '') || page.fileName;
    const sourcePageNumber = page.sourcePageNumber ?? derivedPageNo ?? 1;
    const sourcePath = page.sourcePath || page.fileName;
    const ingestOrder = page.ingestOrder ?? fallbackOrder;

    return {
      ...page,
      sourceDocumentName,
      sourcePageNumber,
      sourcePath,
      ingestOrder,
      indexSchemaVersion: page.indexSchemaVersion || 1,
      indexKey: page.indexKey || buildIndexKey(sourceDocumentName, page.fileName, sourcePageNumber, sourcePath)
    };
  };

  const filteredPages = useMemo(() => {
    return state.files.filter(f => {
      const matchesSearch = f.indexName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (f.manualTranscription || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (f.generatedTranscription || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLang = filterLanguage === "All" || f.language === filterLanguage;
      const matchesProd = filterProductionMode === "All" || f.productionMode === filterProductionMode;
      const matchesConf = filterConfidence === "All" || 
                        (filterConfidence === "Low Certainty" && f.confidenceScore !== undefined && f.confidenceScore <= 2) ||
                        (filterConfidence === "High Certainty" && f.confidenceScore !== undefined && f.confidenceScore > 2);
      return matchesSearch && matchesLang && matchesProd && matchesConf;
    });
  }, [state.files, searchTerm, filterLanguage, filterProductionMode, filterConfidence]);

  const pageOrderMap = useMemo(() => {
    return new Map(state.files.map((file, index) => [file.id, index + 1]));
  }, [state.files]);

  const MAX_CLUSTER_HISTORY = 50;

  const snapshotClusters = (clusters: Cluster[]): Cluster[] => {
    return clusters.map(c => ({
      ...c,
      pageIds: [...c.pageIds],
      pageRefs: c.pageRefs ? c.pageRefs.map(ref => ({ ...ref })) : c.pageRefs,
      docTypes: c.docTypes ? [...c.docTypes] : c.docTypes,
      subjects: c.subjects ? [...c.subjects] : c.subjects,
      languages: c.languages ? [...c.languages] : c.languages,
      senders: c.senders ? c.senders.map(s => ({ ...s })) : c.senders,
      recipients: c.recipients ? c.recipients.map(r => ({ ...r })) : c.recipients,
      entities: c.entities ? {
        people: [...(c.entities.people || [])],
        organizations: [...(c.entities.organizations || [])],
        roles: [...(c.entities.roles || [])],
        prisons: [...(c.entities.prisons || [])],
      } : c.entities,
    }));
  };

  const buildPageRangeFromIds = (pageIds: string[]): string => {
    const pageNumbers = pageIds
      .map(id => pageOrderMap.get(id))
      .filter((num): num is number => typeof num === 'number')
      .sort((a, b) => a - b);

    if (pageNumbers.length === 0) return 'No Pages';
    if (pageNumbers.length === 1) return `Page ${pageNumbers[0]}`;
    return `Page ${pageNumbers[0]}-${pageNumbers[pageNumbers.length - 1]}`;
  };

  const normalizeClusterSet = (clusters: Cluster[]): Cluster[] => {
    return clusters
      .filter(c => c.pageIds.length > 0)
      .map((cluster, index) => {
        const uniquePageIds = Array.from(new Set(cluster.pageIds))
          .sort((a, b) => (pageOrderMap.get(a) || Number.MAX_SAFE_INTEGER) - (pageOrderMap.get(b) || Number.MAX_SAFE_INTEGER));

        const existingRefs = (cluster.pageRefs || []).filter(ref => uniquePageIds.includes(ref.pageId));
        const fullPageRefs = uniquePageIds
          .filter(pageId => !existingRefs.some(ref => ref.pageId === pageId && ref.startChar === undefined && ref.endChar === undefined))
          .map(pageId => ({ pageId, source: cluster.reviewStatus === 'ai-proposed' ? 'ai' as const : 'manual' as const }));

        return {
          ...cluster,
          pageIds: uniquePageIds,
          pageRefs: [...existingRefs, ...fullPageRefs],
          id: index + 1,
          pageRange: buildPageRangeFromIds(uniquePageIds),
        };
      });
  };

  // Safety net: any page not yet in a cluster gets grouped into fallback clusters
  const ensureAllPagesAssigned = (clusters: Cluster[], allPages: ArchivalPage[]): Cluster[] => {
    const assigned = new Set(clusters.flatMap(c => c.pageIds));
    const missing = allPages.filter(p => !assigned.has(p.id));
    if (missing.length === 0) return clusters;
    // Group consecutive missing pages (by pageOrderMap position) together
    const sorted = [...missing].sort((a, b) => (pageOrderMap.get(a.id) ?? 0) - (pageOrderMap.get(b.id) ?? 0));
    const groups: ArchivalPage[][] = [];
    let group: ArchivalPage[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prevOrder = pageOrderMap.get(sorted[i - 1].id) ?? 0;
      const currOrder = pageOrderMap.get(sorted[i].id) ?? 0;
      if (currOrder === prevOrder + 1) { group.push(sorted[i]); }
      else { groups.push(group); group = [sorted[i]]; }
    }
    groups.push(group);
    const maxId = clusters.reduce((m, c) => Math.max(m, c.id), 0);
    const fallbacks: Cluster[] = groups.map((g, i) => ({
      id: maxId + i + 1,
      title: `Unclustered Pages (${g.map(p => p.indexName).join(', ')})`,
      pageRange: '',
      summary: 'Pages not assigned by AI — please review.',
      pageIds: g.map(p => p.id),
      pageRefs: g.map(p => ({ pageId: p.id, source: 'ai' as const })),
      reviewStatus: 'ai-proposed' as const,
      aiConfidence: 1,
      boundaryReasons: ['not assigned by AI'],
      senders: [], recipients: [],
      entities: { people: [], organizations: [], prisons: [], roles: [] },
    }));
    return [...clusters, ...fallbacks];
  };

  const markClustersAsAiProposed = (clusters: Cluster[]): Cluster[] => {
    return clusters.map(cluster => ({
      ...cluster,
      pageRefs: cluster.pageRefs && cluster.pageRefs.length > 0
        ? cluster.pageRefs
        : cluster.pageIds.map(pageId => ({ pageId, source: 'ai' as const })),
      reviewStatus: cluster.reviewStatus || 'ai-proposed',
      reviewedBy: cluster.reviewedBy,
      reviewedAt: cluster.reviewedAt,
    }));
  };

  const commitClusterEdit = (updater: (clusters: Cluster[]) => Cluster[], options?: { markAsHumanReviewed?: boolean }) => {
    setState(prev => {
      const previousClusters = snapshotClusters(prev.clusters);
      let updatedClusters = normalizeClusterSet(updater(snapshotClusters(prev.clusters)));
      const markAsHumanReviewed = options?.markAsHumanReviewed ?? true;

      if (markAsHumanReviewed) {
        const now = new Date().toISOString();
        updatedClusters = updatedClusters.map(cluster => {
          if (cluster.reviewStatus === 'final') {
            return cluster;
          }
          return {
            ...cluster,
            reviewStatus: 'human-reviewed',
            reviewedBy: prev.userName || cluster.reviewedBy,
            reviewedAt: now,
          };
        });
      }

      if (JSON.stringify(previousClusters) === JSON.stringify(updatedClusters)) return prev;

      setClusterPast(history => [...history.slice(-(MAX_CLUSTER_HISTORY - 1)), previousClusters]);
      setClusterFuture([]);

      setTimeout(() => syncReconciliation(), 0);
      return { ...prev, clusters: updatedClusters };
    });
  };

  const keepClusterAsFinal = (clusterId: number) => {
    commitClusterEdit((clusters) => {
      const now = new Date().toISOString();
      return clusters.map(cluster => cluster.id === clusterId ? {
        ...cluster,
        reviewStatus: 'final',
        reviewedBy: state.userName || cluster.reviewedBy,
        reviewedAt: now,
      } : cluster);
    }, { markAsHumanReviewed: false });
  };

  const keepAllClustersAsFinal = () => {
    commitClusterEdit((clusters) => {
      const now = new Date().toISOString();
      return clusters.map(cluster => ({
        ...cluster,
        reviewStatus: 'final',
        reviewedBy: state.userName || cluster.reviewedBy,
        reviewedAt: now,
      }));
    }, { markAsHumanReviewed: false });
  };

  // Split before splitAtPageId → pages from that point become a new document inserted after current
  const splitClusterNewDoc = (clusterId: number, splitAtPageId: string, duplicatePage: boolean) => {
    commitClusterEdit((clusters) => {
      const index = clusters.findIndex(c => c.id === clusterId);
      if (index < 0) return clusters;
      const target = clusters[index];
      const splitIndex = target.pageIds.indexOf(splitAtPageId);
      if (splitIndex <= 0) return clusters;

      const firstIds = duplicatePage
        ? target.pageIds.slice(0, splitIndex + 1)   // keep the boundary page in current
        : target.pageIds.slice(0, splitIndex);
      const secondIds = target.pageIds.slice(splitIndex); // boundary page starts the new doc

      const first = { ...target, pageIds: firstIds, pageRefs: (target.pageRefs || []).filter(r => firstIds.includes(r.pageId)) };
      const second = {
        ...target,
        id: Math.max(...clusters.map(c => c.id)) + 1,
        title: `${target.title} (Part 2)`,
        reviewStatus: 'human-reviewed' as const,
        pageIds: secondIds,
        pageRefs: secondIds.map(pid => ({ pageId: pid, source: 'manual' as const })),
      };

      const next = [...clusters];
      next.splice(index, 1, first, second);
      return next;
    });
    setDirtyClusterIds(prev => { const s = new Set(prev); s.add(clusterId); return s; });
    setSplitMenuState(null);
  };

  // Split before splitAtPageId → pages from that point are prepended to the next existing document
  const splitClusterPrependToNext = (clusterId: number, splitAtPageId: string, duplicatePage: boolean) => {
    commitClusterEdit((clusters) => {
      const index = clusters.findIndex(c => c.id === clusterId);
      if (index < 0 || index >= clusters.length - 1) return clusters;
      const target = clusters[index];
      const nextCluster = clusters[index + 1];
      const splitIndex = target.pageIds.indexOf(splitAtPageId);
      if (splitIndex <= 0) return clusters;

      const movedIds = target.pageIds.slice(splitIndex); // these go to the next doc
      const firstIds = duplicatePage
        ? target.pageIds.slice(0, splitIndex + 1)
        : target.pageIds.slice(0, splitIndex);

      const updatedFirst = { ...target, pageIds: firstIds, pageRefs: (target.pageRefs || []).filter(r => firstIds.includes(r.pageId)) };
      const updatedNext = {
        ...nextCluster,
        pageIds: [...movedIds, ...nextCluster.pageIds],
        pageRefs: [
          ...movedIds.map(pid => ({ pageId: pid, source: 'manual' as const })),
          ...(nextCluster.pageRefs || []),
        ],
      };

      const next = [...clusters];
      next[index] = updatedFirst;
      next[index + 1] = updatedNext;
      return next;
    });
    setDirtyClusterIds(prev => { const s = new Set(prev); s.add(clusterId); return s; });
    setSplitMenuState(null);
  };

  const mergeWithPreviousCluster = (clusterId: number) => {
    commitClusterEdit((clusters) => {
      const index = clusters.findIndex(c => c.id === clusterId);
      if (index <= 0) return clusters;

      const previous = clusters[index - 1];
      const current = clusters[index];
      const merged = {
        ...previous,
        pageIds: [...previous.pageIds, ...current.pageIds]
          .sort((a, b) => (pageOrderMap.get(a) || Number.MAX_SAFE_INTEGER) - (pageOrderMap.get(b) || Number.MAX_SAFE_INTEGER)),
      };

      const next = [...clusters];
      next.splice(index - 1, 2, merged);
      setDirtyClusterIds(prev => new Set(prev).add(merged.id));
      return next;
    });
  };

  const movePageToCluster = (pageId: string, destinationClusterId: number) => {
    commitClusterEdit((clusters) => {
      const destination = clusters.find(c => c.id === destinationClusterId);
      if (!destination) return clusters;

      const removed = clusters.map(cluster => ({
        ...cluster,
        pageIds: cluster.pageIds.filter(id => id !== pageId),
        pageRefs: cluster.pageRefs?.filter(ref => ref.pageId !== pageId),
      }));

      const destinationIndex = removed.findIndex(c => c.id === destinationClusterId);
      if (destinationIndex < 0) return clusters;

      if (!removed[destinationIndex].pageIds.includes(pageId)) {
        removed[destinationIndex] = {
          ...removed[destinationIndex],
          pageIds: [...removed[destinationIndex].pageIds, pageId]
            .sort((a, b) => (pageOrderMap.get(a) || Number.MAX_SAFE_INTEGER) - (pageOrderMap.get(b) || Number.MAX_SAFE_INTEGER)),
          pageRefs: [
            ...(removed[destinationIndex].pageRefs || []).filter(ref => ref.pageId !== pageId),
            { pageId, source: 'manual' as const }
          ],
        };
      }

      return removed;
    });
    setDirtyClusterIds(prev => new Set(prev).add(destinationClusterId));
  };

  const copyPageAsPartialToCluster = (pageId: string, destinationClusterId: number, startChar?: number, endChar?: number, note?: string) => {
    commitClusterEdit((clusters) => {
      const destinationIndex = clusters.findIndex(c => c.id === destinationClusterId);
      if (destinationIndex < 0) return clusters;

      const next = [...clusters];
      const destination = next[destinationIndex];
      const refs: ClusterPageRef[] = destination.pageRefs ? [...destination.pageRefs] : [];

      const existingFullRef = refs.find(ref => ref.pageId === pageId && ref.startChar === undefined && ref.endChar === undefined);
      const fullNote = note || 'Partial page assignment';
      const alreadyMarked = refs.some(ref =>
        ref.pageId === pageId &&
        (startChar === undefined ? ref.note === fullNote : ref.startChar === startChar && ref.endChar === endChar)
      );

      if (!alreadyMarked) {
        refs.push({
          pageId,
          source: 'manual',
          note: startChar === undefined ? fullNote : (note || 'Segment assignment'),
          startChar,
          endChar,
        });
      }

      if (existingFullRef && startChar !== undefined) {
        existingFullRef.note = existingFullRef.note || 'Page also has segment assignment';
      }

      next[destinationIndex] = {
        ...destination,
        pageIds: destination.pageIds.includes(pageId)
          ? destination.pageIds
          : [...destination.pageIds, pageId]
              .sort((a, b) => (pageOrderMap.get(a) || Number.MAX_SAFE_INTEGER) - (pageOrderMap.get(b) || Number.MAX_SAFE_INTEGER)),
        pageRefs: refs,
      };

      return next;
    });
  };

  const promptAndCopySegment = (pageId: string, destinationClusterId: number) => {
    const useSegment = confirm('Copy full page as partial assignment?\nPress OK for full-page copy, Cancel to define a character segment.');
    if (useSegment) {
      copyPageAsPartialToCluster(pageId, destinationClusterId);
      return;
    }

    const startInput = prompt('Segment start character index (>= 0):', '0');
    if (startInput === null) return;
    const endInput = prompt('Segment end character index (> start):', '200');
    if (endInput === null) return;
    const noteInput = prompt('Optional segment note:', '');

    const startChar = parseInt(startInput, 10);
    const endChar = parseInt(endInput, 10);
    if (isNaN(startChar) || isNaN(endChar) || startChar < 0 || endChar <= startChar) {
      alert('Invalid range. Segment was not added.');
      return;
    }

    copyPageAsPartialToCluster(pageId, destinationClusterId, startChar, endChar, noteInput || undefined);
  };

  const undoClusterEdit = () => {
    if (clusterPast.length === 0) return;
    const previous = snapshotClusters(clusterPast[clusterPast.length - 1]);
    const current = snapshotClusters(state.clusters);
    setClusterPast(history => history.slice(0, -1));
    setClusterFuture(history => [current, ...history].slice(0, MAX_CLUSTER_HISTORY));
    setState(s => ({ ...s, clusters: normalizeClusterSet(previous) }));
    setTimeout(() => syncReconciliation(), 0);
  };

  const redoClusterEdit = () => {
    if (clusterFuture.length === 0) return;
    const [next, ...rest] = clusterFuture;
    const current = snapshotClusters(state.clusters);
    setClusterFuture(rest);
    setClusterPast(history => [...history.slice(-(MAX_CLUSTER_HISTORY - 1)), current]);
    setState(s => ({ ...s, clusters: normalizeClusterSet(snapshotClusters(next)) }));
    setTimeout(() => syncReconciliation(), 0);
  };

  const assignedPageCount = useMemo(() => {
    const counts = new Map<string, number>();
    state.clusters.forEach(cluster => {
      cluster.pageIds.forEach(pageId => counts.set(pageId, (counts.get(pageId) || 0) + 1));
    });
    return counts;
  }, [state.clusters]);

  const duplicateAssignedPageIds = useMemo(() => {
    return Array.from(assignedPageCount.entries())
      .filter(([, count]) => count > 1)
      .map(([id]) => id);
  }, [assignedPageCount]);

  const intentionallySharedPageIds = useMemo(() => {
    const shared = new Set<string>();
    state.clusters.forEach(cluster => {
      cluster.pageRefs?.forEach(ref => {
        if (ref.note === 'Partial page assignment' || typeof ref.startChar === 'number' || typeof ref.endChar === 'number') {
          shared.add(ref.pageId);
        }
      });
    });
    return shared;
  }, [state.clusters]);

  const duplicateConflictPageIds = useMemo(() => {
    return duplicateAssignedPageIds.filter(pageId => !intentionallySharedPageIds.has(pageId));
  }, [duplicateAssignedPageIds, intentionallySharedPageIds]);

  const unassignedPages = useMemo(() => {
    const assignedIds = new Set(Array.from(assignedPageCount.keys()));
    return state.files.filter(file => !assignedIds.has(file.id));
  }, [state.files, assignedPageCount]);

  const lowConfidenceClusters = useMemo(() => {
    return state.clusters.filter(cluster => typeof cluster.aiConfidence === 'number' && cluster.aiConfidence <= 2);
  }, [state.clusters]);

  const clusterReviewStats = useMemo(() => {
    const stats = { proposed: 0, reviewed: 0, final: 0 };
    state.clusters.forEach(cluster => {
      if (cluster.reviewStatus === 'final') stats.final += 1;
      else if (cluster.reviewStatus === 'human-reviewed') stats.reviewed += 1;
      else stats.proposed += 1;
    });
    return stats;
  }, [state.clusters]);

  const createClusterFromSinglePage = (pageId: string) => {
    const page = state.files.find(f => f.id === pageId);
    if (!page) return;
    commitClusterEdit((clusters) => {
      return [
        ...clusters,
        {
          id: clusters.length + 1,
          title: `New Document - ${page.indexName}`,
          summary: 'Manual cluster created from unassigned page.',
          pageRange: '',
          pageIds: [page.id],
          pageRefs: [{ pageId: page.id, source: 'manual' }],
          reviewStatus: 'human-reviewed',
          reviewedBy: state.userName || undefined,
          reviewedAt: new Date().toISOString(),
        }
      ];
    });
  };

  const reanalyzeCluster = async (clusterId: number) => {
    const cluster = state.clusters.find(c => c.id === clusterId);
    if (!cluster) return;
    const pages = cluster.pageIds.map(id => state.files.find(f => f.id === id)).filter((p): p is ArchivalPage => !!p && !p.irrelevant);
    setReanalyzingClusterIds(prev => new Set(prev).add(clusterId));
    try {
      const updated = await reanalyzeClusterMetadata(cluster, pages, state.tier);
      commitClusterEdit(clusters => clusters.map(c => c.id === clusterId ? { ...c, ...updated, reviewStatus: 'human-reviewed' as const } : c));
      setDirtyClusterIds(prev => { const s = new Set(prev); s.delete(clusterId); return s; });
    } catch (err: any) {
      alert(`Failed to refresh cluster summary: ${err.message}`);
    } finally {
      setReanalyzingClusterIds(prev => { const s = new Set(prev); s.delete(clusterId); return s; });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const restartApp = () => {
    if (confirm("Reset everything? All unsaved project data will be lost.")) {
      setState(INITIAL_STATE);
      setProjectTitle("Archival Project");
      setArchiveName("");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setState(s => ({
      ...s,
      files: s.files.map(f => {
        const isFiltered = filteredPages.some(fp => fp.id === f.id);
        return isFiltered ? { ...f, shouldTranscribe: checked } : f;
      })
    }));
  };

  const handleRangeSelect = () => {
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);
    if (isNaN(start) || isNaN(end)) return;

    setState(s => ({
      ...s,
      files: s.files.map((f, index) => {
        const pageNum = index + 1;
        if (pageNum >= start && pageNum <= end) {
          return { ...f, shouldTranscribe: true };
        }
        return f;
      })
    }));
  };

  const handleManualSort = (criterion: 'filename-asc' | 'filename-desc' | 'status') => {
    const sorted = [...state.files].sort((a, b) => {
      if (criterion === 'filename-asc') return a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' });
      if (criterion === 'filename-desc') return b.fileName.localeCompare(a.fileName, undefined, { numeric: true, sensitivity: 'base' });
      if (criterion === 'status') return a.status.localeCompare(b.status);
      return 0;
    });
    setState(s => ({ ...s, files: sorted }));
  };

  const saveToDrive = async () => {
    setIsUploadingToDrive(true);
    try {
      const zipBlob = await generateProjectZip(state, projectTitle, archiveName || "", null);
      const fileId = await uploadFileToDrive(zipBlob, `${projectTitle}.aln_project.zip`);
      alert(`Project successfully saved to Google Drive. File ID: ${fileId}`);
    } catch (error: any) {
      console.error("Drive upload error:", error);
      alert(`Failed to save to Drive: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const restoreProjectFromBlob = async (blob: Blob) => {
    setIsProcessingFiles(true);
    try {
      const isZip = blob.type === 'application/zip' || (blob instanceof File && blob.name.endsWith('.zip'));
      let appData: any;
      let restoredFiles: ArchivalPage[] = [];

      if (isZip) {
        // @ts-ignore
        const zip = await JSZip.loadAsync(blob);
        const jsonFile = Object.keys(zip.files).find(name => name.endsWith('project_metadata.json'));
        if (!jsonFile) throw new Error("Could not find project_metadata.json inside the zip.");
        const jsonStr = await zip.files[jsonFile].async('string');
        const backup = JSON.parse(jsonStr);
        appData = backup.appState;
        setProjectTitle(backup.meta?.projectTitle || "Restored Project");
        setArchiveName(backup.meta?.archiveName || "");
        for (const savedFile of appData.files) {
          const zipImagePath = Object.keys(zip.files).find(name => name.endsWith(savedFile.fileName));
          if (zipImagePath) {
            const b = await zip.files[zipImagePath].async('blob');
            const fileObj = new File([b], savedFile.fileName, { type: b.type });
            restoredFiles.push({ ...savedFile, fileObj, previewUrl: await createImagePreview(fileObj) });
          } else {
            restoredFiles.push({ ...savedFile, previewUrl: "https://via.placeholder.com/150?text=Image+Lost" });
          }
        }
      } else {
        const text = await blob.text();
        const backup = JSON.parse(text);
        appData = backup.appState || backup;
        restoredFiles = appData.files || [];
        setProjectTitle(backup.meta?.projectTitle || "Restored Project");
        setArchiveName(backup.meta?.archiveName || "");
      }

      const normalizedRestoredFiles = restoredFiles.map((f, i) => ensurePageIndexMetadata(f as ArchivalPage, i + 1));
      const restoredClusters = normalizeClusterSet(markClustersAsAiProposed((appData.clusters || []) as Cluster[]));
      setState(s => ({ ...INITIAL_STATE, ...appData, files: normalizedRestoredFiles, clusters: restoredClusters, uiState: 'dashboard' }));
    } catch (err: any) {
      console.error("Restoration Error:", err);
      alert(`Resume failed: ${err.message}`);
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const syncReconciliation = () => {
    const uniqueMap = new Map<string, ReconciliationRecord>();
    const existingMap = new Map<string, ReconciliationRecord>();
    state.reconciliationList.forEach(r => existingMap.set(`${r.type}:${r.extractedName.toLowerCase()}`, r));

    const add = (name: string, type: 'person' | 'organization' | 'role' | 'prison', source: string) => {
      if (!name) return;
      const key = `${type}:${name.toLowerCase()}`;
      if (uniqueMap.has(key)) {
        const existing = uniqueMap.get(key)!;
        if (!existing.sourceAppearances.find(s => s.id === source)) {
          existing.sourceAppearances.push({ id: source, note: "" });
        }
      } else {
        const vocabMatch = resolveEntity(name);
        const prev = existingMap.get(key);
        uniqueMap.set(key, {
          id: prev?.id || crypto.randomUUID(),
          extractedName: name,
          type,
          matchedId: vocabMatch.id,
          matchedName: vocabMatch.id ? (state.masterVocabulary.find(v => v.id === vocabMatch.id)?.name || PRISON_MASTER_LIST.find(p => p.id === vocabMatch.id)?.name) : undefined,
          status: vocabMatch.id ? 'matched' : (prev?.status || 'pending'),
          sourceAppearances: prev?.sourceAppearances && prev.sourceAppearances.length > 0 ? prev.sourceAppearances : [{ id: source, note: "" }],
          addedAt: prev?.addedAt || new Date().toISOString().split('T')[0]
        });
      }
    };

    state.clusters.forEach(c => {
      c.entities?.people?.forEach(p => add(p.name, 'person', `Doc #${c.id}`));
      c.entities?.organizations?.forEach(o => add(o.name, 'organization', `Doc #${c.id}`));
      c.entities?.roles?.forEach(r => add(r.name, 'role', `Doc #${c.id}`));
      c.entities?.prisons?.forEach(p => add(p.name, 'prison', `Doc #${c.id}`));
      c.senders?.forEach(s => add(s.name, 'person', `Doc #${c.id}`));
      c.recipients?.forEach(r => add(r.name, 'person', `Doc #${c.id}`));
    });

    state.files.filter(f => !f.irrelevant).forEach(f => {
      f.entities?.people?.forEach(p => add(p.name, 'person', f.indexName));
      f.entities?.organizations?.forEach(o => add(o.name, 'organization', f.indexName));
      f.entities?.roles?.forEach(r => add(r.name, 'role', f.indexName));
      f.entities?.prisons?.forEach(p => add(p.name, 'prison', f.indexName));
    });

    setState(s => ({ ...s, reconciliationList: Array.from(uniqueMap.values()) }));
  };

  const resolveEntity = (name: string): EntityReference => {
    const low = name.toLowerCase().trim();
    const match = state.masterVocabulary.find(v => v.name.toLowerCase() === low);
    if (match) return { name, id: match.id };
    const prisonMatch = PRISON_MASTER_LIST.find(p => p.name.toLowerCase() === low);
    return { name, id: prisonMatch?.id };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: AnalysisMode) => {
    if (!e.target.files?.length) return;
    setIsProcessingFiles(true);
    let fileList = Array.from(e.target.files) as File[];
    
    // NATURAL SORTING of files by name to ensure sequence is correct (Page 1, Page 2, Page 10 etc.)
    fileList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const allExtractedPages: ArchivalPage[] = [];
    
    let derivedTitle = ((fileList[0] as any).webkitRelativePath?.split('/')[0]) || fileList[0].name.replace(/\.[^/.]+$/, "");
    setProjectTitle(derivedTitle);

    for (const file of fileList) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const pdfData = await file.arrayBuffer();
          // @ts-ignore
          const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            if (context) {
              await page.render({ canvasContext: context, viewport }).promise;
              const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.95));
              const pageFile = new File([blob], `${file.name}_page_${i}.jpg`, { type: 'image/jpeg' });
              allExtractedPages.push({
                id: crypto.randomUUID(),
                fileName: pageFile.name,
                indexName: `${file.name} - Page ${i}`,
                sourceDocumentName: file.name,
                sourcePageNumber: i,
                sourcePath: (file as any).webkitRelativePath || file.name,
                ingestOrder: allExtractedPages.length + 1,
                indexSchemaVersion: 1,
                indexKey: buildIndexKey(file.name, pageFile.name, i, (file as any).webkitRelativePath || file.name),
                fileObj: pageFile,
                previewUrl: URL.createObjectURL(pageFile),
                shouldTranscribe: false,
                shouldTranslate: false,
                status: 'pending',
                shouldDownloadImage: false,
                rotation: 0
              });
            }
          }
        } catch (err) {
          console.error("PDF processing error:", err);
          alert(`Failed to process PDF: ${file.name}`);
        }
      } else {
        const previewUrl = await createImagePreview(file);
        allExtractedPages.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          indexName: `${derivedTitle} - ${file.name}`,
          sourceDocumentName: file.name,
          sourcePageNumber: 1,
          sourcePath: (file as any).webkitRelativePath || file.name,
          ingestOrder: allExtractedPages.length + 1,
          indexSchemaVersion: 1,
          indexKey: buildIndexKey(file.name, file.name, 1, (file as any).webkitRelativePath || file.name),
          fileObj: file,
          previewUrl,
          shouldTranscribe: false,
          shouldTranslate: false,
          status: 'pending',
          shouldDownloadImage: false,
          rotation: 0
        });
      }
    }

    setState(s => ({ ...s, mode, files: allExtractedPages.map((f, i) => ensurePageIndexMetadata(f, i + 1)), uiState: 'config' }));
    setIsProcessingFiles(false);
  };

  const renderWelcome = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white text-slate-900 overflow-y-auto">
      <div className="max-w-4xl w-full text-center space-y-12">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-black uppercase tracking-widest border border-blue-100"><Sparkles className="w-4 h-4" /> Powered by Gemini 3</div>
          <h1 className="text-8xl font-black italic tracking-tighter uppercase leading-[0.8] text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-800 to-slate-500">Archival<br />Lens</h1>
          <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto italic">Advanced AI-driven processing for multi-page documents and PDFs.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="group relative bg-white border border-slate-200 rounded-[48px] p-10 hover:border-blue-500 hover:shadow-2xl transition-all cursor-pointer">
            <input type="file" multiple {...({webkitdirectory: "", mozdirectory: ""} as any)} className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e => handleFileUpload(e, AnalysisMode.FOLDER)} />
            <div className="w-16 h-16 bg-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-6 transition-transform group-hover:scale-110 shadow-lg"><FolderOpen className="w-8 h-8 text-white" /></div>
            <h3 className="text-2xl font-black uppercase italic tracking-tight text-slate-800">Process Folders</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Images or Collections</p>
          </div>
          <div className="group relative bg-white border border-slate-200 rounded-[48px] p-10 hover:border-emerald-500 hover:shadow-2xl transition-all cursor-pointer">
            <input type="file" multiple accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e => handleFileUpload(e, AnalysisMode.BATCH_PDF)} />
            <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 transition-transform group-hover:scale-110 shadow-lg"><FileText className="w-8 h-8 text-white" /></div>
            <h3 className="text-2xl font-black uppercase italic tracking-tight text-slate-800">Split PDFs</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Multi-page Analysis</p>
          </div>
        </div>
        <div className="flex items-center justify-center pt-8 border-t">
          <label className="group flex items-center gap-3 px-8 py-4 bg-slate-50 rounded-[32px] border hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
            <input type="file" accept=".zip,.json,.aln_project.zip" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) restoreProjectFromBlob(file); }} />
            <div className="p-3 bg-white rounded-2xl shadow-sm"><CloudUpload className="w-5 h-5 text-slate-400 group-hover:text-blue-500" /></div>
            <div className="text-left">
              <div className="text-xs font-black uppercase tracking-widest text-slate-800">Resume Project</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Load .aln backup</div>
            </div>
          </label>
        </div>
      </div>
      {isProcessingFiles && (
        <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-[100] backdrop-blur-md flex-col gap-4 text-slate-900">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center"><History className="w-6 h-6 text-blue-600" /></div>
          </div>
          <span className="font-black uppercase tracking-widest text-blue-600 animate-pulse">Restoring Research Environment...</span>
        </div>
      )}
    </div>
  );

  const renderCommonHeader = (actions?: React.ReactNode) => {
    const views = [
      { id: 'dashboard', label: 'Pages & Documents', icon: Layers },
      { id: 'entities', label: 'Research Index', icon: Fingerprint }
    ];

    return (
      <header className="bg-white border-b px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {views.map((view) => (
              <button 
                key={view.id} 
                onClick={() => setState(s => ({ ...s, uiState: view.id as any }))} 
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight flex items-center gap-2 transition-all ${state.uiState === view.id ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <view.icon className="w-3 h-3" />
                {view.label}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-1">
            <button onClick={toggleFullscreen} className={`p-2 rounded-lg transition-colors ${isFullscreen ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-400'}`} title="Toggle Fullscreen">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
            <button onClick={restartApp} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors" title="Restart App">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <button onClick={saveToDrive} disabled={isUploadingToDrive} className="p-2.5 bg-white border border-slate-200 hover:border-emerald-400 text-slate-600 rounded-xl transition-all shadow-sm group">
            {isUploadingToDrive ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <Cloud className="w-4 h-4 group-hover:text-emerald-500 transition-colors" />}
          </button>
          <button 
            onClick={async () => { setIsZipping(true); try { const zipBlob = await generateProjectZip(state, projectTitle, archiveName || "", null); downloadFile(zipBlob, `${projectTitle}.aln_project.zip`, 'application/zip'); } finally { setIsZipping(false); } }} 
            className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all shadow-xl group"
          >
            {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />}
          </button>
        </div>
      </header>
    );
  };

  const renderUnifiedEntities = () => {
    const filteredRecs = state.reconciliationList.filter(r => {
      const matchesSearch = r.extractedName.toLowerCase().includes(recSearch.toLowerCase()) || 
                            (r.matchedName || "").toLowerCase().includes(recSearch.toLowerCase());
      const matchesType = recFilterType === 'all' || r.type === recFilterType;
      return matchesSearch && matchesType;
    });
    const activeRec = state.reconciliationList.find(r => r.id === activeRecId);
    return (
      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/3 border-r flex flex-col bg-white">
          <div className="p-6 border-b space-y-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setIndexSubTab('project')} className={`flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${indexSubTab === 'project' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Project Index</button>
              <button onClick={() => setIndexSubTab('master')} className={`flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${indexSubTab === 'master' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Master Authority</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search entities..." className="w-full bg-slate-50 border rounded-xl py-2 pl-10 pr-4 text-xs font-bold outline-none focus:border-blue-500" value={recSearch} onChange={e => setRecSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
               {['all', 'person', 'organization', 'prison', 'role'].map(type => (
                 <button key={type} onClick={() => setRecFilterType(type as any)} className={`shrink-0 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter border transition-all ${recFilterType === type ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border-slate-200'}`}>{type}</button>
               ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {indexSubTab === 'project' ? (
              filteredRecs.length > 0 ? (
                filteredRecs.map(rec => (
                  <button key={rec.id} onClick={() => setActiveRecId(rec.id)} className={`w-full p-6 border-b text-left transition-all hover:bg-slate-50 ${activeRecId === rec.id ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''}`}>
                    <div className="flex justify-between items-start mb-1"><span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{rec.type}</span><span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${rec.status === 'matched' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{rec.status}</span></div>
                    <div className="text-sm font-black text-slate-800 mb-1">{rec.extractedName}</div>
                    {rec.matchedName && <div className="text-[9px] text-slate-400 font-bold uppercase italic truncate">Matches: {rec.matchedName}</div>}
                  </button>
                ))
              ) : (
                <div className="p-12 text-center text-slate-300 italic text-xs font-bold">No project entities found.</div>
              )
            ) : (
              [...state.masterVocabulary, ...PRISON_MASTER_LIST.map(p => ({ ...p, type: 'prison' as const }))]
                .filter(v => v.name.toLowerCase().includes(recSearch.toLowerCase()))
                .slice(0, 100).map((v, idx) => (
                  <div key={idx} className="p-6 border-b hover:bg-slate-50"><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{v.type || 'prison'}</div><div className="text-sm font-black text-slate-800">{v.name}</div><div className="text-[8px] text-slate-300">ID: {v.id}</div></div>
                ))
            )}
          </div>
        </div>
        <div className="flex-1 bg-slate-50 p-12 overflow-y-auto custom-scrollbar">
           {activeRec ? (
             <div className="max-w-4xl mx-auto space-y-10">
                <header className="space-y-4">
                  <div className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest w-fit">{activeRec.type}</div>
                  <h2 className="text-5xl font-black text-slate-900 italic uppercase tracking-tighter leading-tight">{activeRec.extractedName}</h2>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Authority Match</h4>
                    {activeRec.matchedName ? (
                      <div className="space-y-4">
                        <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Standardized Name</div>
                          <div className="text-xl font-black text-slate-800">{activeRec.matchedName}</div>
                          <div className="text-xs text-emerald-500 font-bold mt-1">Authority ID: {activeRec.matchedId}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 bg-slate-50 rounded-3xl border border-dashed text-slate-400 text-xs font-bold text-center">Unmatched to Authority Vocabulary</div>
                    )}
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Eye className="w-4 h-4" /> Source Appearances</h4>
                    <div className="space-y-3">
                      {activeRec.sourceAppearances.map((app, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="text-[11px] font-black text-slate-700">{app.id}</div>
                          <Bot className="w-3.5 h-3.5 text-slate-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                <div className="p-8 bg-white rounded-full border border-dashed border-slate-200"><Fingerprint className="w-16 h-16" /></div>
                <p className="text-xs font-black uppercase tracking-widest">Select an entity to reconcile</p>
             </div>
           )}
        </div>
      </div>
    );
  };

  const productionModes = ["Handwritten", "Printed", "Typewritten", "No Text", "Mixed Form"];

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans selection:bg-blue-100">
      <ProcessingBanner status={state.processingStatus} />

      {state.uiState === 'welcome' ? renderWelcome() : (
        <>
          <aside className={`bg-white border-r flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden border-none'}`}>
            <div className="p-6 border-b flex items-center justify-between shrink-0"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></div><span className="font-black italic uppercase tracking-tighter text-xl">Archival Lens</span></div><button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg"><PanelLeft className="w-4 h-4 text-slate-400" /></button></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workflow Stage</h4>
                <div className="space-y-2">
                  {[
                    { id: 'dashboard', label: '1. Pages & Documents', icon: Layers },
                    { id: 'entities', label: '2. Entity Reconciliation', icon: Users }
                  ].map(step => (
                    <button
                      key={step.id}
                      onClick={() => setState(s => ({ ...s, uiState: step.id as any }))}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-tight transition-all border ${(state.uiState === step.id || (step.id === 'dashboard' && state.uiState === 'clustering')) ? 'bg-slate-900 text-white border-slate-900 shadow-lg translate-x-1' : 'bg-white text-slate-500 border-transparent hover:bg-slate-50'}`}
                    >
                      <step.icon className={`w-4 h-4 ${(state.uiState === step.id || (step.id === 'dashboard' && state.uiState === 'clustering')) ? 'text-blue-400' : 'text-slate-300'}`} />
                      {step.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Project</h4>
                <div className="bg-slate-50 p-5 rounded-3xl border shadow-inner">
                  <div className="text-sm font-black text-slate-800 leading-tight mb-1">{projectTitle}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase truncate">{archiveName ? archiveName.split(' - ')[0] : 'General Collection'}</div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Researcher</h4>
                <div className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100"><UserCircle className="w-6 h-6" /></div>
                  <div className="text-xs font-black uppercase text-slate-800 truncate">{state.userName || 'Anonymous'}</div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compute Device</h4>
                <div className={`p-4 rounded-2xl border flex items-center gap-3 ${state.tier === Tier.PAID ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  {state.tier === Tier.PAID ? <Cpu className="w-5 h-5 text-amber-600" /> : <Zap className="w-5 h-5 text-slate-400" />}
                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-900">{state.tier === Tier.PAID ? 'Gemini Pro' : 'Gemini Flash'}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">{state.tier === Tier.PAID ? 'High Precision' : 'Fast Response'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-slate-50/50"><button onClick={() => setState(s => ({ ...s, uiState: 'welcome' }))} className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors py-2"><X className="w-3.5 h-3.5" /> Close Project</button></div>
          </aside>
          {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="fixed left-4 bottom-4 z-30 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl active:scale-95 transition-all"><PanelLeft className="w-6 h-6" /></button>}
          
          <div className="flex-1 flex flex-col overflow-hidden">
             {state.uiState === 'config' && (
                <div className="flex-1 flex items-center justify-center p-8 bg-slate-100 overflow-y-auto">
                   <div className="bg-white p-12 rounded-[56px] shadow-2xl border border-slate-200 max-w-2xl w-full">
                      <h2 className="text-3xl font-black text-slate-900 italic uppercase mb-10 flex items-center gap-3"><Settings className="w-8 h-8 text-blue-600" /> Init Research</h2>
                      <div className="space-y-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Researcher Name</label>
                          <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                            <input type="text" value={state.userName} onChange={e => setState(s => ({...s, userName: e.target.value}))} placeholder="Who is conducting this analysis?" className="w-full bg-slate-50 border rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-blue-500 shadow-inner" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Title</label>
                          <input type="text" value={projectTitle} onChange={e => setProjectTitle(e.target.value)} className="w-full bg-slate-50 border rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500 shadow-inner" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archive Repository</label>
                          <input list="archive-options" value={archiveName} onChange={e => setArchiveName(e.target.value)} className="w-full bg-slate-50 border rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500 shadow-inner" />
                          <datalist id="archive-options">{PRESET_ARCHIVES.map(a => <option key={a} value={a} />)}</datalist>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Processing Device (Model Tier)</label>
                          <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setState(s => ({...s, tier: Tier.FREE}))} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${state.tier === Tier.FREE ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                               <Zap className="w-5 h-5" />
                               <span className="text-[10px] font-black uppercase">Standard (Flash)</span>
                            </button>
                            <button onClick={() => setState(s => ({...s, tier: Tier.PAID}))} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${state.tier === Tier.PAID ? 'bg-amber-50 border-amber-500 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                               <Cpu className="w-5 h-5" />
                               <span className="text-[10px] font-black uppercase">High-Density (Pro)</span>
                            </button>
                          </div>
                        </div>
                        <button onClick={() => setState(s => ({ ...s, uiState: 'dashboard' }))} disabled={!state.userName || !projectTitle} className={`w-full py-5 rounded-[28px] font-black uppercase transition-all active:scale-95 shadow-2xl ${(state.userName && projectTitle) ? 'bg-slate-900 text-white hover:bg-blue-600' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>Activate Scope</button>
                      </div>
                   </div>
                </div>
             )}
             {(state.uiState === 'dashboard' || state.uiState === 'clustering') && (
               <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                 {renderCommonHeader(
                   <div className="flex items-center gap-2 flex-wrap">
                     <button onClick={undoClusterEdit} disabled={clusterPast.length === 0} className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"><RotateCcw className="w-3.5 h-3.5" /> Undo</button>
                     <button onClick={redoClusterEdit} disabled={clusterFuture.length === 0} className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"><RotateCw className="w-3.5 h-3.5" /> Redo</button>
                     <button onClick={keepAllClustersAsFinal} disabled={state.clusters.length === 0} className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"><CheckCircle className="w-3.5 h-3.5" /> Keep All</button>
                   </div>
                 )}
                 
                 
                 <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                   <div className="max-w-7xl mx-auto space-y-12">
                     {state.clusters.length > 0 && (
                       <div className="bg-white border rounded-[24px] p-4 flex flex-wrap items-center gap-3">
                         <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-50 border border-amber-200 text-amber-700">AI Proposed: {clusterReviewStats.proposed}</span>
                         <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-50 border border-blue-200 text-blue-700">Human Reviewed: {clusterReviewStats.reviewed}</span>
                         <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 border border-emerald-200 text-emerald-700">Final: {clusterReviewStats.final}</span>
                       </div>
                     )}

                     {(duplicateConflictPageIds.length > 0 || unassignedPages.length > 0 || lowConfidenceClusters.length > 0 || intentionallySharedPageIds.size > 0) && (
                       <div className="bg-amber-50 border border-amber-200 rounded-[28px] p-6">
                         <div className="flex items-center gap-2 text-amber-700 text-xs font-black uppercase tracking-widest mb-3">
                           <AlertTriangle className="w-4 h-4" /> Index Validation
                         </div>
                         <div className="space-y-2 text-[11px] font-bold text-amber-800">
                           {duplicateConflictPageIds.length > 0 && (
                             <div>{duplicateConflictPageIds.length} page(s) are assigned to more than one document without partial-page marking.</div>
                           )}
                           {unassignedPages.length > 0 && (
                             <div>{unassignedPages.length} page(s) are currently unassigned.</div>
                           )}
                           {intentionallySharedPageIds.size > 0 && (
                             <div>{intentionallySharedPageIds.size} page(s) are intentionally shared as partial-page assignments.</div>
                           )}
                           {lowConfidenceClusters.length > 0 && (
                             <div>{lowConfidenceClusters.length} document boundary decision(s) have low AI confidence (≤2).</div>
                           )}
                         </div>
                       </div>
                     )}

                     {unassignedPages.length > 0 && (
                       <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-5">
                         <div className="flex items-center justify-between">
                           <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Unassigned Pages</h3>
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assign or create document</span>
                         </div>
                         <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                           {unassignedPages.map(page => (
                             <div key={page.id} className="shrink-0 w-28 space-y-2">
                               <img
                                 src={page.previewUrl}
                                 className="h-32 w-24 object-cover rounded-xl border cursor-zoom-in hover:scale-105 transition-all shadow-sm"
                                 onClick={() => setPageViewId(page.id)}
                               />
                               <button
                                 onClick={() => createClusterFromSinglePage(page.id)}
                                 className="w-full px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-all"
                               >
                                 New Doc
                               </button>
                               <select
                                 defaultValue=""
                                 onChange={(e) => {
                                   const destination = parseInt(e.target.value, 10);
                                   if (!isNaN(destination)) {
                                     movePageToCluster(page.id, destination);
                                   }
                                 }}
                                 className="w-full px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg bg-slate-50 border border-slate-200 text-slate-600 outline-none"
                               >
                                 <option value="">Assign...</option>
                                 {state.clusters.map(dest => (
                                   <option key={dest.id} value={dest.id}>Doc #{dest.id}</option>
                                 ))}
                               </select>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}

                     {state.clusters.length === 0 && (
                       <div className="flex flex-col items-center justify-center py-40 text-center space-y-4 opacity-40">
                         <div className="p-10 bg-slate-100 rounded-full"><LayoutGrid className="w-16 h-16 text-slate-400" /></div>
                         <div>
                           <h3 className="text-xl font-black uppercase tracking-widest text-slate-900">No Documents Indexed</h3>
                           <p className="text-xs font-bold text-slate-500">Run the AI Document Indexing to cluster pages into logical documents.</p>
                         </div>
                       </div>
                     )}
                     {state.clusters.map((c, clusterIndex) => (
                       <div key={c.id} className="bg-white rounded-[40px] border overflow-hidden shadow-sm hover:shadow-2xl transition-all p-12 group relative">
                         <button onClick={() => setEditingClusterId(c.id)} className="absolute top-12 right-12 p-3.5 bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-2xl transition-all opacity-0 group-hover:opacity-100 shadow-sm"><Edit3 className="w-5 h-5" /></button>
                         <div className="flex items-center gap-3 mb-8 flex-wrap">
                           <div className="bg-blue-600 text-white text-xs font-black px-5 py-1.5 rounded-full uppercase">Doc #{c.id}</div>
                           <div className="text-slate-300 font-black uppercase text-[10px] tracking-widest">{c.pageRange}</div>
                           <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                             c.reviewStatus === 'final'
                               ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                               : c.reviewStatus === 'human-reviewed'
                                 ? 'bg-blue-50 text-blue-700 border-blue-200'
                                 : 'bg-amber-50 text-amber-700 border-amber-200'
                           }`}>
                             {c.reviewStatus === 'final' ? 'Final (Kept)' : c.reviewStatus === 'human-reviewed' ? 'Human Reviewed' : 'AI Proposed'}
                           </span>
                           <button
                             onClick={() => keepClusterAsFinal(c.id)}
                             className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
                           >
                             Keep
                           </button>
                           {clusterIndex > 0 && (
                             <button
                               onClick={() => mergeWithPreviousCluster(c.id)}
                               className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all"
                             >
                               Merge with Previous
                             </button>
                           )}
                         </div>
                         <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                            <div className="lg:col-span-12 space-y-8">
                              <h3 className="text-3xl font-black text-slate-800 leading-tight tracking-tight">{c.title}</h3>
                              <div className="flex flex-wrap gap-2">
                                  {typeof c.aiConfidence === 'number' && (
                                    <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${c.aiConfidence <= 2 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                      AI Confidence: {c.aiConfidence}/5
                                    </span>
                                  )}
                                {c.docTypes?.map(dt => <span key={dt.id} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest border"> {dt.name} <span className="opacity-40 text-[7px]">#{dt.id}</span> </span>)}
                                {c.prisonName && <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-widest border flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {c.prisonName}</span>}
                              </div>
                                {c.boundaryReasons && c.boundaryReasons.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {c.boundaryReasons.map((reason, reasonIdx) => (
                                      <span key={`${c.id}-reason-${reasonIdx}`} className="px-2 py-1 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                        {reason}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              <p className="text-slate-500 leading-relaxed text-base font-medium italic border-l-4 pl-6">{c.summary}</p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-8 rounded-[32px] border">
                                 <div className="space-y-4">
                                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Send className="w-4 h-4 text-blue-500" /> From</h4>
                                   {c.senders && c.senders.length > 0 ? c.senders.map((s, i) => (
                                     <div key={i} className="flex flex-col border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                       <span className="text-sm font-black italic text-slate-800">{s.name}</span>
                                       <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                          {s.role && <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Briefcase className="w-3 h-3" /> {s.role}</span>}
                                          {s.organizationCategory && <span className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1"><Building className="w-3 h-3" /> {s.organizationCategory}</span>}
                                          {s.nationality && <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1"><Globe className="w-3 h-3" /> {s.nationality}</span>}
                                       </div>
                                     </div>
                                   )) : <span className="text-xs italic text-slate-300">Unidentified Sender</span>}
                                 </div>
                                 <div className="space-y-4">
                                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Mail className="w-4 h-4 text-emerald-500" /> To</h4>
                                   {c.recipients && c.recipients.length > 0 ? c.recipients.map((r, i) => (
                                     <div key={i} className="flex flex-col border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                       <span className="text-sm font-black italic text-slate-800">{r.name}</span>
                                       <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                          {r.role && <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Briefcase className="w-3 h-3" /> {r.role}</span>}
                                          {r.organizationCategory && <span className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1"><Building className="w-3 h-3" /> {r.organizationCategory}</span>}
                                          {r.nationality && <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1"><Globe className="w-3 h-3" /> {r.nationality}</span>}
                                       </div>
                                     </div>
                                   )) : <span className="text-xs italic text-slate-300">Unidentified Recipient</span>}
                                 </div>
                              </div>

                              <div className="space-y-6 pt-4 border-t">
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-3">
                                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-4 h-4 text-slate-500" /> Mentioned People</h4>
                                       <div className="flex flex-wrap gap-2">
                                          {c.entities?.people && c.entities.people.length > 0 ? c.entities.people.map((p, i) => (
                                            <div key={i} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm">
                                               <span className="text-[10px] font-black text-slate-800">{p.name}</span>
                                               {(p.nationality || p.organizationCategory) && (
                                                  <div className="flex gap-1.5 mt-0.5">
                                                     {p.nationality && <span className="text-[7px] font-black uppercase text-emerald-600">{p.nationality}</span>}
                                                     {p.organizationCategory && <span className="text-[7px] font-bold uppercase text-blue-500">{p.organizationCategory}</span>}
                                                  </div>
                                               )}
                                            </div>
                                          )) : <span className="text-xs italic text-slate-300">None detected</span>}
                                       </div>
                                    </div>
                                    <div className="space-y-3">
                                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Building className="w-4 h-4 text-slate-500" /> Mentioned Orgs</h4>
                                       <div className="flex flex-wrap gap-2">
                                          {c.entities?.organizations && c.entities.organizations.length > 0 ? c.entities.organizations.map((o, i) => (
                                            <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-blue-600 shadow-sm">{o.name}</span>
                                          )) : <span className="text-xs italic text-slate-300">None detected</span>}
                                       </div>
                                    </div>
                                    <div className="space-y-3">
                                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-500" /> Mentioned Prisons</h4>
                                       <div className="flex flex-wrap gap-2">
                                          {c.entities?.prisons && c.entities.prisons.length > 0 ? c.entities.prisons.map((p, i) => (
                                            <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-emerald-600 shadow-sm flex items-center gap-1">
                                              {p.name} 
                                              {p.id && <span className="text-[7px] opacity-40 font-black">#{p.id}</span>}
                                            </span>
                                          )) : <span className="text-xs italic text-slate-300">None detected</span>}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                            </div>
                         </div>
                         {/* Refresh AI Summary button — shown when cluster has been manually changed */}
                         {dirtyClusterIds.has(c.id) && (
                           <div className="mt-8 flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                             <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                             <span className="text-xs font-bold text-amber-700 flex-1">Pages were manually changed. Refresh to update AI summary and metadata.</span>
                             <button
                               onClick={() => reanalyzeCluster(c.id)}
                               disabled={reanalyzingClusterIds.has(c.id)}
                               className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50"
                             >
                               {reanalyzingClusterIds.has(c.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                               Refresh AI Summary
                             </button>
                           </div>
                         )}
                         <div className="mt-12 flex gap-5 overflow-x-auto pb-4 custom-scrollbar">
                           {c.pageIds.map((pid, pageIndexInCluster) => {
                             const p = state.files.find(f => f.id === pid);
                             if (!p) return null;
                             const usageCount = assignedPageCount.get(pid) || 0;
                             const isShared = usageCount > 1;
                             const segmentRefs = (c.pageRefs || []).filter(ref => ref.pageId === pid && typeof ref.startChar === 'number' && typeof ref.endChar === 'number');
                             const isDragging = dragReorderState?.pageId === pid && dragReorderState?.clusterId === c.id;
                             const isIrrelevant = !!p.irrelevant;
                             const toggleIrrelevant = () => {
                               setState(s => ({ ...s, files: s.files.map(f => f.id === pid ? { ...f, irrelevant: !f.irrelevant } : f) }));
                               setDirtyClusterIds(prev => new Set(prev).add(c.id));
                             };
                             return (
                               <div
                                 key={pid}
                                 className={'shrink-0 space-y-2 cursor-move ' + (isDragging ? 'opacity-40' : '') + (isIrrelevant ? ' opacity-50' : '')}
                                 draggable
                                 onDragStart={() => setDragReorderState({ pageId: pid, clusterId: c.id })}
                                 onDragEnd={() => setDragReorderState(null)}
                                 onDragOver={e => e.preventDefault()}
                                 onDrop={e => {
                                   e.preventDefault();
                                   if (dragReorderState && dragReorderState.clusterId === c.id && dragReorderState.pageId !== pid) {
                                     commitClusterEdit(clusters => clusters.map(cluster => {
                                       if (cluster.id !== c.id) return cluster;
                                       const ids = [...cluster.pageIds];
                                       const from = ids.indexOf(dragReorderState.pageId);
                                       const to = ids.indexOf(pid);
                                       ids.splice(from, 1);
                                       ids.splice(to, 0, dragReorderState.pageId);
                                       return { ...cluster, pageIds: ids };
                                     }));
                                     setDirtyClusterIds(prev => new Set(prev).add(c.id));
                                   }
                                   setDragReorderState(null);
                                 }}
                               >
                                 <div className="relative group">
                                   <img src={p.previewUrl} className={'h-64 w-48 object-cover rounded-xl border shadow-sm transition-all ' + (isIrrelevant ? 'grayscale' : '')} />
                                   {isIrrelevant && (
                                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                       <span className="bg-slate-700/80 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">Irrelevant</span>
                                     </div>
                                   )}
                                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/0 group-hover:bg-black/40 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                     <button onClick={() => setPageViewId(p.id)}>
                                       <ZoomIn className="w-8 h-8 text-white drop-shadow" />
                                     </button>
                                     <button
                                       onClick={e => { e.stopPropagation(); toggleIrrelevant(); }}
                                       className={'text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all ' + (isIrrelevant ? 'bg-white text-slate-900' : 'bg-slate-700/80 text-white hover:bg-red-600/80')}
                                     >
                                       {isIrrelevant ? 'Restore' : 'Mark irrelevant'}
                                     </button>
                                   </div>
                                 </div>
                                 <div className="flex flex-col gap-1 w-48">
                                   <span className="text-[10px] font-bold text-slate-600 truncate" title={p.indexName}>{p.indexName}</span>
                                   {isShared && (
                                     <span className="px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest rounded-md bg-purple-50 text-purple-700 border border-purple-100 text-center">
                                       Shared ({usageCount})
                                     </span>
                                   )}
                                   {segmentRefs.length > 0 && (
                                     <span className="px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest rounded-md bg-violet-50 text-violet-700 border border-violet-100 text-center">
                                       Segments ({segmentRefs.length})
                                     </span>
                                   )}
                                   {pageIndexInCluster > 0 && (() => {
                                     const isOpen = splitMenuState?.clusterId === c.id && splitMenuState?.pageId === pid;
                                     const nextCluster = state.clusters[state.clusters.findIndex(cl => cl.id === c.id) + 1];
                                     return (
                                       <div className="relative" data-split-menu>
                                         <button
                                           onClick={() => setSplitMenuState(isOpen ? null : { clusterId: c.id, pageId: pid })}
                                           className={'px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg border transition-all w-full ' + (isOpen ? 'bg-amber-200 text-amber-900 border-amber-300' : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100')}
                                         >
                                           Split before…
                                         </button>
                                         {isOpen && (
                                           <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 flex flex-col gap-1 min-w-[200px]">
                                             <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-2 pb-1 border-b mb-1">
                                               This page starts the second part
                                             </p>
                                             <button onClick={() => splitClusterNewDoc(c.id, pid, false)} className="text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-all">
                                               <span className="block font-black text-slate-900">→ New document</span>
                                               <span className="text-slate-400">Pages from here become a new doc</span>
                                             </button>
                                             {nextCluster && (
                                               <button onClick={() => splitClusterPrependToNext(c.id, pid, false)} className="text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-all">
                                                 <span className="block font-black text-slate-900">→ Prepend to Doc #{nextCluster.id}</span>
                                                 <span className="text-slate-400 truncate block max-w-[180px]">{nextCluster.title || 'Untitled'}</span>
                                               </button>
                                             )}
                                             <div className="border-t my-1" />
                                             <p className="text-[8px] font-black uppercase tracking-widest text-purple-400 px-2 pb-1">
                                               Boundary scan — keep page in both
                                             </p>
                                             <button onClick={() => splitClusterNewDoc(c.id, pid, true)} className="text-left px-3 py-2 rounded-lg hover:bg-purple-50 text-[10px] font-bold text-slate-700 transition-all">
                                               <span className="block font-black text-purple-800">→ New document + duplicate</span>
                                               <span className="text-slate-400">Page stays here and starts new doc</span>
                                             </button>
                                             {nextCluster && (
                                               <button onClick={() => splitClusterPrependToNext(c.id, pid, true)} className="text-left px-3 py-2 rounded-lg hover:bg-purple-50 text-[10px] font-bold text-slate-700 transition-all">
                                                 <span className="block font-black text-purple-800">→ Doc #{nextCluster.id} + duplicate</span>
                                                 <span className="text-slate-400">Page stays here and is added to next doc</span>
                                               </button>
                                             )}
                                             <button onClick={() => setSplitMenuState(null)} className="mt-1 text-center text-[8px] font-black uppercase text-slate-300 hover:text-slate-500 py-1 transition-all">Cancel</button>
                                           </div>
                                         )}
                                       </div>
                                     );
                                   })()}
                                   <select
                                     value={c.id}
                                     onChange={(e) => movePageToCluster(pid, parseInt(e.target.value, 10))}
                                     className="px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg bg-slate-50 border border-slate-200 text-slate-600 outline-none"
                                   >
                                     {state.clusters.map(dest => (
                                       <option key={dest.id} value={dest.id}>Doc #{dest.id} — {dest.title || 'Untitled'}</option>
                                     ))}
                                   </select>
                                   <select
                                     defaultValue=""
                                     onChange={(e) => {
                                       const destination = parseInt(e.target.value, 10);
                                       if (!isNaN(destination)) {
                                         promptAndCopySegment(pid, destination);
                                         setDirtyClusterIds(prev => new Set(prev).add(destination));
                                       }
                                     }}
                                     className="px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg bg-purple-50 border border-purple-100 text-purple-700 outline-none"
                                   >
                                     <option value="">Copy Partial...</option>
                                     {state.clusters.map(dest => (
                                       <option key={`copy-${dest.id}`} value={dest.id}>Doc #{dest.id} — {dest.title || 'Untitled'}</option>
                                     ))}
                                   </select>
                                  {segmentRefs.slice(0, 2).map((ref, idx) => (
                                    <span key={`${pid}-seg-${idx}`} className="px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest rounded-md bg-violet-50 text-violet-700 border border-violet-100 text-center truncate" title={ref.note || ''}>
                                      {ref.startChar}-{ref.endChar}
                                    </span>
                                  ))}
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                       </div>
                     ))}
                     {/* ── Pages section — only shown before indexing ── */}
                     {state.clusters.length === 0 && <div className="border-t pt-10">
                       <button
                         onClick={() => setPagesCollapsed(v => !v)}
                         className="w-full flex items-center justify-between mb-6 group"
                       >
                         <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-800 transition-colors">
                           <LayoutGrid className="w-4 h-4" />
                           All Pages ({state.files.length})
                           {state.clusters.length > 0 && unassignedPages.length > 0 && (
                             <span className="text-amber-600">— {unassignedPages.length} unassigned</span>
                           )}
                         </span>
                         <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${pagesCollapsed ? '-rotate-90' : ''}`} />
                       </button>
                       {!pagesCollapsed && (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                           {filteredPages.map(page => (
                             <div key={page.id} className="bg-white rounded-[32px] border overflow-hidden group hover:border-blue-500 hover:shadow-2xl transition-all flex flex-col shadow-sm relative">
                               {page.status === 'transcribing' && (
                                 <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                                   <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-900">Transcribing...</div>
                                   <div className="text-[8px] font-bold text-slate-500 uppercase mt-1">Gemini AI Pipeline</div>
                                 </div>
                               )}
                               <div className="relative aspect-[4/5] overflow-hidden bg-slate-100 cursor-zoom-in" onClick={() => setPageViewId(page.id)}>
                                 <img src={page.previewUrl} alt={page.indexName} className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${page.status === 'transcribing' ? 'grayscale opacity-50' : ''}`} style={{ transform: `rotate(${page.rotation || 0}deg)` }} />
                                 <div className="absolute top-4 left-4 flex flex-col gap-2">
                                   <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-800 shadow-xl uppercase">{page.indexName.split('-').pop()?.trim()}</div>
                                   {page.productionMode && (
                                     <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tight shadow-lg w-fit ${page.productionMode === 'Handwritten' ? 'bg-amber-400 text-amber-950' : page.productionMode === 'Printed' ? 'bg-blue-500 text-white' : page.productionMode === 'Typewritten' ? 'bg-indigo-600 text-white' : page.productionMode === 'No Text' ? 'bg-slate-400 text-white' : 'bg-purple-500 text-white'}`}>{page.productionMode}</div>
                                   )}
                                 </div>
                                 {page.confidenceScore !== undefined && page.confidenceScore <= 2 && (
                                   <div className="absolute top-4 right-4 bg-red-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white animate-pulse" title="Low confidence transcription"><AlertCircle className="w-3 h-3" /></div>
                                 )}
                                 {state.clusters.length > 0 && (() => {
                                   const doc = state.clusters.find(c => c.pageIds.includes(page.id));
                                   return doc ? (
                                     <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 text-white px-2 py-1 rounded-lg text-[8px] font-black truncate">Doc #{doc.id}</div>
                                   ) : (
                                     <div className="absolute bottom-2 left-2 right-2 bg-amber-500/80 text-white px-2 py-1 rounded-lg text-[8px] font-black">Unassigned</div>
                                   );
                                 })()}
                               </div>
                               <div className="p-6 flex flex-col gap-5">
                                 <div>
                                   <h4 className="font-black text-slate-800 truncate text-sm tracking-tight mb-1">{page.indexName}</h4>
                                   <div className="flex flex-wrap gap-1">
                                     <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border">{page.language || '...'}</span>
                                     {page.confidenceScore !== undefined && (
                                       <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${page.confidenceScore <= 2 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>Conf: {page.confidenceScore}/5</span>
                                     )}
                                   </div>
                                 </div>
                                 <div className="mt-auto pt-5 border-t">
                                   <label className="flex items-center gap-2 cursor-pointer select-none group/cb">
                                     <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${page.shouldTranscribe ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>{page.shouldTranscribe && <CheckSquare className="w-4 h-4 text-white" />}</div>
                                     <input type="checkbox" className="hidden" checked={page.shouldTranscribe} onChange={e => setState(s => ({ ...s, files: s.files.map(f => f.id === page.id ? { ...f, shouldTranscribe: e.target.checked } : f) }))} />
                                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mark for OCR</span>
                                   </label>
                                 </div>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>}

                     {/* ── Research Index footer ── */}
                     {state.clusters.length > 0 && (
                       <div className="flex justify-center pt-8 border-t">
                         <button onClick={() => setState(s => ({ ...s, uiState: 'entities' }))} className="px-8 py-4 bg-slate-900 text-white rounded-[24px] font-black uppercase italic tracking-tight text-sm shadow-2xl flex items-center gap-3 hover:bg-blue-600 transition-all active:scale-95 group">
                           Research Index & Reconcile <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                         </button>
                       </div>
                     )}

                   </div>
                 </div>
                 {editingClusterId && (
                   <ClusterEditor cluster={state.clusters.find(c => c.id === editingClusterId)!} onClose={() => setEditingClusterId(null)} onSave={(updated) => { commitClusterEdit((clusters) => clusters.map(c => c.id === updated.id ? { ...updated } : c)); setEditingClusterId(null); }} />
                 )}
               </div>
             )}
             {state.uiState === 'entities' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {renderCommonHeader(
                        <button onClick={() => setState(s => ({ ...s, uiState: 'dashboard' }))} className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                            <ChevronLeft className="w-3.5 h-3.5" /> Back
                        </button>
                    )}
                    {renderUnifiedEntities()}
                </div>
             )}
          </div>
        </>
      )}
      {pageViewId && (() => {
        const page = state.files.find(f => f.id === pageViewId);
        if (!page) return null;
        const tabs: { key: 'manualTranscription' | 'manualDescription' | 'generatedTranslation'; label: string }[] = [
          { key: 'manualTranscription', label: 'Transcription' },
          { key: 'manualDescription', label: 'Description' },
          { key: 'generatedTranslation', label: 'Translation' },
        ];
        return (
          <div className="fixed inset-0 z-[110] bg-slate-900 flex overflow-hidden">
            {/* Large image panel — ~70% width */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
              <img
                src={page.previewUrl}
                alt={page.indexName}
                className="max-w-full max-h-full object-contain shadow-2xl rounded"
                style={{ transform: `rotate(${page.rotation || 0}deg)` }}
              />
            </div>
            {/* Editor panel — fixed 380px */}
            <div className="w-[380px] shrink-0 bg-white flex flex-col border-l border-slate-200 overflow-hidden">
              <header className="px-6 py-5 border-b flex items-start justify-between gap-3 shrink-0">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{page.indexName}</p>
                  {page.language && <span className="text-[8px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded">{page.language}</span>}
                </div>
                <button onClick={() => setPageViewId(null)} className="shrink-0 p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-900" />
                </button>
              </header>
              {/* Tabs */}
              <div className="flex border-b shrink-0">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setPageViewField(tab.key)}
                    className={'flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ' + (pageViewField === tab.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-700')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Textarea */}
              <textarea
                className="flex-1 p-6 font-mono text-sm outline-none bg-slate-50 leading-relaxed resize-none border-0"
                value={(page as any)[pageViewField] || ''}
                dir={getTextDirection((page as any)[pageViewField] || '')}
                placeholder={`No ${tabs.find(t => t.key === pageViewField)?.label.toLowerCase()} yet…`}
                onChange={e => {
                  setState(s => ({ ...s, files: s.files.map(f => f.id === pageViewId ? { ...f, [pageViewField]: e.target.value } : f) }));
                  const owningCluster = state.clusters.find(c => c.pageIds.includes(pageViewId!));
                  if (owningCluster) setDirtyClusterIds(prev => new Set(prev).add(owningCluster.id));
                }}
              />
              <div className="p-4 border-t shrink-0">
                <button onClick={() => setPageViewId(null)} className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all active:scale-95">
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 pointer-events-none items-end z-50">
        <div className="pointer-events-auto group">
          <button onClick={() => { const json = generateFullJSON(projectTitle, archiveName || "Unassigned", state.userName || "Unknown", state.tier, null, state.files, state.clusters); downloadFile(json, `${projectTitle}_analysis.json`, 'application/json'); }} className="flex items-center gap-3 px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-full shadow-2xl hover:bg-slate-900 hover:text-white transition-all transform hover:-translate-y-1"><FileJson className="w-5 h-5 text-blue-500 group-hover:text-blue-400" /><span className="text-xs font-black uppercase tracking-widest">Export Full Analysis</span></button>
        </div>
      </div>
    </div>
  );
};

export default App;