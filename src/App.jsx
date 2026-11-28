import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import {
  FAMILY_EMAIL, getSession, signIn, signOut, selectRows, upsertRow, insertRow, deleteRow, rpc, uploadPhoto,
} from './lib/supabase';
import { StatsPanel, ContactButtons, CorrectionForm, Announcements, MemorialPage } from './components/Extras2';
import { makeGender } from './lib/relations';
import { NewsletterPage } from './components/Extras4';
import { EidStrip } from './components/Extras5';
import { LifeBook, BioFields, BIO_KEYS } from './components/Extras6';
import { knownDob, knownBio, knownPob } from './lib/placeholders';
import { CapsulePage, CapsuleBanner, PerspectiveContext, PerspectiveBar, usePerspective } from './components/Extras3';
import { UpcomingPanel, RelationTool, MemberMultiSelect, TaggedMembers, MemberLinks, RequestForm, BackupPanel, FamilyCodeForm, InstallButton } from './components/Extras';
import {
  UserPlus, LogOut, Search, Sun, Moon, XCircle, Plus, Trash, Edit,
  CheckCircle, ArrowRight, Eye, Phone, Briefcase, GraduationCap, Map,
  Camera, Image as ImageIcon, Upload, Shield, UserCog, Settings,
  Users, Calendar, MapPin, BookOpen, Award, Lock, Mail, ChevronRight,
  BarChart3, Activity, FileText, Image, UserCheck, UserX, AlertTriangle,
  Save, X, ChevronDown, Menu, Home, TreeDeciduous, Clock, LogIn, Crown
} from 'lucide-react';

// ==========================================
// CONSTANTS & CONFIG
// ==========================================
// All family data lives in the Supabase database. Nothing secret is stored in this file:
// the family code and admin passwords are checked by the server (Supabase Auth).
const MAX_LOGS = 200;
const MAX_IMAGE_SIDE = 1280;
const USER_KEY = "family_current_user_v4"; // only remembers the display name on this device

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const loadStorage = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
};

const saveStorage = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* storage unavailable */ }
};

// Shrinks a picked image and returns it as a JPEG blob ready to upload.
const compressImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('read failed'));
  reader.onload = () => {
    const img = new window.Image(); // "Image" is also the name of an icon imported above
    img.onerror = () => reject(new Error('decode failed'));
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), 'image/jpeg', 0.8);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const formatDate = (dateStr) => {
  if (!dateStr) return 'অনির্ধারিত';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateStr; }
};

const getBadge = (member) => {
  if (member.role === 'Dada') return { char: 'দ', color: 'bg-amber-600 text-white', label: 'দাদা' };
  if (member.role === 'Dadi') return { char: 'দ', color: 'bg-rose-600 text-white', label: 'দাদী' };
  if (member.role === 'Father') return { char: 'ব', color: 'bg-blue-600 text-white', label: 'বাবা' };
  if (member.role === 'Mother') return { char: 'ম', color: 'bg-emerald-600 text-white', label: 'মা' };
  if (member.spouseId && !member.fatherId && !member.motherId) return { char: 'বৌ', color: 'bg-purple-600 text-white', label: 'পুত্রবধূ' };
  return { char: 'স', color: 'bg-indigo-500 text-white', label: 'সন্তান' };
};

// ==========================================
// FAMILY TREE (couples -> children -> their couples, any number of generations)
// ==========================================
function buildTreeUnits(members) {
  const byId = new globalThis.Map(members.map(m => [m.id, m]));
  const hasParents = (m) => !!(byId.get(m.fatherId) || byId.get(m.motherId));
  const spouseOf = (m) => {
    const s = byId.get(m.spouseId);
    if (s) return s;
    return members.find(o => o.spouseId === m.id) || null;
  };
  // A unit is one person plus their partner. The "main" person is the one who has parents in the tree.
  const unitOf = (m) => {
    const sp = spouseOf(m);
    if (!sp) return { main: m, spouse: null };
    if (hasParents(m) || !hasParents(sp)) return { main: m, spouse: sp };
    return { main: sp, spouse: m };
  };
  const seen = new Set();
  const makeUnit = (m, depth) => {
    const { main, spouse } = unitOf(m);
    seen.add(main.id);
    if (spouse) seen.add(spouse.id);
    const ids = new Set([main.id, spouse?.id].filter(Boolean));
    const kids = members.filter(c => !seen.has(c.id) && (ids.has(c.fatherId) || ids.has(c.motherId)));
    const children = [];
    for (const kid of kids) {
      if (seen.has(kid.id)) continue;
      children.push(makeUnit(kid, depth + 1));
    }
    return { key: main.id, main, spouse, depth, children };
  };
  const roots = [];
  for (const m of members) {
    if (seen.has(m.id) || hasParents(m)) continue;
    const sp = spouseOf(m);
    if (sp && hasParents(sp)) continue; // married-in partner, shown with their spouse
    roots.push(makeUnit(m, 0));
  }
  const leftover = members.filter(m => !seen.has(m.id));
  return { roots, leftover };
}

const countUnitPeople = (u) => 1 + (u.spouse ? 1 : 0) + u.children.reduce((n, c) => n + countUnitPeople(c), 0);

const genLabel = (depth) => ['পরম শিকড়', 'দ্বিতীয় প্রজন্ম', 'তৃতীয় প্রজন্ম', 'চতুর্থ প্রজন্ম', 'পঞ্চম প্রজন্ম', 'ষষ্ঠ প্রজন্ম'][depth] || `${depth + 1}ম প্রজন্ম`;

function PersonChip({ m, onSelect }) {
  const badge = getBadge(m);
  const pv = useContext(PerspectiveContext);
  const bc = useContext(BranchContext);
  const branch = bc.colorOf ? bc.colorOf.get(m.id) : null;
  const branchDim = !!bc.focus && (!branch || branch.key !== bc.focus);
  const isViewer = !!pv.viewer && pv.viewer.id === m.id;
  const term = pv.viewer && !isViewer ? pv.term(m) : '';
  const dim = !!pv.direct && !pv.direct.has(m.id);
  return (
    <button type="button" onClick={() => onSelect(m)} className={`flex items-center gap-2 text-left hover:scale-[1.03] transition min-w-0 ${dim || branchDim ? 'opacity-30' : ''} ${isViewer ? 'rounded-full ring-2 ring-[#D4AF37] pr-2' : ''}`}>
      <span className="relative flex-shrink-0">
        <img src={m.avatar} alt={m.name} style={branch ? { borderColor: branch.color } : undefined} className="w-11 h-11 rounded-full object-cover border-[3px] border-[#D4AF37] shadow" />
        <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-bold text-[8px] ${badge.color} border border-white`}>{badge.char}</span>
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-[11px] leading-tight break-words">{m.name}</span>
        {pv.viewer ? (
          <span className="block text-[10px] font-bold text-[#B8860B]">{isViewer ? '★ তিনি নিজে' : term}</span>
        ) : (
          <span className="block text-[9px] text-gray-400">{m.isDeceased ? 'মরহুম/মরহুমা' : (m.profession || '')}</span>
        )}
      </span>
    </button>
  );
}

function TreeUnit({ unit, onSelect, collapsed, toggle }) {
  const isCollapsed = collapsed.has(unit.key);
  const kids = unit.children;
  const bc = useContext(BranchContext);
  const own = bc.colorOf ? bc.colorOf.get(unit.main.id) : null;
  return (
    <div>
      <div style={own ? { borderColor: own.color, backgroundColor: `${own.color}14` } : undefined} className={`inline-flex flex-wrap items-center gap-2 rounded-2xl border ${own ? 'border-2' : 'border-emerald-600/30'} bg-white/70 dark:bg-white/5 px-3 py-2 shadow-sm max-w-full`}>
        <PersonChip m={unit.main} onSelect={onSelect} />
        {unit.spouse && (
          <>
            <span className="text-[#D4AF37] text-sm" title="দম্পতি">💍</span>
            <PersonChip m={unit.spouse} onSelect={onSelect} />
          </>
        )}
        {kids.length > 0 && (
          <button type="button" onClick={() => toggle(unit.key)} className="ml-1 text-[10px] font-bold px-2 py-1 rounded-full bg-[#1E3F20] text-[#D4AF37]">
            {isCollapsed ? `▶ সন্তান ${kids.length}` : `▼ সন্তান ${kids.length}`}
          </button>
        )}
      </div>
      {kids.length > 0 && !isCollapsed && (
        <div className="ml-4 mt-2 pl-4 border-l-2 border-emerald-500/40 space-y-3">
          {kids.map(k => (
            <div key={k.key} className="relative before:absolute before:-left-4 before:top-6 before:w-4 before:h-0.5 before:bg-emerald-500/40">
              <p className="text-[9px] text-gray-400 mb-1">{genLabel(k.depth)}</p>
              <TreeUnit unit={k} onSelect={onSelect} collapsed={collapsed} toggle={toggle} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Every child of the founding couple starts a branch; that whole line of descendants shares one colour.
const BRANCH_COLORS = ['#2E7D32', '#C2185B', '#1565C0', '#EF6C00', '#6A1B9A', '#00838F', '#AD1457', '#558B2F', '#4527A0', '#BF360C'];
const BranchContext = React.createContext({ colorOf: null, focus: '' });

class TreeErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    const { members, onSelect } = this.props;
    return (
      <div className="space-y-3">
        <p className="text-xs text-red-500 font-bold break-words">গাছ আঁকতে সমস্যা হয়েছে: {String(this.state.error?.message || this.state.error)}</p>
        <p className="text-[11px] text-gray-400">আপাতত সদস্যদের তালিকা দেখানো হচ্ছে।</p>
        <div className="flex flex-wrap gap-3">
          {members.map(m => (
            <button key={m.id} type="button" onClick={() => onSelect(m)} className="text-[11px] font-bold px-3 py-2 rounded-xl border">{m.name}</button>
          ))}
        </div>
      </div>
    );
  }
}

function FamilyTree({ members, onSelect }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [colorOn, setColorOn] = useState(true);
  const [focus, setFocus] = useState('');
  const { roots, leftover } = useMemo(() => buildTreeUnits(members), [members]);
  const branches = useMemo(() => {
    const colorOf = new globalThis.Map();
    const list = [];
    let i = 0;
    roots.forEach(r => r.children.forEach(c => {
      const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
      i += 1;
      let count = 0;
      const walk = (u) => {
        [u.main, u.spouse].filter(Boolean).forEach(x => { colorOf.set(x.id, { color, key: c.key }); count += 1; });
        u.children.forEach(walk);
      };
      walk(c);
      list.push({ key: c.key, color, name: c.main.name, count });
    }));
    return { colorOf, list };
  }, [roots]);
  const branchValue = useMemo(() => ({ colorOf: colorOn ? branches.colorOf : null, focus: colorOn ? focus : '' }), [colorOn, focus, branches]);
  const toggle = (key) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const parentKeys = [];
  const walk = (u) => { if (u.children.length) parentKeys.push(u.key); u.children.forEach(walk); };
  roots.forEach(walk);
  if (members.length === 0) return <p className="text-xs text-gray-400 text-center py-10">এখনো কোনো সদস্য নেই।</p>;
  return (
    <div className="space-y-4 print-area">
      <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
        <p className="text-[11px] text-gray-400">মোট {members.length} জন। সদস্যের উপর চাপ দিলে বিস্তারিত দেখা যাবে।</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setCollapsed(new Set())} className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-emerald-700 text-white">সব খুলুন</button>
          <button type="button" onClick={() => setCollapsed(new Set(parentKeys))} className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-black/20 dark:bg-white/10">সব গুটান</button>
          <button type="button" onClick={() => { setCollapsed(new Set()); setTimeout(() => window.print(), 400); }} className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-[#D4AF37] text-black">🖨️ PDF / প্রিন্ট</button>
        </div>
      </div>
      {branches.list.length > 0 && (
        <div className="p-3 rounded-2xl border border-gray-200 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] font-bold">🎨 শাখা অনুযায়ী রং</p>
            <label className="flex items-center gap-1 text-[10px] font-bold print:hidden">
              <input type="checkbox" checked={colorOn} onChange={e => { setColorOn(e.target.checked); setFocus(''); }} /> রং দেখান
            </label>
          </div>
          {colorOn && (
            <>
              <div className="flex flex-wrap gap-2">
                {branches.list.map(b => (
                  <button
                    key={b.key} type="button"
                    onClick={() => setFocus(f => (f === b.key ? '' : b.key))}
                    style={{ borderColor: b.color, backgroundColor: focus === b.key ? b.color : `${b.color}1A`, color: focus === b.key ? '#fff' : undefined }}
                    className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    {cleanName(b.name)}-এর শাখা · {b.count} জন
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 print:hidden">কোনো শাখার উপর চাপ দিলে শুধু সেই শাখা উজ্জ্বল থাকবে। আবার চাপলে সব ফিরবে।</p>
            </>
          )}
        </div>
      )}
      <BranchContext.Provider value={branchValue}>
      {roots.map(r => (
        <div key={r.key} className="p-3 rounded-2xl bg-gray-50 dark:bg-black/10 overflow-x-auto">
          <p className="text-[10px] font-bold text-amber-600 mb-2">{genLabel(0)} · এই শাখায় {countUnitPeople(r)} জন</p>
          <TreeUnit unit={r} onSelect={onSelect} collapsed={collapsed} toggle={toggle} />
        </div>
      ))}
      {leftover.length > 0 && (
        <div className="p-3 rounded-2xl bg-gray-50 dark:bg-black/10">
          <p className="text-[10px] font-bold text-gray-500 mb-2">সম্পর্ক অনির্ধারিত</p>
          <div className="flex flex-wrap gap-3">{leftover.map(m => <PersonChip key={m.id} m={m} onSelect={onSelect} />)}</div>
        </div>
      )}
      </BranchContext.Provider>
    </div>
  );
}

// The founding couple is whoever sits at the top of the biggest branch of the tree.
// Their names are used for the site title, so the super admin controls them just by adding members.
const cleanName = (n) => String(n || '').replace(/^(শ্রদ্ধেয়|মরহুমা|মরহুম|মমতাময়ী)\s+/, '').trim();

function getRootCouple(members) {
  const { roots } = buildTreeUnits(members);
  if (!roots.length) return { people: [], names: '' };
  const size = (u) => 1 + (u.spouse ? 1 : 0) + u.children.reduce((n, c) => n + size(c), 0);
  const best = roots.reduce((a, b) => (size(b) > size(a) ? b : a), roots[0]);
  const people = [best.main, best.spouse].filter(Boolean);
  const gender = makeGender(members);
  people.sort((a, b) => (gender(a) === 'male' ? -1 : 0) - (gender(b) === 'male' ? -1 : 0));
  return { people, names: people.map(x => cleanName(x.name)).join(' ও ') };
}

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function App() {
  // Core data states
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [logs, setLogs] = useState([]);
  const [assistantAdmins, setAssistantAdmins] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);

  // Auth states
  const [authMode, setAuthMode] = useState('member'); // 'member' | 'admin'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => loadStorage(USER_KEY, null));
  const [adminSession, setAdminSession] = useState(null);

  // UI states
  const [themeMode, setThemeMode] = useState('light');
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      return ['dashboard', 'tree', 'directory', 'gallery', 'timeline', 'memorial', 'capsules', 'newsletter', 'eid', 'story', 'request'].includes(t) ? t : 'dashboard';
    } catch { return 'dashboard'; }
  });
  const [adminTab, setAdminTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [dirStatus, setDirStatus] = useState('all');
  const [dirSort, setDirSort] = useState('none');
  const [selectedMember, setSelectedMember] = useState(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const [isEditingMember, setIsEditingMember] = useState(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [customAlert, setCustomAlert] = useState(null);
  const [tempAvatar, setTempAvatar] = useState('');
  const [tempCover, setTempCover] = useState('');
  const [tempMediaFile, setTempMediaFile] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Derived state
  const isAdmin = adminSession !== null;
  const isSuperAdmin = adminSession?.role === 'super';
  const isAssistantAdmin = adminSession?.role === 'assistant';
  const canManageAll = isSuperAdmin;
  const canAddPending = isSuperAdmin || isAssistantAdmin;

  // ===== DATABASE SYNC =====
  const snapshots = useRef({ members: {}, pending_members: {}, events: {}, gallery: {} });
  const queue = useRef(Promise.resolve());
  const loadingRef = useRef(false);

  const setSnapshot = (table, items) => {
    snapshots.current[table] = Object.fromEntries(items.map(i => [i.id, JSON.stringify(i)]));
  };

  const refreshAdmins = async () => {
    const rows = await rpc('list_admins');
    setAssistantAdmins(rows.filter(r => r.role === 'assistant').map(r => ({
      id: r.user_id, name: r.name, email: r.email, createdAt: r.created_at,
    })));
  };

  // Reads everything this user is allowed to see.
  const loadAll = async (role) => {
    const isAnyAdmin = role === 'super' || role === 'assistant';
    const [m, e, g] = await Promise.all([
      selectRows('members', 'select=id,data&order=created_at.asc,id.asc'),
      selectRows('events', 'select=id,data&order=created_at.desc,id.desc'),
      selectRows('gallery', 'select=id,data&order=created_at.desc,id.desc'),
    ]);
    const memberList = m.map(r => r.data);
    const eventList = e.map(r => r.data);
    const galleryList = g.map(r => r.data);
    let pendingList = [];
    let logList = [];
    if (isAnyAdmin) {
      const [p, l] = await Promise.all([
        selectRows('pending_members', 'select=id,data&order=created_at.asc,id.asc'),
        selectRows('activity_logs', `select=message&order=created_at.desc,id.desc&limit=${MAX_LOGS}`),
      ]);
      pendingList = p.map(r => r.data);
      logList = l.map(r => r.message);
    }
    setSnapshot('members', memberList);
    setSnapshot('events', eventList);
    setSnapshot('gallery', galleryList);
    setSnapshot('pending_members', pendingList);
    setMembers(memberList);
    setEvents(eventList);
    setGallery(galleryList);
    setPendingMembers(pendingList);
    setLogs(logList);
    if (role === 'super') await refreshAdmins();
    setDataLoaded(true);
  };

  const reloadData = async () => {
    try { await loadAll(adminSession?.role || 'member'); } catch { /* the alert is already shown */ }
  };

  // Sends only the rows that changed since the last sync to the database.
  const syncTable = (table, items) => {
    if (!dataLoaded) return;
    const snap = snapshots.current[table];
    const next = {};
    const changed = [];
    for (const item of items) {
      const str = JSON.stringify(item);
      next[item.id] = str;
      if (snap[item.id] !== str) changed.push(item);
    }
    const removed = Object.keys(snap).filter(id => !(id in next));
    if (!changed.length && !removed.length) return;
    snapshots.current[table] = next;
    queue.current = queue.current.then(async () => {
      try {
        for (const item of changed) await upsertRow(table, { id: item.id, data: item });
        for (const id of removed) await deleteRow(table, id);
      } catch (err) {
        triggerAlert('সংরক্ষণ করা যায়নি, তাই সর্বশেষ তথ্য আবার আনা হচ্ছে। (' + (err.message || 'ত্রুটি') + ')', 'error');
        await reloadData();
      }
    });
  };

  useEffect(() => { syncTable('members', members); }, [members]);
  useEffect(() => { syncTable('pending_members', pendingMembers); }, [pendingMembers]);
  useEffect(() => { syncTable('events', events); }, [events]);
  useEffect(() => { syncTable('gallery', gallery); }, [gallery]);
  useEffect(() => { saveStorage(USER_KEY, currentUser); }, [currentUser]);

  // Restore a saved sign-in when the page opens.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = getSession();
      if (!session) { setBooting(false); return; }
      try {
        const rows = await selectRows('admins', 'select=role,name');
        if (cancelled) return;
        if (rows.length) setAdminSession({ email: session.user.email, role: rows[0].role, name: rows[0].name });
        else if (session.user.email === FAMILY_EMAIL) setIsAuthenticated(true);
        else await signOut();
      } catch {
        await signOut();
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load the data once somebody is signed in.
  useEffect(() => {
    if (!(isAuthenticated || adminSession) || dataLoaded || loadingRef.current) return;
    loadingRef.current = true;
    loadAll(adminSession?.role || 'member')
      .catch((err) => {
        triggerAlert('তথ্য আনা যায়নি: ' + (err.message || 'ত্রুটি'), 'error');
      })
      .finally(() => { loadingRef.current = false; });
  }, [isAuthenticated, adminSession, dataLoaded]);

  // Alert helper
  const triggerAlert = (message, type = 'success') => {
    setCustomAlert({ message, type });
    setTimeout(() => setCustomAlert(null), 5000);
  };

  const addLog = (message) => {
    const ts = new Date().toLocaleTimeString('bn-BD') + ' - ' + new Date().toLocaleDateString('bn-BD');
    const line = `[${ts}] ${message}`;
    setLogs(prev => [line, ...prev].slice(0, MAX_LOGS));
    insertRow('activity_logs', { message: line.slice(0, 500) }).catch(() => {});
  };

  // Image upload handler
  const handleImageUpload = (e, callback) => {
    const file = e.target.files[0];
    if (!file) return;
    triggerAlert('ছবি আপলোড হচ্ছে...', 'info');
    compressImage(file)
      .then(uploadPhoto)
      .then((url) => { callback(url); triggerAlert('ছবি আপলোড হয়েছে।', 'success'); })
      .catch(() => triggerAlert('ছবি আপলোড করা যায়নি। অন্য ছবি বেছে নিন বা আবার চেষ্টা করুন।', 'error'));
  };

  // ===== AUTH HANDLERS =====
  // Family members sign in with the shared family code. The server checks it.
  const handleMemberLogin = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name') || '').trim();
    const familyCode = String(data.get('familyCode') || '').trim().toLowerCase();
    if (!name) { triggerAlert('আপনার নাম লিখুন।', 'error'); return; }
    setBusy(true);
    try {
      await signIn(FAMILY_EMAIL, familyCode);
      setCurrentUser({ id: 'guest', role: 'Member', name, email: '' });
      setIsAuthenticated(true);
      addLog(`সদস্য "${name}" সফলভাবে লগইন করেছেন`);
      triggerAlert(`স্বাগতম, ${name}! আপনার সেশন সক্রিয় হয়েছে।`, 'success');
    } catch (err) {
      triggerAlert(err.status === 400 ? 'পারিবারিক কোড সঠিক নয়!' : 'লগইন করা যায়নি, ইন্টারনেট সংযোগ দেখুন।', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Admins (super and assistant) sign in with their own email and password.
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get('adminEmail') || '').trim();
    const password = String(data.get('adminPassword') || '');
    setBusy(true);
    try {
      await signIn(email, password);
      const rows = await selectRows('admins', 'select=role,name');
      if (!rows.length) {
        await signOut();
        triggerAlert('এই অ্যাকাউন্টটি অ্যাডমিন নয়!', 'error');
        return;
      }
      setAdminSession({ email, role: rows[0].role, name: rows[0].name });
      addLog(`${rows[0].role === 'super' ? 'সুপার অ্যাডমিন' : 'সহকারী অ্যাডমিন'} "${rows[0].name}" লগইন করেছেন`);
      triggerAlert(rows[0].role === 'super' ? 'সুপার অ্যাডমিন প্যানেলে স্বাগতম!' : `স্বাগতম, ${rows[0].name}!`, 'success');
    } catch (err) {
      triggerAlert(err.status === 400 ? 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়!' : 'লগইন করা যায়নি, ইন্টারনেট সংযোগ দেখুন।', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    addLog(isAdmin
      ? `অ্যাডমিন "${adminSession?.name || adminSession?.email}" লগআউট করেছেন`
      : `সদস্য "${currentUser?.name}" পোর্টাল থেকে বিদায় নিয়েছেন`);
    await signOut();
    setAdminSession(null);
    setIsAuthenticated(false);
    setCurrentUser(null);
    setDataLoaded(false);
    setMembers([]); setPendingMembers([]); setEvents([]); setGallery([]); setLogs([]); setAssistantAdmins([]);
    snapshots.current = { members: {}, pending_members: {}, events: {}, gallery: {} };
    triggerAlert('আপনি সফলভাবে বিদায় নিয়েছেন।', 'info');
  };

  // ===== MEMBER CRUD =====
  const handleAddMember = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newId = 'm_' + Date.now();
    const newMember = {
      id: newId, name: f.get('name'), ...Object.fromEntries(BIO_KEYS.map(k => [k, f.get(k) || ''])),
      dob: f.get('dob') || '', pob: f.get('pob') || '',
      education: f.get('education') || '', profession: f.get('profession') || '',
      fatherId: f.get('fatherId') || '', motherId: f.get('motherId') || '',
      spouseId: f.get('spouseId') || '', gender: f.get('gender') || '', marriageDate: f.get('marriageDate') || '', isDeceased: f.get('isDeceased') === 'on', deathDate: f.get('deathDate') || '', burialPlace: f.get('burialPlace') || '', role: f.get('role') || 'Child',
      phone: f.get('phone') || '', address: f.get('address') || '',
      avatar: tempAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      cover: tempCover || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800'
    };
    setMembers(prev => [...prev, newMember]);
    setIsAddingMember(false);
    setTempAvatar(''); setTempCover('');
    addLog(`নতুন সদস্য "${newMember.name}" যুক্ত করা হয়েছে (by ${adminSession?.name || 'Admin'})`);
    triggerAlert(`"${newMember.name}" সফলভাবে যুক্ত হয়েছে!`, 'success');
  };

  const handleAddPendingMember = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newId = 'pending_' + Date.now();
    const pending = {
      id: newId, name: f.get('name'), ...Object.fromEntries(BIO_KEYS.map(k => [k, f.get(k) || ''])),
      dob: f.get('dob') || '', pob: f.get('pob') || '',
      education: f.get('education') || '', profession: f.get('profession') || '',
      fatherId: f.get('fatherId') || '', motherId: f.get('motherId') || '',
      spouseId: f.get('spouseId') || '', gender: f.get('gender') || '', marriageDate: f.get('marriageDate') || '', isDeceased: f.get('isDeceased') === 'on', deathDate: f.get('deathDate') || '', burialPlace: f.get('burialPlace') || '', role: f.get('role') || 'Child',
      phone: f.get('phone') || '', address: f.get('address') || '',
      requestedBy: adminSession?.name || adminSession?.email,
      requestedAt: new Date().toISOString(),
      avatar: tempAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      cover: tempCover || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800'
    };
    setPendingMembers(prev => [...prev, pending]);
    setTempAvatar(''); setTempCover('');
    addLog(`পেন্ডিং সদস্য "${pending.name}" অনুরোধ পাঠানো হয়েছে`);
    triggerAlert(`"${pending.name}" পেন্ডিং তালিকায় যুক্ত হয়েছে! সুপার অ্যাডমিন এপ্রুভ করবেন।`, 'success');
  };

  const handleApprovePending = (pendingId) => {
    const pending = pendingMembers.find(p => p.id === pendingId);
    if (!pending) return;
    if (pending.kind === 'correction') {
      setMembers(prev => prev.map(m => (m.id === pending.targetId ? { ...m, ...pending.changes } : m)));
      setPendingMembers(prev => prev.filter(p => p.id !== pendingId));
      addLog(`সংশোধনের অনুরোধ "${pending.name}" এপ্রুভ করা হয়েছে`);
      triggerAlert('তথ্য সংশোধন করা হয়েছে।', 'success');
      return;
    }
    const approvedMember = { ...pending, id: pending.id.replace('pending_', 'm_') };
    setMembers(prev => [...prev, approvedMember]);
    setPendingMembers(prev => prev.filter(p => p.id !== pendingId));
    addLog(`পেন্ডিং সদস্য "${pending.name}" এপ্রুভ করা হয়েছে`);
    triggerAlert(`"${pending.name}" সফলভাবে এপ্রুভ হয়ে মেইন তালিকায় যুক্ত হয়েছে!`, 'success');
  };

  const handleRejectPending = (pendingId) => {
    const pending = pendingMembers.find(p => p.id === pendingId);
    setPendingMembers(prev => prev.filter(p => p.id !== pendingId));
    addLog(`পেন্ডিং সদস্য "${pending?.name}" প্রত্যাখ্যান করা হয়েছে`);
    triggerAlert('সদস্যকে প্রত্যাখ্যান করা হয়েছে।', 'info');
  };

  const handleUpdateMember = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const updatedId = isEditingMember.id;
    setMembers(prev => prev.map(m => {
      if (m.id === updatedId) {
        return {
          ...m, name: f.get('name'), ...Object.fromEntries(BIO_KEYS.map(k => [k, f.get(k) || ''])), dob: f.get('dob') || '',
          pob: f.get('pob') || '', education: f.get('education') || '',
          profession: f.get('profession') || '', phone: f.get('phone') || '',
          address: f.get('address') || '', role: f.get('role') || m.role,
          fatherId: f.get('fatherId') || '', motherId: f.get('motherId') || '',
          spouseId: f.get('spouseId') || '', gender: f.get('gender') || '', marriageDate: f.get('marriageDate') || '',
          isDeceased: f.get('isDeceased') === 'on', deathDate: f.get('deathDate') || '', burialPlace: f.get('burialPlace') || '',
          avatar: tempAvatar || m.avatar, cover: tempCover || m.cover
        };
      }
      return m;
    }));
    setIsEditingMember(null);
    setTempAvatar(''); setTempCover('');
    addLog(`সদস্য "${f.get('name')}" এর প্রোফাইল আপডেট করা হয়েছে`);
    triggerAlert('সদস্যের তথ্য সফলভাবে সংশোধন করা হয়েছে।', 'success');
  };

  const handleDeleteMember = (id) => {
    const memberToDelete = members.find(m => m.id === id);
    if (!window.confirm(`"${memberToDelete?.name}" কে মুছে ফেলবেন? এটি ফেরানো যাবে না।`)) return;
    // Also clear links from other members so the family tree has no broken references.
    setMembers(prev => prev.filter(m => m.id !== id).map(m => ({
      ...m,
      fatherId: m.fatherId === id ? '' : m.fatherId,
      motherId: m.motherId === id ? '' : m.motherId,
      spouseId: m.spouseId === id ? '' : m.spouseId
    })));
    addLog(`সদস্য "${memberToDelete?.name}" মুছে ফেলা হয়েছে`);
    triggerAlert('সদস্যের তথ্য সরানো হয়েছে।', 'success');
  };

  // ===== EVENT CRUD =====
  const handleAddEvent = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newEvent = {
      id: 'ev_' + Date.now(), title: f.get('title'), date: f.get('date'),
      description: f.get('description'), category: f.get('category'), icon: f.get('icon') || '📌', pinned: f.get('pinned') === 'on', memberIds: f.getAll('memberIds')
    };
    setEvents(prev => [newEvent, ...prev]);
    setIsAddingEvent(false);
    addLog(`নতুন ঘটনা "${newEvent.title}" যুক্ত করা হয়েছে`);
    triggerAlert('নতুন ঘটনাটি টাইমলাইনে যুক্ত হয়েছে।', 'success');
  };

  const handleDeleteEvent = (id) => {
    const ev = events.find(e => e.id === id);
    if (!window.confirm(`ঘটনা "${ev?.title}" মুছে ফেলবেন?`)) return;
    setEvents(prev => prev.filter(e => e.id !== id));
    addLog(`ঘটনা "${ev?.title}" মুছে ফেলা হয়েছে`);
    triggerAlert('ঘটনাটি সরানো হয়েছে।', 'info');
  };

  // ===== GALLERY CRUD =====
  const handleAddMedia = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!tempMediaFile) {
      triggerAlert('দয়া করে ছবি নির্বাচন করুন।', 'error');
      return;
    }
    const newMedia = {
      id: 'gal_' + Date.now(), title: f.get('title') || 'নতুন পারিবারিক ছবি',
      date: f.get('date') || new Date().toISOString().split('T')[0],
      description: f.get('description') || '', type: f.get('type') || 'image', url: tempMediaFile, eid: f.get('eid') || '', memberIds: f.getAll('memberIds')
    };
    setGallery(prev => [newMedia, ...prev]);
    setIsAddingMedia(false);
    setTempMediaFile('');
    addLog(`গ্যালারিতে "${newMedia.title}" আপলোড করা হয়েছে`);
    triggerAlert('স্মৃতিটি গ্যালারিতে যোগ হয়েছে।', 'success');
  };

  const handleDeleteMedia = (id) => {
    const media = gallery.find(g => g.id === id);
    if (!window.confirm(`"${media?.title}" গ্যালারি থেকে মুছে ফেলবেন?`)) return;
    setGallery(prev => prev.filter(g => g.id !== id));
    addLog(`গ্যালারি থেকে "${media?.title}" মুছে ফেলা হয়েছে`);
    triggerAlert('মিডিয়াটি গ্যালারি থেকে সরানো হয়েছে।', 'info');
  };

  // ===== ADMIN MANAGEMENT =====
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('adminName') || '').trim();
    setBusy(true);
    try {
      await rpc('create_assistant_admin', {
        p_email: String(f.get('adminEmail') || '').trim(),
        p_password: String(f.get('adminPassword') || ''),
        p_name: name,
      });
      await refreshAdmins();
      setIsAddingAdmin(false);
      addLog(`নতুন সহকারী অ্যাডমিন "${name}" যুক্ত করা হয়েছে`);
      triggerAlert(`"${name}" সহকারী অ্যাডমিন হিসেবে যুক্ত হয়েছে!`, 'success');
    } catch (err) {
      const msg = /password must be/.test(err.message) ? 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'
        : /duplicate|already/.test(err.message) ? 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে।'
        : 'অ্যাডমিন যোগ করা যায়নি: ' + err.message;
      triggerAlert(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAdmin = async (adminId) => {
    const admin = assistantAdmins.find(a => a.id === adminId);
    if (!window.confirm(`সহকারী অ্যাডমিন "${admin?.name}" কে সরাবেন?`)) return;
    try {
      await rpc('remove_assistant_admin', { p_user_id: adminId });
      await refreshAdmins();
      addLog(`সহকারী অ্যাডমিন "${admin?.name}" সরানো হয়েছে`);
      triggerAlert('সহকারী অ্যাডমিন সরানো হয়েছে।', 'info');
    } catch (err) {
      triggerAlert('সরানো যায়নি: ' + err.message, 'error');
    }
  };

  // Merge imported data (backup file) into the lists; the sync effects send it to the database.
  const handleImport = ({ members: im, events: ie, gallery: ig }) => {
    const merge = (prev, incoming) => {
      const byId = {};
      const order = [];
      for (const x of prev) { byId[x.id] = x; order.push(x.id); }
      for (const x of incoming) {
        if (!(x.id in byId)) order.push(x.id);
        byId[x.id] = { ...(byId[x.id] || {}), ...x };
      }
      return order.map(id => byId[id]);
    };
    setMembers(prev => merge(prev, im));
    if (ie.length) setEvents(prev => merge(prev, ie));
    if (ig.length) setGallery(prev => merge(prev, ig));
    addLog(`ইমপোর্ট: ${im.length} জন সদস্য, ${ie.length} ঘটনা, ${ig.length} ছবি (by ${adminSession?.name || 'Admin'})`);
    triggerAlert('ইমপোর্ট সম্পন্ন হয়েছে।', 'success');
  };

  // Filtered members
  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = members.filter(m => {
      const text = m.name.toLowerCase().includes(q) ||
        (m.profession && m.profession.toLowerCase().includes(q)) ||
        (m.pob && m.pob.toLowerCase().includes(q)) ||
        (m.address && m.address.toLowerCase().includes(q));
      const status = dirStatus === 'all' || (dirStatus === 'alive' ? !m.isDeceased : !!m.isDeceased);
      return text && status;
    });
    if (dirSort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'bn'));
    else if (dirSort === 'age') list.sort((a, b) => String(a.dob || '').localeCompare(String(b.dob || '')));
    return list;
  }, [members, searchQuery, dirStatus, dirSort]);

  // Family name shown in the header, hero text and footer comes from the founding couple.
  const rootCouple = useMemo(() => getRootCouple(members), [members]);
  const perspective = usePerspective(members);
  const storedTitle = (() => { try { return localStorage.getItem('family_title_v1') || ''; } catch { return ''; } })();
  const archiveTitle = rootCouple.names ? `${rootCouple.names} ঐতিহ্য আর্কাইভ` : (dataLoaded ? 'পারিবারিক ঐতিহ্য আর্কাইভ' : (storedTitle || 'পারিবারিক ঐতিহ্য আর্কাইভ'));
  const familyLabel = rootCouple.people[0] ? `${cleanName(rootCouple.people[0].name)} পরিবার` : 'পরিবার';
  useEffect(() => {
    if (!dataLoaded) return;
    try { localStorage.setItem('family_title_v1', rootCouple.names ? archiveTitle : ''); } catch { /* ignore */ }
    document.title = archiveTitle;
  }, [dataLoaded, rootCouple.names, archiveTitle]);

  // Theme classes
  const isDark = themeMode === 'dark';
  const theme = {
    bg: isDark ? 'bg-[#0b140c]' : 'bg-[#FAFAF9]',
    text: isDark ? 'text-[#FAFAF6]' : 'text-[#2C2C2C]',
    card: isDark ? 'bg-[#163018] border-white/5' : 'bg-white border-gray-100',
    cardHover: isDark ? 'hover:bg-[#1d3d1f]' : 'hover:bg-gray-50',
    input: isDark ? 'border-white/10 text-white bg-[#112212]' : 'border-gray-200 text-black bg-white',
    nav: 'bg-[#1E3F20]',
    accent: '#D4AF37',
    gold: 'text-[#D4AF37]',
    goldBg: 'bg-[#D4AF37]',
  };

  // ==========================================
  // RENDER: LOADING
  // ==========================================
  if (booting || ((isAuthenticated || isAdmin) && !dataLoaded)) {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.text} flex items-center justify-center p-4`}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-[#D4AF37] border-t-transparent animate-spin" />
          <p className="font-bold text-sm">লোড হচ্ছে...</p>
          {customAlert && <p className="text-xs mt-2 text-red-500">{customAlert.message}</p>}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: LOGIN SCREEN
  // ==========================================
  if (!isAuthenticated && !isAdmin) {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.text} flex items-center justify-center p-4 transition-colors duration-300`}>
        <div className={`max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden border-2 border-[#D4AF37]/50 ${isDark ? 'bg-[#163018]/95' : 'bg-white'} transition-all duration-300`}>

          {/* Header */}
          <div className="bg-[#1E3F20] text-white p-8 text-center relative border-b border-[#D4AF37]">
            <button onClick={() => setThemeMode(isDark ? 'light' : 'dark')} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-[#D4AF37]">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="w-16 h-16 rounded-full border-2 border-[#D4AF37] mx-auto flex items-center justify-center bg-white/10 mb-3">
              <span className="text-3xl">🌳</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{storedTitle ? storedTitle.replace(' ঐতিহ্য আর্কাইভ', ' পরিবার') : 'পারিবারিক ঐতিহ্য আর্কাইভ'}</h1>
            <p className="text-xs text-[#D4AF37] mt-1.5 font-medium tracking-wide">সুরক্ষিত পারিবারিক ঐতিহ্য ও আর্কাইভ পোর্টাল</p>
          </div>

          {/* Auth Mode Tabs */}
          <div className="p-6">
            <div className="flex border-b border-gray-200 dark:border-white/10 mb-6">
              <button onClick={() => setAuthMode('member')} className={`flex-1 pb-3 text-xs md:text-sm font-bold transition-all ${authMode === 'member' ? 'border-b-2 border-[#D4AF37] text-[#D4AF37]' : 'text-gray-400'}`}>
                <Users className="w-4 h-4 inline mr-1" /> সদস্য লগইন
              </button>
              <button onClick={() => setAuthMode('admin')} className={`flex-1 pb-3 text-xs md:text-sm font-bold transition-all ${authMode === 'admin' ? 'border-b-2 border-[#D4AF37] text-[#D4AF37]' : 'text-gray-400'}`}>
                <Shield className="w-4 h-4 inline mr-1" /> অ্যাডমিন লগইন
              </button>
            </div>

            {customAlert && (
              <div className={`mb-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${customAlert.type === 'error' ? 'bg-red-100 border-red-300 text-red-800' : customAlert.type === 'info' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-emerald-100 border-emerald-300 text-emerald-800'}`}>
                <CheckCircle className="w-4 h-4 flex-shrink-0" /> <span>{customAlert.message}</span>
              </div>
            )}

            {/* Member Login Form */}
            {authMode === 'member' && (
              <form onSubmit={handleMemberLogin} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">আপনার নাম</label>
                  <input required name="name" type="text" autoComplete="name" placeholder="আপনার পুরো নাম লিখুন" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center gap-1"><Lock className="w-3 h-3" /> পারিবারিক কোড</label>
                  <input required name="familyCode" type="password" autoComplete="off" placeholder="পরিবারের গোপন কোড" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
                <button type="submit" disabled={busy} className="w-full bg-[#1E3F20] text-white p-3.5 rounded-xl font-bold hover:bg-[#112212] transition-all border border-[#D4AF37] text-sm disabled:opacity-60">
                  {busy ? 'যাচাই করা হচ্ছে...' : 'পারিবারিক আর্কাইভে প্রবেশ করুন'}
                </button>
              </form>
            )}

            {/* Admin Login Form */}
            {authMode === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-4 text-xs">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="font-bold text-amber-800 dark:text-[#D4AF37] flex items-center gap-1.5 mb-1">
                    <Shield className="w-4 h-4" /> অ্যাডমিন প্যানেল
                  </p>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400">
                    শুধুমাত্র অনুমোদিত অ্যাডমিনরা এখানে প্রবেশ করতে পারবেন।
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> অ্যাডমিন ইমেইল</label>
                  <input required name="adminEmail" type="email" placeholder="admin@example.com" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center gap-1"><Lock className="w-3 h-3" /> পাসওয়ার্ড</label>
                  <input required name="adminPassword" type="password" placeholder="••••••••" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
                <button type="submit" className="w-full bg-[#1E3F20] text-white p-3.5 rounded-xl font-bold hover:bg-[#112212] transition-all border border-[#D4AF37] text-sm flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" /> অ্যাডমিন প্যানেলে প্রবেশ করুন
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: ADMIN DASHBOARD
  // ==========================================
  if (isAdmin) {
    return (
      <div className={`min-h-screen flex ${theme.bg} ${theme.text} transition-colors duration-300`}>

        {/* Alert */}
        {customAlert && (
          <div className={`fixed top-4 right-4 z-[60] p-4 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-3 transition-all duration-300 ${customAlert.type === 'error' ? 'bg-red-100 border-red-300 text-red-800' : customAlert.type === 'info' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-emerald-100 border-emerald-300 text-emerald-800'}`}>
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{customAlert.message}</span>
          </div>
        )}

        {/* Sidebar */}
        <aside className={`hidden lg:flex flex-col w-64 ${theme.nav} text-white border-r border-[#D4AF37] fixed h-full z-40`}>
          <div className="p-6 border-b border-[#D4AF37]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-[#D4AF37] bg-white/10 flex items-center justify-center">
                {isSuperAdmin ? <Crown className="w-5 h-5 text-[#D4AF37]" /> : <UserCog className="w-5 h-5 text-[#D4AF37]" />}
              </div>
              <div>
                <h2 className="font-bold text-sm">{adminSession?.name}</h2>
                <p className="text-[10px] text-[#D4AF37]">{isSuperAdmin ? 'সুপার অ্যাডমিন' : 'সহকারী অ্যাডমিন'}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <button onClick={() => setAdminTab('overview')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${adminTab === 'overview' ? 'bg-[#D4AF37] text-black' : 'hover:bg-white/10'}`}>
              <BarChart3 className="w-4 h-4" /> ওভারভিউ
            </button>
            <button onClick={() => setAdminTab('members')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${adminTab === 'members' ? 'bg-[#D4AF37] text-black' : 'hover:bg-white/10'}`}>
              <Users className="w-4 h-4" /> সদস্য ব্যবস্থাপনা
            </button>
            {(isSuperAdmin) && (
              <button onClick={() => setAdminTab('pending')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${adminTab === 'pending' ? 'bg-[#D4AF37] text-black' : 'hover:bg-white/10'}`}>
                <UserCheck className="w-4 h-4" /> পেন্ডিং অনুরোধ
                {pendingMembers.length > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{pendingMembers.length}</span>
                )}
              </button>
            )}
            {canAddPending && (
              <button onClick={() => setAdminTab('addPending')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${adminTab === 'addPending' ? 'bg-[#D4AF37] text-black' : 'hover:bg-white/10'}`}>
                <UserPlus className="w-4 h-4" /> নতুন সদস্য যোগ করুন
              </button>
            )}
            <button onClick={() => setAdminTab('events')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${adminTab === 'events' ? 'bg-[#D4AF37] text-black' : 'hover:bg-white/10'}`}>
              <Calendar className="w-4 h-4" /> টাইমলাইন / ইভেন্ট
            </button>
            <button onClick={() => setAdminTab('gallery')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${adminTab === 'gallery' ? 'bg-[#D4AF37] text-black' : 'hover:bg-white/10'}`}>
              <Image className="w-4 h-4" /> গ্যালারি ব্যবস্থাপনা
            </button>
            <button onClick={() => setAdminTab('logs')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${adminTab === 'logs' ? 'bg-[#D4AF37] text-black' : 'hover:bg-white/10'}`}>
              <Activity className="w-4 h-4" /> সিস্টেম লগ
            </button>
            {isSuperAdmin && (
              <button onClick={() => setAdminTab('admins')} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${adminTab === 'admins' ? 'bg-[#D4AF37] text-black' : 'hover:bg-white/10'}`}>
                <Shield className="w-4 h-4" /> অ্যাডমিন ব্যবস্থাপনা
              </button>
            )}
          </nav>

          <div className="p-4 border-t border-[#D4AF37]/50 space-y-2">
            <button onClick={() => setThemeMode(isDark ? 'light' : 'dark')} className="w-full text-left px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/10 flex items-center gap-2 transition">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} থিম পরিবর্তন
            </button>
            <button onClick={handleSignOut} className="w-full text-left px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 text-red-400 flex items-center gap-2 transition">
              <LogOut className="w-4 h-4" /> লগআউট
            </button>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#1E3F20] text-white border-b border-[#D4AF37] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSuperAdmin ? <Crown className="w-5 h-5 text-[#D4AF37]" /> : <UserCog className="w-5 h-5 text-[#D4AF37]" />}
            <span className="font-bold text-sm">{adminSession?.name}</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg hover:bg-white/10">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
            <div className={`fixed right-0 top-12 bottom-0 z-50 w-64 max-w-[80vw] ${theme.nav} text-white p-4 space-y-1 overflow-y-auto shadow-2xl`} onClick={e => e.stopPropagation()}>
              {[
                { tab: 'overview', icon: BarChart3, label: 'ওভারভিউ' },
                { tab: 'members', icon: Users, label: 'সদস্য ব্যবস্থাপনা' },
                ...(isSuperAdmin ? [{ tab: 'pending', icon: UserCheck, label: 'পেন্ডিং অনুরোধ', badge: pendingMembers.length }] : []),
                ...(canAddPending ? [{ tab: 'addPending', icon: UserPlus, label: 'নতুন সদস্য যোগ করুন' }] : []),
                { tab: 'events', icon: Calendar, label: 'টাইমলাইন / ইভেন্ট' },
                { tab: 'gallery', icon: Image, label: 'গ্যালারি ব্যবস্থাপনা' },
                { tab: 'backup', icon: Upload, label: 'ব্যাকআপ / ইমপোর্ট' },
                { tab: 'logs', icon: Activity, label: 'সিস্টেম লগ' },
                ...(isSuperAdmin ? [{ tab: 'admins', icon: Shield, label: 'অ্যাডমিন ব্যবস্থাপনা' }] : []),
              ].map(item => (
                <button key={item.tab} onClick={() => { setAdminTab(item.tab); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${adminTab === item.tab ? 'bg-[#D4AF37] text-black' : 'hover:bg-white/10'}`}>
                  <item.icon className="w-4 h-4" /> {item.label}
                  {item.badge > 0 && <span className="ml-auto bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                </button>
              ))}
              <button onClick={() => { setThemeMode(isDark ? 'light' : 'dark'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-white/10 flex items-center gap-2">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} থিম পরিবর্তন
              </button>
              <button onClick={handleSignOut} className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-red-500/20 text-red-400 flex items-center gap-2">
                <LogOut className="w-4 h-4" /> লগআউট
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-4 lg:p-8 mt-12 lg:mt-0 max-w-7xl mx-auto w-full">

          {/* Admin Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">
                {adminTab === 'overview' && '📊 অ্যাডমিন ড্যাশবোর্ড ওভারভিউ'}
                {adminTab === 'members' && '👥 সদস্য ব্যবস্থাপনা'}
                {adminTab === 'pending' && '⏳ পেন্ডিং সদস্য অনুরোধ'}
                {adminTab === 'addPending' && '➕ নতুন সদস্য যোগ করুন'}
                {adminTab === 'events' && '📅 টাইমলাইন / ইভেন্ট ব্যবস্থাপনা'}
                {adminTab === 'gallery' && '🖼️ গ্যালারি ব্যবস্থাপনা'}
                {adminTab === 'backup' && '💾 ব্যাকআপ / ইমপোর্ট'}
                {adminTab === 'logs' && '📋 সিস্টেম লগ'}
                {adminTab === 'admins' && '🛡️ অ্যাডমিন ব্যবস্থাপনা'}
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                {isSuperAdmin ? 'সুপার অ্যাডমিন হিসেবে আপনার সম্পূর্ণ নিয়ন্ত্রণ' : 'সহকারী অ্যাডমিন হিসেবে আপনার সীমিত নিয়ন্ত্রণ'}
              </p>
            </div>
          </div>

          {/* ===== ADMIN TAB: OVERVIEW ===== */}
          {adminTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="মোট সদস্য" value={`${members.length} জন`} color="text-emerald-500" bg="bg-emerald-100 dark:bg-emerald-950/40" theme={theme} />
                <StatCard icon={UserCheck} label="পেন্ডিং" value={`${pendingMembers.length} জন`} color="text-amber-500" bg="bg-amber-100 dark:bg-amber-950/40" theme={theme} />
                <StatCard icon={Calendar} label="মোট ইভেন্ট" value={`${events.length}টি`} color="text-blue-500" bg="bg-blue-100 dark:bg-blue-950/40" theme={theme} />
                <StatCard icon={Image} label="গ্যালারি" value={`${gallery.length}টি`} color="text-purple-500" bg="bg-purple-100 dark:bg-purple-950/40" theme={theme} />
              </div>

              {/* Recent Activity */}
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-[#D4AF37]" /> সাম্প্রতিক কার্যক্রম
                </h3>
                <div className={`font-mono text-[10px] space-y-2 max-h-[300px] overflow-y-auto ${isDark ? 'text-[#D4AF37]' : 'text-emerald-700'} ${isDark ? 'bg-[#0b140c]' : 'bg-gray-50'} p-4 rounded-xl`}>
                  {logs.slice(0, 15).map((log, i) => (
                    <div key={i} className="border-b border-white/5 pb-1">&gt; {log}</div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-[#D4AF37]" /> দ্রুত পদক্ষেপ
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {canAddPending && (
                    <button onClick={() => setAdminTab('addPending')} className="p-4 rounded-xl bg-[#1E3F20] text-white hover:bg-[#2a5230] transition text-xs font-bold flex flex-col items-center gap-2">
                      <UserPlus className="w-5 h-5 text-[#D4AF37]" /> নতুন সদস্য যোগ
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button onClick={() => { setIsAddingEvent(true); }} className="p-4 rounded-xl bg-[#1E3F20] text-white hover:bg-[#2a5230] transition text-xs font-bold flex flex-col items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#D4AF37]" /> ইভেন্ট যোগ
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button onClick={() => { setIsAddingMedia(true); }} className="p-4 rounded-xl bg-[#1E3F20] text-white hover:bg-[#2a5230] transition text-xs font-bold flex flex-col items-center gap-2">
                      <Image className="w-5 h-5 text-[#D4AF37]" /> গ্যালারিতে ছবি
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button onClick={() => setAdminTab('admins')} className="p-4 rounded-xl bg-[#1E3F20] text-white hover:bg-[#2a5230] transition text-xs font-bold flex flex-col items-center gap-2">
                      <Shield className="w-5 h-5 text-[#D4AF37]" /> অ্যাডমিন যোগ
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== ADMIN TAB: MEMBERS ===== */}
          {adminTab === 'members' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border ${theme.card}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                    <input type="text" placeholder="নাম, পেশা বা জেলা লিখে খুঁজুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`w-full text-xs pl-10 pr-4 py-3 rounded-xl bg-transparent border ${theme.input}`} />
                  </div>
                  {canAddPending && (
                    <button onClick={() => setAdminTab('addPending')} className="bg-[#D4AF37] text-black font-bold text-xs px-4 py-3 rounded-xl flex items-center gap-2 hover:bg-[#b5942d] transition">
                      <Plus className="w-4 h-4" /> নতুন সদস্য
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                        <th className="text-left py-3 px-2 font-bold text-[10px] uppercase text-gray-400">সদস্য</th>
                        <th className="text-left py-3 px-2 font-bold text-[10px] uppercase text-gray-400">ভূমিকা</th>
                        <th className="text-left py-3 px-2 font-bold text-[10px] uppercase text-gray-400">পেশা</th>
                        <th className="text-left py-3 px-2 font-bold text-[10px] uppercase text-gray-400">ঠিকানা</th>
                        <th className="text-left py-3 px-2 font-bold text-[10px] uppercase text-gray-400">স্ট্যাটাস</th>
                        {canManageAll && <th className="text-right py-3 px-2 font-bold text-[10px] uppercase text-gray-400">অ্যাকশন</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {filteredMembers.map(m => (
                        <tr key={m.id} className={`${theme.cardHover} transition`}>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full object-cover border border-[#D4AF37]" />
                              <span className="font-bold">{m.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">{m.role}</td>
                          <td className="py-3 px-2 text-gray-400">{m.profession || '-'}</td>
                          <td className="py-3 px-2 text-gray-400">{m.address || '-'}</td>
                          <td className="py-3 px-2">
                            {m.isDeceased ? (
                              <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full text-[9px] font-bold">মরহুম</span>
                            ) : (
                              <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[9px] font-bold">সক্রিয়</span>
                            )}
                          </td>
                          {canManageAll && (
                            <td className="py-3 px-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => setSelectedMember(m)} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition" title="দেখুন">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setIsEditingMember(m)} className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white transition" title="এডিট">
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                                                  <button onClick={() => handleDeleteMember(m.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition" title="ডিলিট">
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredMembers.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-xs">🔍 কোনো সদস্য খুঁজে পাওয়া যায়নি।</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== ADMIN TAB: PENDING ===== */}
          {adminTab === 'pending' && isSuperAdmin && (
            <div className="space-y-4">
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
                  <UserCheck className="w-4 h-4 text-[#D4AF37]" /> পেন্ডিং সদস্য অনুরোধ
                  {pendingMembers.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingMembers.length} জন অপেক্ষমান</span>}
                </h3>

                {pendingMembers.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                    <p className="font-bold">কোনো পেন্ডিং অনুরোধ নেই!</p>
                    <p className="text-xs mt-1">সকল সদস্য অনুরোধ এপ্রুভ করা হয়েছে।</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingMembers.map(p => (
                      <div key={p.id} className={`p-4 rounded-xl border ${isDark ? 'bg-[#1d3d1f] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <img src={p.avatar} alt={p.name} className="w-12 h-12 rounded-full object-cover border-2 border-[#D4AF37]" />
                            <div>
                              <h4 className="font-bold text-sm">{p.name}</h4>
                              <p className="text-[10px] text-gray-400">{p.profession || 'পেশা অনির্ধারিত'} • {knownPob(p) || '—'}</p>
                              <p className="text-[10px] text-[#D4AF37]">অনুরোধকারী: {p.requestedBy || 'অজানা'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setSelectedMember(p)} className="px-3 py-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition text-xs font-bold flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> দেখুন
                            </button>
                            <button onClick={() => handleApprovePending(p.id)} className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition text-xs font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> এপ্রুভ
                            </button>
                            <button onClick={() => handleRejectPending(p.id)} className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition text-xs font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> প্রত্যাখ্যান
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== ADMIN TAB: ADD PENDING / ADD MEMBER ===== */}
          {adminTab === 'addPending' && canAddPending && (
            <div className="space-y-4">
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
                  <UserPlus className="w-4 h-4 text-[#D4AF37]" />
                  {isSuperAdmin ? 'নতুন সদস্য সরাসরি যোগ করুন' : 'পেন্ডিং সদস্য অনুরোধ পাঠান'}
                </h3>
                <form onSubmit={isSuperAdmin ? handleAddMember : handleAddPending} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">পূর্ণ নাম <span className="text-red-500">*</span></label>
                      <input required name="name" type="text" placeholder="যেমন: রহিম উদ্দিন" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">ভূমিকা</label>
                      <select name="role" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`}>
                        <option value="Child">সন্তান / সদস্য</option>
                        <option value="Father">পিতা / কাকা</option>
                        <option value="Mother">মাতা / কাকিমা</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" name="isDeceased"  /> মরহুম / মরহুমা</label>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">মৃত্যুর তারিখ</label>
                      <input name="deathDate" type="date"  className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">কবরের স্থান</label>
                      <input name="burialPlace" type="text"  className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">লিঙ্গ</label>
                      <select name="gender"  className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`}>
                        <option value="">বেছে নিন</option>
                        <option value="male">ছেলে / পুরুষ</option>
                        <option value="female">মেয়ে / নারী</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">বিবাহের তারিখ</label>
                      <input name="marriageDate" type="date"  className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                  </div>
                  <BioFields cls={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} known={knownBio} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">পেশা</label>
                      <input name="profession" type="text" placeholder="যেমন: ব্যবসায়ী" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">শিক্ষাগত যোগ্যতা</label>
                      <input name="education" type="text" placeholder="যেমন: বিএসসি" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">জন্ম তারিখ</label>
                      <input name="dob" type="date" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">মোবাইল</label>
                      <input name="phone" type="text" placeholder="01xxxxxxxxx" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">জন্মস্থান</label>
                      <input name="pob" type="text" placeholder="যেমন: চট্টগ্রাম" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">বর্তমান ঠিকানা</label>
                    <input name="address" type="text" placeholder="যেমন: নাসিরাবাদ, চট্টগ্রাম" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">পিতা</label>
                      <select name="fatherId" className={`w-full border rounded-xl p-2 bg-transparent text-xs ${theme.input}`}>
                        <option value="">নির্বাচন করুন</option>
                        {members.map(m => <option key={m.id} value={m.id} className="text-black">{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">মাতা</label>
                      <select name="motherId" className={`w-full border rounded-xl p-2 bg-transparent text-xs ${theme.input}`}>
                        <option value="">নির্বাচন করুন</option>
                        {members.map(m => <option key={m.id} value={m.id} className="text-black">{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">স্বামী/স্ত্রী</label>
                      <select name="spouseId" className={`w-full border rounded-xl p-2 bg-transparent text-xs ${theme.input}`}>
                        <option value="">নির্বাচন করুন</option>
                        {members.map(m => <option key={m.id} value={m.id} className="text-black">{m.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center gap-1"><Camera className="w-3.5 h-3.5 text-[#D4AF37]" /> প্রোফাইল ছবি</label>
                      <input type="file" accept="image/*" onChange={e => handleImageUpload(e, setTempAvatar)} className={`w-full border rounded-xl p-2 bg-transparent text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#D4AF37]/20 file:text-[#D4AF37]`} />
                      {tempAvatar && <p className="text-[10px] text-emerald-500 mt-1">✓ লোড হয়েছে</p>}
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5 text-[#D4AF37]" /> কভার ফটো</label>
                      <input type="file" accept="image/*" onChange={e => handleImageUpload(e, setTempCover)} className={`w-full border rounded-xl p-2 bg-transparent text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#D4AF37]/20 file:text-[#D4AF37]`} />
                      {tempCover && <p className="text-[10px] text-emerald-500 mt-1">✓ লোড হয়েছে</p>}
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-[#1E3F20] text-white p-3.5 rounded-xl font-bold hover:bg-[#2a5230] transition-all border border-[#D4AF37] text-sm flex items-center justify-center gap-2">
                    {isSuperAdmin ? <><CheckCircle className="w-4 h-4" /> সরাসরি যুক্ত করুন</> : <><UserPlus className="w-4 h-4" /> পেন্ডিং এ পাঠান</>}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ===== ADMIN TAB: EVENTS ===== */}
          {adminTab === 'events' && (
            <div className="space-y-4">
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-[#D4AF37]" /> টাইমলাইন / ইভেন্ট তালিকা</h3>
                  {isSuperAdmin && (
                    <button onClick={() => setIsAddingEvent(true)} className="bg-[#D4AF37] text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#b5942d] transition">
                      <Plus className="w-4 h-4" /> ইভেন্ট যোগ
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {events.map(ev => (
                    <div key={ev.id} className={`p-4 rounded-xl border ${isDark ? 'bg-[#1d3d1f] border-white/5' : 'bg-gray-50 border-gray-100'} flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{ev.icon}</span>
                        <div>
                          <h4 className="font-bold text-xs">{ev.title}</h4>
                          <p className="text-[10px] text-gray-400">{formatDate(ev.date)} • {ev.category}</p>
                          <p className="text-[11px] text-gray-500 mt-1 max-w-md">{ev.description}</p>
                        </div>
                      </div>
                      {isSuperAdmin && (
                        <button onClick={() => handleDeleteEvent(ev.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition">
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {events.length === 0 && <div className="text-center py-8 text-gray-400 text-xs">কোনো ইভেন্ট নেই।</div>}
                </div>
              </div>
            </div>
          )}

          {/* ===== ADMIN TAB: GALLERY ===== */}
          {adminTab === 'gallery' && (
            <div className="space-y-4">
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm flex items-center gap-2"><Image className="w-4 h-4 text-[#D4AF37]" /> গ্যালারি তালিকা</h3>
                  {isSuperAdmin && (
                    <button onClick={() => setIsAddingMedia(true)} className="bg-[#D4AF37] text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#b5942d] transition">
                      <Upload className="w-4 h-4" /> ছবি আপলোড
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gallery.map(item => (
                    <div key={item.id} className={`rounded-xl overflow-hidden border ${isDark ? 'bg-[#1d3d1f] border-white/5' : 'bg-white border-gray-100'}`}>
                      <div className="aspect-video bg-black/10">
                        <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-xs">{item.title}</h4>
                          {isSuperAdmin && (
                            <button onClick={() => handleDeleteMedia(item.id)} className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition">
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">{item.date}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{item.description}</p>
                      </div>
                    </div>
                  ))}
                  {gallery.length === 0 && <div className="col-span-full text-center py-8 text-gray-400 text-xs">গ্যালারি খালি।</div>}
                </div>
              </div>
            </div>
          )}

          {/* ===== ADMIN TAB: BACKUP ===== */}
          {adminTab === 'backup' && (
            <BackupPanel members={members} pendingMembers={pendingMembers} events={events} gallery={gallery} isSuperAdmin={isSuperAdmin} onImport={handleImport} />
          )}

          {/* ===== ADMIN TAB: LOGS ===== */}
          {adminTab === 'logs' && (
            <div className="space-y-4">
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <h3 className="font-bold text-sm flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-[#D4AF37]" /> সিস্টেম কার্যক্রম লগ</h3>
                <div className={`p-4 rounded-xl font-mono text-[10px] space-y-2 max-h-[500px] overflow-y-auto ${isDark ? 'bg-[#0b140c] text-[#D4AF37]' : 'bg-gray-900 text-emerald-400'}`}>
                  {logs.map((log, i) => (
                    <div key={i} className="border-b border-white/5 pb-1">&gt; {log}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== ADMIN TAB: ADMIN MANAGEMENT ===== */}
          {adminTab === 'admins' && isSuperAdmin && (
            <div className="space-y-4">
              <FamilyCodeForm />
              {/* Super Admin Card */}
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <h3 className="font-bold text-sm flex items-center gap-2 mb-4"><Crown className="w-4 h-4 text-[#D4AF37]" /> সুপার অ্যাডমিন</h3>
                <div className={`p-4 rounded-xl border-2 border-[#D4AF37]/50 ${isDark ? 'bg-[#1d3d1f]' : 'bg-amber-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#1E3F20] flex items-center justify-center border-2 border-[#D4AF37]">
                      <Crown className="w-6 h-6 text-[#D4AF37]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">সুপার অ্যাডমিন</h4>
                      <p className="text-[10px] text-[#D4AF37]">সম্পূর্ণ নিয়ন্ত্রণ • A-Z সকল অ্যাক্সেস</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assistant Admins */}
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm flex items-center gap-2"><UserCog className="w-4 h-4 text-[#D4AF37]" /> সহকারী অ্যাডমিন তালিকা</h3>
                  <button onClick={() => setIsAddingAdmin(true)} className="bg-[#D4AF37] text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#b5942d] transition">
                    <Plus className="w-4 h-4" /> সহকারী যোগ
                  </button>
                </div>

                {assistantAdmins.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <UserCog className="w-12 h-12 mx-auto mb-3" />
                    <p className="font-bold">কোনো সহকারী অ্যাডমিন নেই</p>
                    <p className="text-xs mt-1">নতুন সহকারী অ্যাডমিন যোগ করতে উপরের বাটনে ক্লিক করুন।</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assistantAdmins.map(admin => (
                      <div key={admin.id} className={`p-4 rounded-xl border ${isDark ? 'bg-[#1d3d1f] border-white/5' : 'bg-gray-50 border-gray-100'} flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1E3F20] flex items-center justify-center border border-[#D4AF37]">
                            <UserCog className="w-5 h-5 text-[#D4AF37]" />
                          </div>
                          <div>
                            <h4 className="font-bold text-xs">{admin.name}</h4>
                            <p className="text-[10px] text-gray-400">{admin.email}</p>
                            <p className="text-[9px] text-[#D4AF37]">যোগ করেছেন: {formatDate(admin.createdAt)}</p>
                          </div>
                        </div>
                        <button onClick={() => handleRemoveAdmin(admin.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition" title="সরান">
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ===== MODALS ===== */}

        {/* View Member Modal */}
        {selectedMember && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedMember(null)}>
            <div className={`max-w-lg w-full rounded-3xl overflow-hidden border ${theme.card} shadow-2xl`} onClick={e => e.stopPropagation()}>
              <div className="relative h-32 bg-cover bg-center" style={{ backgroundImage: `url(${selectedMember.cover})` }}>
                <div className="absolute inset-0 bg-black/30" />
                <button onClick={() => setSelectedMember(null)} className="absolute top-3 right-3 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 -mt-12 relative">
                <img src={selectedMember.avatar} alt={selectedMember.name} className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-[#1E3F20] shadow-xl" />
                <h3 className="text-lg font-extrabold mt-3">{selectedMember.name}</h3>
                <span className="inline-block bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[10px] px-3 py-1 rounded-full mt-1">
                  {selectedMember.isDeceased ? 'মরহুম পূর্বপুরুষ' : selectedMember.role}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic leading-relaxed">{selectedMember.bio || 'জীবনী পাওয়া যায়নি।'}</p>
                {!selectedMember.isDeceased && (
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <InfoRow icon={<Calendar className="w-3.5 h-3.5 text-emerald-500" />} label="জন্ম" value={(knownDob(selectedMember) ? formatDate(selectedMember.dob) : '—')} />
                    <InfoRow icon={<MapPin className="w-3.5 h-3.5 text-emerald-500" />} label="স্থান" value={knownPob(selectedMember) || '—'} />
                    <InfoRow icon={<Briefcase className="w-3.5 h-3.5 text-emerald-500" />} label="পেশা" value={selectedMember.profession || '-'} />
                    <InfoRow icon={<GraduationCap className="w-3.5 h-3.5 text-emerald-500" />} label="শিক্ষা" value={selectedMember.education || '-'} />
                    <InfoRow icon={<Phone className="w-3.5 h-3.5 text-emerald-500" />} label="মোবাইল" value={selectedMember.phone || 'গোপন'} />
                    <InfoRow icon={<Map className="w-3.5 h-3.5 text-emerald-500" />} label="ঠিকানা" value={selectedMember.address || '-'} />
                  </div>
                )}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-black/20 rounded-xl text-[11px] space-y-1 border">
                  <p>👪 <strong>পিতা:</strong> {members.find(m => m.id === selectedMember.fatherId)?.name || 'অনির্ধারিত'}</p>
                  <p>👩 <strong>মাতা:</strong> {members.find(m => m.id === selectedMember.motherId)?.name || 'অনির্ধারিত'}</p>
                  <p>💍 <strong>সঙ্গী:</strong> {members.find(m => m.id === selectedMember.spouseId)?.name || 'অনির্ধারিত'}</p>
                  {selectedMember.marriageDate && <p>💒 <strong>বিবাহ:</strong> {formatDate(selectedMember.marriageDate)}</p>}
                </div>
                <MemberLinks member={selectedMember} gallery={gallery} events={events} members={members} />
                {!selectedMember.isDeceased && <ContactButtons phone={selectedMember.phone} />}
              </div>
            </div>
          </div>
        )}

        {/* Edit Member Modal */}
        {isEditingMember && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsEditingMember(null)}>
            <form onSubmit={handleUpdateMember} className={`max-w-xl w-full p-6 rounded-3xl border text-xs space-y-4 max-h-[90vh] overflow-y-auto ${theme.card} shadow-2xl`} onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold border-b pb-3 border-gray-100 dark:border-white/5">✏️ সদস্য প্রোফাইল সম্পাদনা</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">পূর্ণ নাম</label>
                  <input required name="name" type="text" defaultValue={isEditingMember.name} className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">ভূমিকা</label>
                  <select name="role" defaultValue={isEditingMember.role} className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`}>
                    <option value="Father">পিতা / কাকা</option>
                    <option value="Mother">মাতা / কাকিমা</option>
                    <option value="Child">সন্তান / সদস্য</option>
                    <option value="Dada">দাদা</option>
                    <option value="Dadi">দাদী</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" name="isDeceased" defaultChecked={!!isEditingMember.isDeceased} /> মরহুম / মরহুমা</label>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">মৃত্যুর তারিখ</label>
                      <input name="deathDate" type="date" defaultValue={isEditingMember.deathDate || ''} className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">কবরের স্থান</label>
                      <input name="burialPlace" type="text" defaultValue={isEditingMember.burialPlace || ''} className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">লিঙ্গ</label>
                      <select name="gender" defaultValue={isEditingMember.gender || ''} className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`}>
                        <option value="">বেছে নিন</option>
                        <option value="male">ছেলে / পুরুষ</option>
                        <option value="female">মেয়ে / নারী</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">বিবাহের তারিখ</label>
                      <input name="marriageDate" type="date" defaultValue={isEditingMember.marriageDate || ''} className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                    </div>
                  </div>
                  <BioFields m={isEditingMember} cls={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} known={knownBio} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">পেশা</label>
                  <input name="profession" type="text" defaultValue={isEditingMember.profession} className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">শিক্ষা</label>
                  <input name="education" type="text" defaultValue={isEditingMember.education} className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">জন্ম তারিখ</label>
                  <input name="dob" type="date" defaultValue={knownDob(isEditingMember) || ''} className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">মোবাইল</label>
                  <input name="phone" type="text" defaultValue={isEditingMember.phone} className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] text-gray-400 uppercase mb-1">পিতা</label>
                  <select name="fatherId" defaultValue={isEditingMember.fatherId} className={`w-full text-[11px] border rounded-lg p-2 bg-transparent ${theme.input}`}>
                    <option value="">অনির্ধারিত</option>
                    {members.filter(m => m.id !== isEditingMember.id).map(m => <option key={m.id} value={m.id} className="text-black">{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] text-gray-400 uppercase mb-1">মাতা</label>
                  <select name="motherId" defaultValue={isEditingMember.motherId} className={`w-full text-[11px] border rounded-lg p-2 bg-transparent ${theme.input}`}>
                    <option value="">অনির্ধারিত</option>
                    {members.filter(m => m.id !== isEditingMember.id).map(m => <option key={m.id} value={m.id} className="text-black">{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] text-gray-400 uppercase mb-1">সঙ্গী</label>
                  <select name="spouseId" defaultValue={isEditingMember.spouseId} className={`w-full text-[11px] border rounded-lg p-2 bg-transparent ${theme.input}`}>
                    <option value="">অনির্ধারিত</option>
                    {members.filter(m => m.id !== isEditingMember.id).map(m => <option key={m.id} value={m.id} className="text-black">{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center gap-1"><Camera className="w-3.5 h-3.5 text-[#D4AF37]" /> প্রোফাইল ছবি</label>
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(e, setTempAvatar)} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#D4AF37]/20 file:text-[#D4AF37]" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5 text-[#D4AF37]" /> কভার ছবি</label>
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(e, setTempCover)} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#D4AF37]/20 file:text-[#D4AF37]" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#D4AF37] text-black font-extrabold p-3 rounded-xl hover:bg-[#c29f2e] transition flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> আপডেট করুন
                </button>
                <button type="button" onClick={() => setIsEditingMember(null)} className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-500 p-3 rounded-xl hover:bg-gray-200 transition">
                  বাতিল
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Add Event Modal */}
        {isAddingEvent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsAddingEvent(false)}>
            <form onSubmit={handleAddEvent} className={`max-w-md w-full p-6 rounded-3xl border text-xs space-y-4 ${theme.card} shadow-2xl`} onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold border-b pb-3 border-gray-100 dark:border-white/5">📅 নতুন ইভেন্ট যোগ করুন</h3>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">শিরোনাম</label>
                <input required name="title" type="text" placeholder="ইভেন্টের নাম" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">তারিখ</label>
                  <input required name="date" type="date" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">ক্যাটাগরি</label>
                  <select name="category" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`}>
                    <option value="Milestone">মাইলস্টোন</option>
                    <option value="Celebration">উৎসব</option>
                    <option value="Academic">শিক্ষা</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">আইকন (ইমোজি)</label>
                <input name="icon" type="text" placeholder="🎉" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">বিবরণ</label>
                <textarea required name="description" rows="3" placeholder="বিস্তারিত লিখুন..." className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" name="pinned" /> হোম পেজে ঘোষণা হিসেবে দেখান</label>
              <MemberMultiSelect members={members} />
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#D4AF37] text-black font-extrabold p-3 rounded-xl hover:bg-[#b09029] transition">যোগ করুন</button>
                <button type="button" onClick={() => setIsAddingEvent(false)} className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-500 p-3 rounded-xl hover:bg-gray-200 transition">বাতিল</button>
              </div>
            </form>
          </div>
        )}

        {/* Add Media Modal */}
        {isAddingMedia && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsAddingMedia(false)}>
            <form onSubmit={handleAddMedia} className={`max-w-md w-full p-6 rounded-3xl border text-xs space-y-4 ${theme.card} shadow-2xl`} onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold border-b pb-3 border-gray-100 dark:border-white/5">🖼️ গ্যালারিতে ছবি আপলোড</h3>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">শিরোনাম</label>
                <input required name="title" type="text" placeholder="ছবির নাম" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">তারিখ</label>
                  <input required name="date" type="date" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">ধরণ</label>
                  <select name="type" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`}>
                    <option value="image">📸 ছবি</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">ছবি ফাইল</label>
                <input required type="file" accept="image/*" onChange={e => handleImageUpload(e, setTempMediaFile)} className={`w-full border rounded-xl p-2 bg-transparent text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#D4AF37]/20 file:text-[#D4AF37]`} />
                {tempMediaFile && <p className="text-[10px] text-emerald-500 mt-1">✓ প্রস্তুত</p>}
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">বিবরণ</label>
                <textarea name="description" rows="2" placeholder="..." className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">ঈদের ছবি? (ঈদের ফিতায় যাবে)</label>
                <select name="eid" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`}>
                  <option value="">না</option>
                  <option value="fitr">🌙 ঈদুল ফিতর</option>
                  <option value="adha">🐑 ঈদুল আযহা</option>
                </select>
              </div>
              <MemberMultiSelect members={members} label="ছবিতে কারা আছেন" />
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#D4AF37] text-black font-extrabold p-3 rounded-xl hover:bg-[#b09029] transition">আপলোড</button>
                <button type="button" onClick={() => { setIsAddingMedia(false); setTempMediaFile(''); }} className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-500 p-3 rounded-xl hover:bg-gray-200 transition">বাতিল</button>
              </div>
            </form>
          </div>
        )}

        {/* Add Assistant Admin Modal */}
        {isAddingAdmin && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsAddingAdmin(false)}>
            <form onSubmit={handleAddAdmin} className={`max-w-md w-full p-6 rounded-3xl border text-xs space-y-4 ${theme.card} shadow-2xl`} onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold border-b pb-3 border-gray-100 dark:border-white/5">👤 নতুন সহকারী অ্যাডমিন যোগ করুন</h3>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">পূর্ণ নাম</label>
                <input required name="adminName" type="text" placeholder="যেমন: কামাল হোসেন" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">ইমেইল ঠিকানা</label>
                <input required name="adminEmail" type="email" placeholder="example@email.com" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">পাসওয়ার্ড</label>
                <input required name="adminPassword" type="password" minLength={8} placeholder="••••••••" className={`w-full border rounded-xl p-3 bg-transparent ${theme.input}`} />
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  সহকারী অ্যাডমিন পেন্ডিং মেম্বার যোগ করতে পারবে এবং কিছু সীমিত অ্যাক্সেস পাবে। সম্পূর্ণ নিয়ন্ত্রণ থাকবে না।
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#D4AF37] text-black font-extrabold p-3 rounded-xl hover:bg-[#b09029] transition">যোগ করুন</button>
                <button type="button" onClick={() => setIsAddingAdmin(false)} className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-500 p-3 rounded-xl hover:bg-gray-200 transition">বাতিল</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: MEMBER PORTAL (authenticated member)
  // ==========================================
  return (
    <div className={`min-h-screen overflow-x-hidden flex flex-col ${theme.bg} ${theme.text} transition-colors duration-300`}>

      {/* Alert */}
      {customAlert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-3 transition-all duration-300 ${customAlert.type === 'error' ? 'bg-red-100 border-red-300 text-red-800' : customAlert.type === 'info' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-emerald-100 border-emerald-300 text-emerald-800'}`}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{customAlert.message}</span>
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-[#1E3F20] text-white border-b border-[#D4AF37] px-4 lg:px-6 py-3 flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full border border-[#D4AF37] bg-white/10 flex items-center justify-center text-lg">🌳</div>
            <div>
              <h1 className="text-sm font-bold">{archiveTitle}</h1>
              <p className="text-[9px] text-[#D4AF37] font-semibold tracking-wide">আমাদের শেকড় • আমাদের অহংকার</p>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded-lg hover:bg-white/10">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop Nav */}
        <div className="hidden lg:flex flex-wrap items-center gap-1 bg-black/25 p-1 rounded-xl">
          {['dashboard', 'tree', 'directory', 'gallery', 'timeline', 'memorial', 'capsules', 'newsletter', 'eid', 'story', 'request'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${activeTab === tab ? 'bg-[#D4AF37] text-black shadow' : 'hover:bg-white/5'}`}>
              {tab === 'dashboard' && <><Home className="w-3.5 h-3.5" /> হোম</>}
              {tab === 'tree' && <><TreeDeciduous className="w-3.5 h-3.5" /> পারিবারিক গাছ</>}
              {tab === 'directory' && <><Users className="w-3.5 h-3.5" /> সদস্য তালিকা</>}
              {tab === 'gallery' && <><Image className="w-3.5 h-3.5" /> গ্যালারি</>}
              {tab === 'timeline' && <><Clock className="w-3.5 h-3.5" /> টাইমলাইন</>}
              {tab === 'memorial' && <>🕯️ স্মরণ</>}
              {tab === 'capsules' && <>⏳ টাইম ক্যাপসুল</>}
              {tab === 'newsletter' && <>📰 পত্রিকা</>}
              {tab === 'eid' && <>🌙 ঈদের ফিতা</>}
              {tab === 'story' && <>📖 জীবনী</>}
              {tab === 'request' && <>✉️ তথ্য পাঠান</>}
            </button>
          ))}
        </div>

        {/* User Badge */}
        <div className="hidden lg:flex items-center gap-3">
          <button onClick={() => setThemeMode(isDark ? 'light' : 'dark')} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#D4AF37]" title="থিম পরিবর্তন">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2 bg-black/20 p-1.5 pr-3 rounded-2xl border border-white/10">
            <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow">{currentUser?.name?.substring(0, 1)}</div>
            <div className="text-left text-[10px]">
              <p className="font-bold leading-tight max-w-[100px] truncate">{currentUser?.name}</p>
              <p className="text-[#D4AF37] font-semibold">{familyLabel}</p>
            </div>
            <button onClick={handleSignOut} className="p-1 rounded-lg hover:bg-red-500/10 text-red-400" title="লগআউট">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div className={`fixed right-0 top-0 bottom-0 z-50 w-64 max-w-[80vw] ${theme.nav} text-white p-4 pt-16 space-y-1 overflow-y-auto shadow-2xl`} onClick={e => e.stopPropagation()}>
            {['dashboard', 'tree', 'directory', 'gallery', 'timeline', 'memorial', 'capsules', 'newsletter', 'eid', 'story', 'request'].map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${activeTab === tab ? 'bg-[#D4AF37] text-black' : 'hover:bg-white/10'}`}>
                {tab === 'dashboard' && <><Home className="w-4 h-4" /> হোম ড্যাশবোর্ড</>}
                {tab === 'tree' && <><TreeDeciduous className="w-4 h-4" /> পারিবারিক গাছ</>}
                {tab === 'directory' && <><Users className="w-4 h-4" /> সদস্য তালিকা</>}
                {tab === 'gallery' && <><Image className="w-4 h-4" /> গ্যালারি</>}
                {tab === 'timeline' && <><Clock className="w-4 h-4" /> টাইমলাইন</>}
                {tab === 'memorial' && <>🕯️ স্মরণ</>}
                {tab === 'capsules' && <>⏳ টাইম ক্যাপসুল</>}
                {tab === 'newsletter' && <>📰 পত্রিকা</>}
                {tab === 'eid' && <>🌙 ঈদের ফিতা</>}
                {tab === 'story' && <>📖 জীবনী</>}
                {tab === 'request' && <>✉️ তথ্য পাঠান</>}
              </button>
            ))}
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs font-bold px-4 py-2 text-[#D4AF37]">{currentUser?.name}</p>
              <button onClick={() => { setThemeMode(isDark ? 'light' : 'dark'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/10 flex items-center gap-2">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} থিম পরিবর্তন
              </button>
              <button onClick={handleSignOut} className="w-full text-left px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 text-red-400 flex items-center gap-2">
                <LogOut className="w-4 h-4" /> লগআউট
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto space-y-6">

        {/* ===== DASHBOARD ===== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <CapsuleBanner onOpen={() => setActiveTab('capsules')} />
            <Announcements events={events} />
            <UpcomingPanel members={members} onSelect={setSelectedMember} />
            <StatsPanel members={members} />
            <div className="flex justify-end"><InstallButton /></div>
            {/* Hero Banner */}
            <div className="bg-gradient-to-r from-[#1E3F20] to-[#0b140c] text-white p-6 lg:p-8 rounded-3xl relative overflow-hidden border-2 border-[#D4AF37]/40 shadow-xl">
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none text-[8rem] lg:text-[12rem]">🌳</div>
              <div className="max-w-2xl space-y-3 relative z-10">
                <span className="bg-[#D4AF37] text-black font-extrabold text-[9px] lg:text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">ডিজিটাল পারিবারিক সংগ্রহশালা</span>
                <h2 className="text-xl lg:text-3xl font-bold tracking-tight">আপনার শিকড়কে জানুন, ঐতিহ্যকে বাঁচিয়ে রাখুন</h2>
                <p className="text-xs lg:text-sm text-gray-300 leading-relaxed">{rootCouple.names ? `শ্রদ্ধেয় ${rootCouple.names}-এর` : 'আপনার'} পরিবারের প্রতিটি স্মৃতি, ইতিহাস এবং অবদানের এক বিশ্বস্ত আর্কাইভ।</p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button onClick={() => setActiveTab('tree')} className="bg-[#D4AF37] hover:bg-[#b8952d] text-black font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 transition">
                    🌲 পারিবারিক গাছ <ArrowRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => setActiveTab('gallery')} className="bg-white/10 hover:bg-white/15 text-white font-bold text-xs px-4 py-2 rounded-xl border border-white/20 flex items-center gap-2 transition">
                    📸 স্মৃতি গ্যালারি
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <StatCard icon={Users} label="মোট সদস্য" value={`${members.length} জন`} color="text-emerald-500" bg="bg-emerald-100 dark:bg-emerald-950/40" theme={theme} />
              <StatCard icon={Crown} label="পরম শিকড়" value={rootCouple.people[0] ? cleanName(rootCouple.people[0].name) : '—'} color="text-[#D4AF37]" bg="bg-amber-100 dark:bg-amber-950/40" theme={theme} isSmall />
              <StatCard icon={Calendar} label="মাইলস্টোন" value={`${events.length}টি`} color="text-blue-500" bg="bg-blue-100 dark:bg-blue-950/40" theme={theme} />
              <StatCard icon={Image} label="স্মৃতিচিত্র" value={`${gallery.length}টি`} color="text-purple-500" bg="bg-purple-100 dark:bg-purple-950/40" theme={theme} />
            </div>

            {/* Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Timeline Preview */}
              <div className={`lg:col-span-2 p-5 rounded-2xl border ${theme.card}`}>
                <div className="flex items-center justify-between mb-4 border-b pb-3 dark:border-white/5">
                  <h3 className="font-bold text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-[#D4AF37]" /> পারিবারিক সোনালী ইতিহাস</h3>
                  <button onClick={() => setActiveTab('timeline')} className="text-xs text-emerald-600 font-bold hover:underline">সকল ঘটনা →</button>
                </div>
                <div className="space-y-3">
                  {events.slice(0, 3).map(ev => (
                    <div key={ev.id} className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition border border-transparent hover:border-gray-100 dark:hover:border-white/10">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-lg flex-shrink-0">{ev.icon}</div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-xs">{ev.title}</h4>
                          <span className="bg-amber-100 dark:bg-amber-950/50 text-[#D4AF37] text-[9px] font-bold px-2 py-0.5 rounded-full">{formatDate(ev.date)}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{ev.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grandparents Memorial */}
              {rootCouple.people.some(m => m.isDeceased) && (
              <div className={`p-5 rounded-2xl border ${theme.card}`}>
                <h3 className="font-bold text-sm flex items-center gap-2 mb-4 border-b pb-3 dark:border-white/5">🕊️ চিরস্মরণীয় অভিভাবক</h3>
                <div className="space-y-3">
                  {rootCouple.people.filter(m => m.isDeceased).map(m => (
                    <div key={m.id} onClick={() => setSelectedMember(m)} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 cursor-pointer transition">
                      <img src={m.avatar} alt={m.name} className="w-10 h-10 rounded-full object-cover border-2 border-[#D4AF37]" />
                      <div className="text-xs flex-1">
                        <h4 className="font-bold text-amber-800 dark:text-[#D4AF37]">{m.name}</h4>
                        <p className="text-[10px] text-gray-500 italic truncate">{m.bio}</p>
                      </div>
                      <span className="text-[9px] bg-amber-500/20 text-[#D4AF37] px-2 py-0.5 rounded-full font-bold">মরহুম</span>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>
          </div>
        )}

        {/* ===== FAMILY TREE ===== */}
        {activeTab === 'tree' && (
          <div className={`p-4 lg:p-6 rounded-2xl border ${theme.card}`}>
            <div className="border-b pb-4 mb-6 text-center">
              <h2 className="text-lg font-bold flex items-center justify-center gap-2">🌲 আমাদের পারিবারিক বৃক্ষ</h2>
              <p className="text-xs text-gray-400 mt-1">দম্পতি ও তাঁদের সন্তান, তারপর সন্তানের দম্পতি ও তাঁদের সন্তান, এভাবে প্রজন্মের পর প্রজন্ম।</p>
            </div>
            <div className="mb-4 print:hidden"><RelationTool members={members} /></div>
            <div className="mb-4 print:hidden">
              <PerspectiveBar members={members} viewerId={perspective.viewerId} setViewerId={perspective.setViewerId} directOnly={perspective.directOnly} setDirectOnly={perspective.setDirectOnly} />
            </div>
            <PerspectiveContext.Provider value={perspective.value}>
              <TreeErrorBoundary members={members} onSelect={setSelectedMember}>
                <FamilyTree members={members} onSelect={setSelectedMember} />
              </TreeErrorBoundary>
            </PerspectiveContext.Provider>
          </div>
        )}

        {/* ===== DIRECTORY ===== */}
        {activeTab === 'directory' && (
          <div className={`p-4 lg:p-6 rounded-2xl border ${theme.card}`}>
            <div className="mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">📇 পারিবারিক সদস্য তালিকা</h2>
              <p className="text-xs text-gray-400 mt-1">পরিবারের সকল সদস্যদের খোঁজখবর এক জায়গায়।</p>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="নাম, পেশা বা জেলা লিখে খুঁজুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`w-full text-xs pl-10 pr-4 py-3 rounded-xl bg-transparent border ${theme.input}`} />
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <select value={dirStatus} onChange={e => setDirStatus(e.target.value)} className={`text-xs border rounded-xl p-2 bg-transparent ${theme.input}`}>
                <option value="all">সবাই</option>
                <option value="alive">জীবিত</option>
                <option value="deceased">মরহুম</option>
              </select>
              <select value={dirSort} onChange={e => setDirSort(e.target.value)} className={`text-xs border rounded-xl p-2 bg-transparent ${theme.input}`}>
                <option value="none">সাজানো: ডিফল্ট</option>
                <option value="name">নাম অনুযায়ী</option>
                <option value="age">বড় থেকে ছোট (বয়স)</option>
              </select>
              <span className="text-[11px] text-gray-400 self-center">{filteredMembers.length} জন</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map(m => (
                <div key={m.id} className={`relative rounded-2xl overflow-hidden border transition-all hover:scale-[1.02] ${isDark ? 'bg-[#1d3d1f] border-white/5' : 'bg-white border-gray-100 shadow-md'}`}>
                  <div className="h-16 w-full bg-cover bg-center" style={{ backgroundImage: `url(${m.cover})` }}><div className="w-full h-full bg-black/20" /></div>
                  <div className="p-4 pt-0 -mt-7 flex flex-col items-center text-center">
                    <img src={m.avatar} alt={m.name} className="w-14 h-14 rounded-full object-cover border-4 border-white dark:border-[#1E3F20] shadow-lg mb-2" />
                    <h3 className="font-bold text-sm">{m.name}</h3>
                    <p className="text-[10px] text-[#D4AF37] font-semibold">{m.isDeceased ? 'স্মরণীয় পূর্বপুরুষ' : m.role}</p>
                    {!m.isDeceased && (
                      <>
                        <div className="flex items-center gap-1 text-gray-400 text-[10px] mt-2"><Briefcase className="w-3 h-3" /><span>{m.profession || 'পেশা অনির্ধারিত'}</span></div>
                        <div className="flex items-center gap-1 text-gray-400 text-[10px] mt-1"><MapPin className="w-3 h-3" /><span>{knownPob(m) || '—'}</span></div>
                      </>
                    )}
                    <button onClick={() => setSelectedMember(m)} className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition">
                      <Eye className="w-3.5 h-3.5" /> বিস্তারিত
                    </button>
                  </div>
                </div>
              ))}
              {filteredMembers.length === 0 && <div className="col-span-full text-center py-8 text-gray-400">🔍 কোনো সদস্য খুঁজে পাওয়া যায়নি।</div>}
            </div>
          </div>
        )}

        {/* ===== GALLERY ===== */}
        {activeTab === 'gallery' && (
          <div className={`p-4 lg:p-6 rounded-2xl border ${theme.card}`}>
            <div className="mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">🖼️ পারিবারিক স্মৃতি গ্যালারি</h2>
              <p className="text-xs text-gray-400 mt-1">পারিবারিক মিলনমেলা ও সুন্দর মুহূর্তগুলোর সংগ্রহ।</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gallery.map(item => (
                <div key={item.id} className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-[#1d3d1f] border-white/5' : 'bg-white border-gray-100 shadow-md'}`}>
                  <div className="relative aspect-video bg-black/10">
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 bg-[#1E3F20]/80 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full">📸 ছবি{item.eid ? ' · 🌙 ঈদ' : ''}</span>
                  </div>
                  <div className="p-4 space-y-1">
                    <h3 className="font-bold text-xs">{item.title}</h3>
                    <p className="text-[9px] text-gray-400">{item.date}</p>
                    <p className="text-[11px] text-gray-500">{item.description}</p>
                     <TaggedMembers ids={item.memberIds} members={members} onSelect={setSelectedMember} />
                  </div>
                </div>
              ))}
              {gallery.length === 0 && <div className="col-span-full text-center py-8 text-gray-400">🖼️ কোনো ছবি নেই।</div>}
            </div>
          </div>
        )}

        {/* ===== TIMELINE ===== */}
        {activeTab === 'memorial' && (
          <div className={`p-4 lg:p-6 rounded-2xl border ${theme.card}`}>
            <MemorialPage members={members} onSelect={setSelectedMember} defaultName={currentUser?.name} />
          </div>
        )}

        {activeTab === 'capsules' && (
          <div className={`p-4 lg:p-6 rounded-2xl border ${theme.card}`}>
            <CapsulePage members={members} isAdmin={isAdmin} defaultName={currentUser?.name} />
          </div>
        )}

        {activeTab === 'newsletter' && (
          <div className={`p-4 lg:p-6 rounded-2xl border ${theme.card}`}>
            <NewsletterPage members={members} events={events} gallery={gallery} isSuperAdmin={isSuperAdmin} title={archiveTitle} familyLabel={familyLabel} />
          </div>
        )}

        {activeTab === 'eid' && (
          <div className={`p-4 lg:p-6 rounded-2xl border ${theme.card}`}>
            <EidStrip gallery={gallery} members={members} setGallery={setGallery} isAdmin={isAdmin} />
          </div>
        )}

        {activeTab === 'story' && (
          <div className={`p-4 lg:p-6 rounded-2xl border ${theme.card}`}>
            <LifeBook members={members} gallery={gallery} events={events} onOpenMember={setSelectedMember} />
          </div>
        )}

        {activeTab === 'request' && (
          <div className={`p-4 lg:p-6 rounded-2xl border ${theme.card}`}>
            <h2 className="text-lg font-bold mb-4">✉️ নতুন সদস্যের তথ্য পাঠান</h2>
            <RequestForm members={members} />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className={`p-4 lg:p-6 rounded-2xl border ${theme.card}`}>
            <div className="mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">📜 পারিবারিক মাইলস্টোন ও টাইমলাইন</h2>
              <p className="text-xs text-gray-400 mt-1">পারিবারিক অর্জন, উৎসব এবং সুন্দর মুহূর্তের বিবরণ।</p>
            </div>
            <div className="relative border-l-2 border-[#D4AF37]/40 pl-6 ml-4 space-y-8">
              {events.map(ev => (
                <div key={ev.id} className="relative">
                  <span className="absolute -left-[35px] top-1.5 w-4 h-4 rounded-full bg-[#D4AF37] border-4 border-white dark:border-[#1E3F20] shadow" />
                  <div className={`p-4 lg:p-5 rounded-2xl border ${isDark ? 'bg-black/15 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{ev.icon}</span>
                        <h3 className="font-bold text-sm">{ev.title}</h3>
                      </div>
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-xl font-bold">{formatDate(ev.date)}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{ev.description}</p>
                     <TaggedMembers ids={ev.memberIds} members={members} onSelect={setSelectedMember} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ===== MEMBER VIEW MODAL ===== */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedMember(null)}>
          <div className={`max-w-lg w-full rounded-3xl overflow-hidden border ${theme.card} shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className="relative h-32 bg-cover bg-center" style={{ backgroundImage: `url(${selectedMember.cover})` }}>
              <div className="absolute inset-0 bg-black/30" />
              <button onClick={() => setSelectedMember(null)} className="absolute top-3 right-3 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 -mt-12 relative">
              <img src={selectedMember.avatar} alt={selectedMember.name} className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-[#1E3F20] shadow-xl" />
              <h3 className="text-lg font-extrabold mt-3">{selectedMember.name}</h3>
              <span className="inline-block bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[10px] px-3 py-1 rounded-full mt-1">
                {selectedMember.isDeceased ? 'মরহুম পূর্বপুরুষ' : selectedMember.role}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic leading-relaxed">{selectedMember.bio || 'জীবনী পাওয়া যায়নি।'}</p>
              {!selectedMember.isDeceased && (
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <InfoRow icon={<Calendar className="w-3.5 h-3.5 text-emerald-500" />} label="জন্ম" value={(knownDob(selectedMember) ? formatDate(selectedMember.dob) : '—')} />
                  <InfoRow icon={<MapPin className="w-3.5 h-3.5 text-emerald-500" />} label="স্থান" value={knownPob(selectedMember) || '—'} />
                  <InfoRow icon={<Briefcase className="w-3.5 h-3.5 text-emerald-500" />} label="পেশা" value={selectedMember.profession || '-'} />
                  <InfoRow icon={<GraduationCap className="w-3.5 h-3.5 text-emerald-500" />} label="শিক্ষা" value={selectedMember.education || '-'} />
                  <InfoRow icon={<Phone className="w-3.5 h-3.5 text-emerald-500" />} label="মোবাইল" value={selectedMember.phone || 'গোপন'} />
                  <InfoRow icon={<Map className="w-3.5 h-3.5 text-emerald-500" />} label="ঠিকানা" value={selectedMember.address || '-'} />
                </div>
              )}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-black/20 rounded-xl text-[11px] space-y-1 border">
                <p>👪 <strong>পিতা:</strong> {members.find(m => m.id === selectedMember.fatherId)?.name || 'অনির্ধারিত'}</p>
                <p>👩 <strong>মাতা:</strong> {members.find(m => m.id === selectedMember.motherId)?.name || 'অনির্ধারিত'}</p>
                <p>💍 <strong>সঙ্গী:</strong> {members.find(m => m.id === selectedMember.spouseId)?.name || 'অনির্ধারিত'}</p>
                {selectedMember.marriageDate && <p>💒 <strong>বিবাহ:</strong> {formatDate(selectedMember.marriageDate)}</p>}
                {selectedMember.isDeceased && selectedMember.burialPlace && <p>⚰️ <strong>কবরের স্থান:</strong> {selectedMember.burialPlace}</p>}
              </div>
              <MemberLinks member={selectedMember} gallery={gallery} events={events} members={members} />
              {!selectedMember.isDeceased && <ContactButtons phone={selectedMember.phone} />}
              {!isAdmin && members.some(m => m.id === selectedMember.id) && <CorrectionForm member={selectedMember} />}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#1E3F20] text-gray-400 text-center py-4 border-t border-[#D4AF37] text-[10px] font-bold space-y-1">
        <p>🛡️ {archiveTitle} &copy; ২০২৬ | সর্বস্বত্ব সংরক্ষিত</p>
        <p className="text-[#D4AF37]">ডিজিটাল কূলবৃক্ষ এবং প্রজন্মের স্মৃতি সংরক্ষণের একমাত্র বিশ্বস্ত পোর্টাল</p>
      <p className="opacity-60 font-normal">সংস্করণ ২৮ নভেম্বর · ৬</p>
        </footer>
    </div>
  );
}

// ==========================================
// SMALL COMPONENTS
// ==========================================
function StatCard({ icon: Icon, label, value, color, bg, theme, isSmall }) {
  return (
    <div className={`p-4 lg:p-5 rounded-2xl border transition-all ${theme.card}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[9px] lg:text-[10px] text-gray-400 font-bold uppercase">{label}</p>
          <h3 className={`${isSmall ? 'text-sm' : 'text-xl lg:text-2xl'} font-black mt-1 ${color}`}>{value}</h3>
        </div>
        <span className={`text-lg p-2 ${bg} rounded-xl`}><Icon className={`w-5 h-5 ${color}`} /></span>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <p className="flex items-center gap-1.5">
      {icon}
      <span><strong>{label}:</strong> {value}</span>
    </p>
  );
}
