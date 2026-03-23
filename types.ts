
export enum AnalysisMode {
  PDF = 'PDF',
  BATCH_PDF = 'BATCH_PDF',
  FOLDER = 'FOLDER',
  DRIVE = 'DRIVE',
}

export enum Tier {
  FREE = 'FREE',
  PAID = 'PAID',
}

export interface ProcessingStatus {
  total: number;
  processed: number;
  currentStep: string;
  isComplete: boolean;
}

export interface EntityReference {
  name: string;
  rawName?: string;
  normalizedName?: string;
  mappingMethod?: 'exact' | 'alias' | 'normalized' | 'none';
  id?: number;
  type?: 'person' | 'organization' | 'role' | 'prison';
  gender?: string;
  lifeSpan?: string;
  politicalAffiliation?: string;
  religion?: string;
  nationality?: string;
  otherNames?: string;
  notes?: string;
  wikidata?: string;
  otherLinks?: string;
  organizationCategory?: string;
}

export interface NamedEntities {
  people: EntityReference[];
  organizations: EntityReference[];
  roles: EntityReference[];
  prisons: EntityReference[];
}

export interface Correspondent {
  name: string;
  rawName?: string;
  normalizedName?: string;
  mappingMethod?: 'exact' | 'alias' | 'normalized' | 'none';
  role?: string;
  id?: number;
  organizationCategory?: string;
  nationality?: string;
}

export interface ArchivalPage {
  id: string; // unique ID
  fileName: string; // Original filename
  indexName: string; // The display name (Folder Name + Image Name or PDF Name + Page #)
  sourceDocumentName?: string;
  sourcePageNumber?: number;
  sourcePath?: string;
  ingestOrder?: number;
  indexKey?: string;
  indexSchemaVersion?: number;
  fileObj: File;
  previewUrl: string; // Object URL for thumbnail
  rotation?: number; // 0, 90, 180, 270 (degrees)
  
  // Step C Data
  language?: string;
  productionMode?: string;
  hasHebrewHandwriting?: boolean;
  
  // Step E Human Entry / Flags
  manualTranscription?: string;
  manualDescription?: string;
  shouldTranscribe: boolean;
  shouldTranslate: boolean;
  shouldDownloadImage: boolean;
  
  // Step F Data
  generatedTranscription?: string;
  generatedTranslation?: string; // To English
  confidenceScore?: number; // 1-5 rating of transcription confidence
  entities?: NamedEntities; // Entities extracted during transcription
  
  // Researcher flags
  irrelevant?: boolean;

  // Processing States
  status: 'pending' | 'analyzing' | 'analyzed' | 'transcribing' | 'done' | 'error';
  error?: string;
}

export interface DocType {
  id: number;
  name: string;
}

export interface ClusterPageRef {
  pageId: string;
  source: 'ai' | 'manual';
  note?: string;
  startChar?: number;
  endChar?: number;
}

export interface Cluster {
  id: number;
  title: string;
  pageRange: string;
  summary: string;
  pageIds: string[];
  pageRefs?: ClusterPageRef[];
  reviewStatus?: 'ai-proposed' | 'human-reviewed' | 'final';
  reviewedBy?: string;
  reviewedAt?: string;
  aiConfidence?: number;
  boundaryReasons?: string[];
  
  // Detailed Metadata
  prisonName?: string;
  docTypes?: DocType[];
  subjects?: string[];
  languages?: string[];
  originalDate?: string;
  standardizedDate?: string; // yyyy-mm-dd
  
  // Multi-correspondent support
  senders?: Correspondent[];
  recipients?: Correspondent[];
  
  // Aggregated Entities
  entities?: NamedEntities;
}

export interface SourceAppearance {
  id: string; // e.g. "Doc #1" or "Page Title"
  note?: string;
}

export interface ReconciliationRecord {
  id: string;
  extractedName: string;
  type: 'person' | 'organization' | 'role' | 'prison';
  matchedId?: number;
  matchedName?: string;
  status: 'pending' | 'matched' | 'rejected' | 'custom';
  sourceAppearances: SourceAppearance[];
  addedAt?: string; // Date for custom additions
}

export interface AppState {
  apiKey: string | null;
  userName: string; // Researcher Name
  mode: AnalysisMode | null;
  tier: Tier;
  files: ArchivalPage[];
  clusters: Cluster[];
  reconciliationList: ReconciliationRecord[];
  masterVocabulary: EntityReference[];
  processingStatus: ProcessingStatus;
  uiState: 'welcome' | 'config' | 'dashboard' | 'clustering' | 'entities';
  archiveName?: string;
}
