const DEFAULT_YAML_PATH = "../YAML/features.yaml";
const YAML_API_FILES_PATH = "/api/yaml-files";
const YAML_DIR_WEB_PATH = "../YAML/";
const POSITION_STORAGE_KEY = "yaml_feature_diagram_positions_v1";
const THEME_STORAGE_KEY = "yaml_feature_diagram_theme_v1";
const SORT_MODE_STORAGE_KEY = "yaml_feature_diagram_sort_mode_v1";
const VIEW_MODE_STORAGE_KEY = "yaml_feature_diagram_view_mode_v1";
const VIEWPORT_STORAGE_KEY = "yaml_feature_diagram_viewport_v1";
const CONTROLS_COLLAPSED_STORAGE_KEY = "yaml_feature_diagram_controls_collapsed_v1";
const CLUSTER_PALETTE = [
  "#2c7da0",
  "#a23b72",
  "#3a7d44",
  "#8a5a44",
  "#6f4a8e",
  "#b36a1c",
  "#1e6f5c",
  "#b24545",
  "#4c6faf",
  "#7a6f24"
];

let cy = null;

const statusEl = document.getElementById("status");
const yamlFileInput = document.getElementById("yamlFileInput");
const searchInput = document.getElementById("searchInput");
const showContainmentInput = document.getElementById("showContainmentInput");
const layoutBtn = document.getElementById("layoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const viewModeSelect = document.getElementById("viewModeSelect");
const sortModeSelect = document.getElementById("sortModeSelect");
const exportFormatEl = document.getElementById("exportFormat");
const exportBtn = document.getElementById("exportBtn");
const themeToggle = document.getElementById("themeToggle");
const controlsPanel = document.getElementById("controlsPanel");
const toggleControlsBtn = document.getElementById("toggleControlsBtn");
const sortHelpBtn = document.getElementById("sortHelpBtn");
const sortHelpModal = document.getElementById("sortHelpModal");
const sortHelpCloseBtn = document.getElementById("sortHelpCloseBtn");
const cyWrapEl = document.getElementById("cyWrap");
const editNodeBtn = document.getElementById("editNodeBtn");
const editorModal = document.getElementById("editorModal");
const editorSubtitle = document.getElementById("editorSubtitle");
const editorInput = document.getElementById("editorInput");
const editorSaveBtn = document.getElementById("editorSaveBtn");
const editorCancelBtn = document.getElementById("editorCancelBtn");

let currentYamlDoc = null;
let currentYamlSource = DEFAULT_YAML_PATH;
let selectedNodeId = "";
const EDIT_BUTTON_SIZE = 30;
let focusedNodeId = "";
let cleanupMouseWheelZoom = null;
let pendingViewportRestore = false;
let viewportSaveTimer = null;
const ORDER_TAG_WEIGHT = {
  first: 0,
  early: 0,
  beginning: 0,
  start: 0,
  second: 1,
  third: 2,
  fourth: 3,
  premier: 0,
  premiere: 0,
  premieres: 0,
  deuxieme: 1,
  troisieme: 2,
  quatrieme: 3,
  debut: 0,
  erste: 0,
  erster: 0,
  erstes: 0,
  zweite: 1,
  drittes: 2,
  dritte: 2,
  primo: 0,
  prima: 0,
  secondo: 1,
  terzo: 2,
  medium: 500,
  middle: 500,
  mid: 500,
  moyen: 500,
  moyenne: 500,
  milieu: 500,
  mittel: 500,
  mitte: 500,
  medio: 500,
  media: 500,
  latest: 1000,
  last: 1000,
  newest: 1000,
  recent: 1000,
  most_recent: 1000,
  dernier: 1000,
  derniere: 1000,
  plus_recent: 1000,
  plus_recente: 1000,
  final: 1000,
  finale: 1000,
  neueste: 1000,
  letzter: 1000,
  letztes: 1000,
  zuletzt: 1000,
  ultimo: 1000,
  ultima: 1000,
  recente: 1000,
  piu_recente: 1000
};
const TEXT_COLLATOR = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

function normalizeOrderToken(token) {
  return String(token || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
    .trim();
}

function extractOrderTagValue(rawText) {
  const text = String(rawText || "").toLowerCase();
  const re = /\[([^\]]+)\]/g;
  let minValue = Number.POSITIVE_INFINITY;
  let match;
  while ((match = re.exec(text)) !== null) {
    const token = normalizeOrderToken(match[1]);
    if (!token) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(ORDER_TAG_WEIGHT, token)) {
      minValue = Math.min(minValue, ORDER_TAG_WEIGHT[token]);
      continue;
    }
    if (/^\d+$/.test(token)) {
      minValue = Math.min(minValue, Number.parseInt(token, 10));
    }
  }
  return Number.isFinite(minValue) ? minValue : null;
}

function displayTextForSort(node) {
  const label = String(node?.data?.("label") || "").trim();
  const id = String(node?.id?.() || "").trim();
  return label || id;
}

function compareByTextAsc(a, b) {
  return TEXT_COLLATOR.compare(displayTextForSort(a), displayTextForSort(b));
}

function compareByOrderTagsAsc(a, b) {
  const aRank = extractOrderTagValue(`${a.data("label")} ${a.id()}`);
  const bRank = extractOrderTagValue(`${b.data("label")} ${b.id()}`);
  if (aRank !== null || bRank !== null) {
    if (aRank === null) {
      return 1;
    }
    if (bRank === null) {
      return -1;
    }
    if (aRank !== bRank) {
      return aRank - bRank;
    }
  }
  return compareByTextAsc(a, b);
}

function compareByOrderTagsDesc(a, b) {
  return compareByOrderTagsAsc(b, a);
}

function compareNodesForLayout(a, b) {
  const mode = sortModeSelect?.value || "auto_tags_asc";
  if (mode === "alpha_asc") {
    return compareByTextAsc(a, b);
  }
  if (mode === "alpha_desc") {
    return compareByTextAsc(b, a);
  }
  if (mode === "tags_desc") {
    return compareByOrderTagsDesc(a, b);
  }
  return compareByOrderTagsAsc(a, b);
}

function restoreUiPreferences() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      themeToggle.checked = savedTheme === "dark";
    }

    const savedSort = localStorage.getItem(SORT_MODE_STORAGE_KEY);
    if (savedSort && sortModeSelect) {
      const exists = Array.from(sortModeSelect.options).some((opt) => opt.value === savedSort);
      if (exists) {
        sortModeSelect.value = savedSort;
      }
    }

    const savedViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (savedViewMode && viewModeSelect) {
      const exists = Array.from(viewModeSelect.options).some((opt) => opt.value === savedViewMode);
      if (exists) {
        viewModeSelect.value = savedViewMode;
      }
    }

    const savedCollapsed = localStorage.getItem(CONTROLS_COLLAPSED_STORAGE_KEY);
    if (savedCollapsed === "1") {
      setControlsCollapsed(true);
    } else if (savedCollapsed === "0") {
      setControlsCollapsed(false);
    }
  } catch (error) {
    console.warn("Restauration des preferences UI impossible.", error);
  }
}

function setControlsCollapsed(collapsed) {
  if (!controlsPanel || !toggleControlsBtn) {
    return;
  }
  controlsPanel.classList.toggle("is-collapsed", collapsed);
  document.documentElement.classList.toggle("controls-collapsed", collapsed);
  toggleControlsBtn.textContent = collapsed ? "▾" : "▴";
  toggleControlsBtn.setAttribute("aria-label", collapsed ? "Afficher le panneau" : "Replier le panneau");
  toggleControlsBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

function openSortHelpModal() {
  if (!sortHelpModal) {
    return;
  }
  sortHelpModal.classList.remove("hidden");
}

function closeSortHelpModal() {
  if (!sortHelpModal) {
    return;
  }
  sortHelpModal.classList.add("hidden");
}

function saveViewportState() {
  if (!cy) {
    return;
  }
  const zoom = cy.zoom();
  const pan = cy.pan();
  try {
    localStorage.setItem(
      VIEWPORT_STORAGE_KEY,
      JSON.stringify({
        zoom,
        pan: { x: pan.x, y: pan.y }
      })
    );
  } catch (error) {
    console.warn("Sauvegarde du viewport impossible.", error);
  }
}

function scheduleViewportSave() {
  if (viewportSaveTimer) {
    clearTimeout(viewportSaveTimer);
  }
  viewportSaveTimer = setTimeout(() => {
    viewportSaveTimer = null;
    saveViewportState();
  }, 120);
}

function restoreViewportState() {
  if (!cy) {
    return false;
  }
  try {
    const raw = localStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw);
    const zoom = Number(parsed?.zoom);
    const panX = Number(parsed?.pan?.x);
    const panY = Number(parsed?.pan?.y);
    if (!Number.isFinite(zoom) || !Number.isFinite(panX) || !Number.isFinite(panY)) {
      return false;
    }
    const clampedZoom = Math.max(cy.minZoom(), Math.min(cy.maxZoom(), zoom));
    cy.zoom(clampedZoom);
    cy.pan({ x: panX, y: panY });
    return true;
  } catch (error) {
    console.warn("Restauration du viewport impossible.", error);
    return false;
  }
}

function installMouseWheelZoom() {
  if (!cy) {
    return;
  }

  const container = cy.container();
  if (!container) {
    return;
  }

  const handler = (event) => {
    // Keep browser/system zoom gestures untouched.
    if (event.ctrlKey) {
      return;
    }

    const minZoom = cy.minZoom();
    const maxZoom = cy.maxZoom();
    const current = cy.zoom();
    const factor = Math.exp(-event.deltaY * 0.0015);
    const next = Math.max(minZoom, Math.min(maxZoom, current * factor));

    cy.zoom({
      level: next,
      renderedPosition: { x: event.offsetX, y: event.offsetY }
    });
    event.preventDefault();
    event.stopPropagation();
  };

  container.addEventListener("wheel", handler, { passive: false });
  cleanupMouseWheelZoom = () => {
    container.removeEventListener("wheel", handler);
  };
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#9b1c1c" : "";
}

function escapeForId(raw) {
  return String(raw).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function domainNodeId(domainId) {
  return `domain__${escapeForId(domainId)}`;
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hexToRgb(hex) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((v) => v + v).join("") : raw;
  const num = Number.parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function mixColor(hex, mixHex, weight = 0.2) {
  const c1 = hexToRgb(hex);
  const c2 = hexToRgb(mixHex);
  return rgbToHex(
    c1.r * (1 - weight) + c2.r * weight,
    c1.g * (1 - weight) + c2.g * weight,
    c1.b * (1 - weight) + c2.b * weight
  );
}

function getClusterBaseColor(clusterId) {
  const idx = hashString(String(clusterId || "default")) % CLUSTER_PALETTE.length;
  return CLUSTER_PALETTE[idx];
}

function getClusterThemeColor(clusterId, isDark) {
  const base = getClusterBaseColor(clusterId);
  return isDark ? mixColor(base, "#ffffff", 0.22) : mixColor(base, "#000000", 0.08);
}

function ensureNode(nodes, map, id, label, type, status = "unknown", domain = "") {
  if (map.has(id)) {
    return;
  }

  const node = {
    data: {
      id,
      label,
      type,
      status,
      domain
    }
  };

  nodes.push(node);
  map.set(id, node);
}

function buildGraphElements(doc) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();
  let containsEdgeCount = 0;
  let relationEdgeCount = 0;

  const domains = Array.isArray(doc.domains) ? doc.domains : [];
  const relationships = Array.isArray(doc.relationships) ? doc.relationships : [];

  for (const domain of domains) {
    const domainId = String(domain.id || domain.label || `domain_${nodes.length}`);
    const domainLabel = domain.label || domainId;
    const dNodeId = domainNodeId(domainId);

    ensureNode(nodes, nodeMap, dNodeId, domainLabel, "domain", domain.status || "unknown", domainId);

    const features = Array.isArray(domain.features) ? domain.features : [];
    for (const feature of features) {
      const featureId = String(feature.id || feature.label || `feature_${nodes.length}`);
      const featureLabel = feature.label || featureId;

      ensureNode(
        nodes,
        nodeMap,
        featureId,
        featureLabel,
        "feature",
        feature.status || "unknown",
        domainId
      );

      edges.push({
        data: {
          id: `contains__${containsEdgeCount++}`,
          source: dNodeId,
          target: featureId,
          relation: "contains",
          kind: "contains",
          cluster: domainId
        }
      });
    }
  }

  for (const rel of relationships) {
    const from = String(rel.from || "");
    const to = String(rel.to || "");
    const relationType = String(rel.type || "related_to");
    if (!from || !to) {
      continue;
    }

    ensureNode(nodes, nodeMap, from, from, "external", "unknown", "");
    ensureNode(nodes, nodeMap, to, to, "external", "unknown", "");
    const fromDomain = nodeMap.get(from)?.data?.domain || "";
    const toDomain = nodeMap.get(to)?.data?.domain || "";
    const clusterId = fromDomain || toDomain || "cross_domain";

    edges.push({
      data: {
        id: `relation__${relationEdgeCount++}`,
        source: from,
        target: to,
        relation: relationType,
        kind: "relation",
        cluster: clusterId
      }
    });
  }

  return { nodes, edges };
}

function applyContainmentVisibility() {
  if (!cy) {
    return;
  }

  const show = showContainmentInput.checked;
  cy.edges("[kind = 'contains']").style("display", show ? "element" : "none");
}

function applyClusterEdgeColors() {
  if (!cy) {
    return;
  }

  const isDark = themeToggle.checked;
  cy.edges().forEach((edge) => {
    const clusterId = edge.data("cluster") || "default";
    edge.data("lineColor", getClusterThemeColor(clusterId, isDark));
  });
}

function savePositions() {
  if (!cy) {
    return;
  }

  const pos = {};
  cy.nodes().forEach((node) => {
    pos[node.id()] = node.position();
  });

  localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
  setStatus("Positions sauvegardees dans le navigateur.");
}

function restorePositions() {
  if (!cy) {
    return false;
  }

  const raw = localStorage.getItem(POSITION_STORAGE_KEY);
  if (!raw) {
    return false;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }

  let applied = 0;
  cy.nodes().forEach((node) => {
    const p = parsed[node.id()];
    if (!p || typeof p.x !== "number" || typeof p.y !== "number") {
      return;
    }
    node.position(p);
    applied++;
  });

  return applied > 0;
}

function resetPositions() {
  localStorage.removeItem(POSITION_STORAGE_KEY);
  setStatus("Positions supprimees. Layout relance.");
  runLayout();
}

function boxesOverlap(a, b, padding = 0) {
  return !(
    a.x2 + padding < b.x1 ||
    a.x1 - padding > b.x2 ||
    a.y2 + padding < b.y1 ||
    a.y1 - padding > b.y2
  );
}

function resolveNodeOverlaps(maxIterations = 120, padding = 14) {
  if (!cy) {
    return;
  }

  const nodes = cy.nodes(":visible");
  if (nodes.length < 2) {
    return;
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let movedAny = false;

    cy.batch(() => {
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        if (n1.locked()) {
          continue;
        }

        const b1 = n1.boundingBox({ includeLabels: true });
        const c1x = (b1.x1 + b1.x2) / 2;
        const c1y = (b1.y1 + b1.y2) / 2;

        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          if (n2.locked()) {
            continue;
          }

          const b2 = n2.boundingBox({ includeLabels: true });
          if (!boxesOverlap(b1, b2, padding)) {
            continue;
          }

          const c2x = (b2.x1 + b2.x2) / 2;
          const c2y = (b2.y1 + b2.y2) / 2;
          let dx = c2x - c1x;
          let dy = c2y - c1y;

          // Prevent zero-length push vectors.
          if (dx === 0 && dy === 0) {
            dx = (Math.random() - 0.5) || 0.1;
            dy = (Math.random() - 0.5) || -0.1;
          }

          const overlapX = Math.min(b1.x2 - b2.x1, b2.x2 - b1.x1);
          const overlapY = Math.min(b1.y2 - b2.y1, b2.y2 - b1.y1);
          const push = Math.max(Math.min(overlapX, overlapY) + padding, 2);
          const length = Math.hypot(dx, dy) || 1;
          const ux = dx / length;
          const uy = dy / length;
          const shift = push / 2;

          const p1 = n1.position();
          const p2 = n2.position();
          n1.position({ x: p1.x - ux * shift, y: p1.y - uy * shift });
          n2.position({ x: p2.x + ux * shift, y: p2.y + uy * shift });
          movedAny = true;
        }
      }
    });

    if (!movedAny) {
      break;
    }
  }
}

function applyViewModeStyles() {
  if (!cy) {
    return;
  }

  const mode = viewModeSelect.value;
  const isHorizontalTree = mode === "tree_horizontal";
  const isFileTree = mode === "tree_file";
  const isAnyTree = isHorizontalTree || isFileTree;

  if (isAnyTree) {
    cy.nodes("[type = 'feature']").style({
      shape: "round-rectangle",
      "text-max-width": isFileTree ? 260 : 210,
      "font-size": 10
    });
    cy.nodes("[type = 'external']").style({
      shape: "round-rectangle",
      "text-max-width": isFileTree ? 230 : 190,
      "font-size": 9
    });

    cy.edges().style({
      "curve-style": "taxi",
      "taxi-direction": "rightward",
      "taxi-turn": isFileTree ? 18 : 24
    });
  } else {
    cy.nodes("[type = 'feature']").style({
      shape: "ellipse",
      "text-max-width": 150,
      "font-size": 10
    });
    cy.nodes("[type = 'external']").style({
      shape: "diamond",
      "text-max-width": 120,
      "font-size": 9
    });

    cy.edges().style({
      "curve-style": "bezier"
    });
  }
}

function buildFileTreePositions() {
  const positions = {};
  const domainX = 140;
  const featureX = 420;
  const externalX = 740;
  const baseGapY = 72;
  let y = 70;

  const domainNodes = cy
    .nodes("[type = 'domain']")
    .sort(compareNodesForLayout);

  const placed = new Set();

  domainNodes.forEach((domainNode) => {
    const domainId = domainNode.id();
    positions[domainId] = { x: domainX, y };
    placed.add(domainId);

    let localY = y + baseGapY;
    const features = cy
      .edges(`[kind = 'contains'][source = '${domainId}']`)
      .targets()
      .sort(compareNodesForLayout);

    features.forEach((featureNode) => {
      const featureId = featureNode.id();
      if (!placed.has(featureId)) {
        positions[featureId] = { x: featureX, y: localY };
        placed.add(featureId);
      }

      const externalNodes = featureNode
        .connectedEdges("[kind = 'relation']")
        .connectedNodes("[type = 'external']")
        .sort(compareNodesForLayout);

      let extCount = 0;
      externalNodes.forEach((extNode) => {
        const extId = extNode.id();
        if (placed.has(extId)) {
          return;
        }
        positions[extId] = { x: externalX, y: localY + extCount * 48 };
        placed.add(extId);
        extCount++;
      });

      localY += baseGapY + extCount * 20;
    });

    y = Math.max(localY + 26, y + baseGapY * 2);
  });

  // Place any remaining nodes in a trailing column.
  let orphanY = y;
  cy.nodes().forEach((node) => {
    if (placed.has(node.id())) {
      return;
    }
    positions[node.id()] = { x: externalX + 180, y: orphanY };
    orphanY += baseGapY;
  });

  return positions;
}

function buildClusterSeedPositions() {
  const positions = {};
  const domainX = 140;
  const featureX = 420;
  const externalX = 690;
  const baseGapY = 70;
  let y = 70;

  const domainNodes = cy
    .nodes("[type = 'domain']")
    .sort(compareNodesForLayout);

  const placed = new Set();

  domainNodes.forEach((domainNode) => {
    const domainId = domainNode.id();
    positions[domainId] = { x: domainX, y };
    placed.add(domainId);

    let localY = y + baseGapY;
    const features = cy
      .edges(`[kind = 'contains'][source = '${domainId}']`)
      .targets()
      .sort(compareNodesForLayout);

    features.forEach((featureNode) => {
      const featureId = featureNode.id();
      if (!placed.has(featureId)) {
        positions[featureId] = { x: featureX, y: localY };
        placed.add(featureId);
      }

      const externalNodes = featureNode
        .connectedEdges("[kind = 'relation']")
        .connectedNodes("[type = 'external']")
        .sort(compareNodesForLayout);

      let extCount = 0;
      externalNodes.forEach((extNode) => {
        const extId = extNode.id();
        if (placed.has(extId)) {
          return;
        }
        positions[extId] = { x: externalX, y: localY + extCount * 46 };
        placed.add(extId);
        extCount++;
      });

      localY += baseGapY + extCount * 18;
    });

    y = Math.max(localY + 18, y + baseGapY * 2);
  });

  let orphanY = y;
  cy.nodes().forEach((node) => {
    if (placed.has(node.id())) {
      return;
    }
    positions[node.id()] = { x: externalX + 170, y: orphanY };
    orphanY += baseGapY;
  });

  return positions;
}

function runLayout() {
  if (!cy) {
    return;
  }

  applyViewModeStyles();

  const mode = viewModeSelect.value;
  let layout;
  if (mode === "tree_horizontal") {
    layout = cy.layout({
      name: "breadthfirst",
      directed: true,
      fit: true,
      padding: 38,
      animate: true,
      animationDuration: 350,
      spacingFactor: 1.35,
      avoidOverlap: true,
      avoidOverlapPadding: 30,
      nodeDimensionsIncludeLabels: true,
      sort: compareNodesForLayout
    });
  } else if (mode === "tree_file") {
    layout = cy.layout({
      name: "preset",
      positions: buildFileTreePositions(),
      fit: true,
      padding: 48,
      animate: true,
      animationDuration: 320
    });
  } else {
    const seedPositions = buildClusterSeedPositions();
    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const position = seedPositions[node.id()];
        if (position) {
          node.position(position);
        }
      });
    });

    layout = cy.layout({
      name: "cose",
      fit: true,
      animate: true,
      animationDuration: 350,
      padding: 35,
      nodeRepulsion: 14000,
      idealEdgeLength: 210,
      edgeElasticity: 110,
      nodeDimensionsIncludeLabels: true,
      nodeOverlap: 10,
      gravity: 0.7,
      randomize: false
    });
  }

  layout.one("layoutstop", () => {
    resolveNodeOverlaps(180, 16);
    cy.fit(undefined, 45);
    if (pendingViewportRestore) {
      restoreViewportState();
      pendingViewportRestore = false;
    }
  });
  layout.run();
}

function applySearchFilter() {
  if (!cy) {
    return;
  }

  const q = searchInput.value.trim().toLowerCase();
  cy.elements().removeClass("faded");

  if (!q) {
    return;
  }

  const matchedNodes = cy.nodes().filter((n) => {
    const label = (n.data("label") || "").toLowerCase();
    const id = (n.id() || "").toLowerCase();
    const domain = (n.data("domain") || "").toLowerCase();
    return label.includes(q) || id.includes(q) || domain.includes(q);
  });

  const matchedEdges = cy.edges().filter((e) => {
    const relation = (e.data("relation") || "").toLowerCase();
    return relation.includes(q);
  });

  const focus = matchedNodes.union(matchedNodes.connectedEdges()).union(matchedEdges).union(matchedEdges.connectedNodes());
  cy.elements().difference(focus).addClass("faded");
}

function clearNeighborFocus() {
  if (!cy) {
    return;
  }
  cy.elements().removeClass("focus-faded focus-highlight focus-target");
  focusedNodeId = "";
}

function applyNeighborFocus(nodeId) {
  if (!cy || !nodeId) {
    return;
  }

  const node = cy.getElementById(nodeId);
  if (!node || node.empty()) {
    clearNeighborFocus();
    return;
  }

  const linkedEdges = node.connectedEdges();
  const linkedNodes = linkedEdges.connectedNodes();
  const focusSet = node.union(linkedEdges).union(linkedNodes);

  cy.elements().addClass("focus-faded");
  focusSet.removeClass("focus-faded").addClass("focus-highlight");
  node.addClass("focus-target");
  focusedNodeId = nodeId;
}

function toggleNeighborFocus(nodeId) {
  if (!nodeId) {
    return;
  }

  if (focusedNodeId === nodeId) {
    clearNeighborFocus();
    setStatus("Surbrillance directe desactivee.");
    return;
  }

  clearNeighborFocus();
  applyNeighborFocus(nodeId);
  setStatus(`Surbrillance directe activee pour: ${nodeId}`);
}

function downloadDataUrl(dataUrl, fileName) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function toWebpDataUrl(sourceDataUrl, quality = 0.95) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas indisponible"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/webp", quality));
    };
    img.onerror = () => reject(new Error("Conversion WEBP impossible"));
    img.src = sourceDataUrl;
  });
}

async function exportDiagram() {
  if (!cy) {
    setStatus("Diagramme non initialise.", true);
    return;
  }

  const format = exportFormatEl.value;
  const safeDate = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const baseName = `diagramme-${safeDate}`;

  try {
    if (format === "png") {
      const pngData = cy.png({ full: true, scale: 2, bg: "#ffffff" });
      downloadDataUrl(pngData, `${baseName}.png`);
      setStatus("Export PNG termine.");
      return;
    }

    if (format === "jpg") {
      const jpgData = cy.jpg({ full: true, scale: 2, bg: "#ffffff", quality: 0.95 });
      downloadDataUrl(jpgData, `${baseName}.jpg`);
      setStatus("Export JPG termine.");
      return;
    }

    if (format === "webp") {
      const pngData = cy.png({ full: true, scale: 2, bg: "#ffffff" });
      const webpData = await toWebpDataUrl(pngData, 0.95);
      downloadDataUrl(webpData, `${baseName}.webp`);
      setStatus("Export WEBP termine.");
      return;
    }

    if (format === "pdf") {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error("jsPDF non charge");
      }

      const imgData = cy.png({ full: true, scale: 2, bg: "#ffffff" });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Image PDF invalide"));
        img.src = imgData;
      });

      const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
      const renderWidth = img.width * ratio;
      const renderHeight = img.height * ratio;
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      doc.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
      doc.save(`${baseName}.pdf`);
      setStatus("Export PDF termine.");
      return;
    }

    setStatus("Format d'export non supporte.", true);
  } catch (error) {
    setStatus(`Echec export: ${error.message}`, true);
  }
}

function hideEditNodeButton() {
  editNodeBtn.style.display = "none";
}

function isEditableNode(node) {
  if (!node || !node.isNode || !node.isNode()) {
    return false;
  }
  const type = node.data("type");
  return type === "domain" || type === "feature";
}

function updateEditButtonPosition() {
  if (!cy || !selectedNodeId) {
    hideEditNodeButton();
    return;
  }

  const node = cy.getElementById(selectedNodeId);
  if (!node || node.empty() || !node.visible() || !isEditableNode(node)) {
    hideEditNodeButton();
    return;
  }

  const renderedBox = node.renderedBoundingBox({ includeLabels: true, includeOverlays: false });
  const shape = String(node.style("shape") || "");
  let anchorX = renderedBox.x2;
  let anchorY = renderedBox.y1;

  // Keep the pen on the top-right contour while adapting to node geometry.
  if (shape === "ellipse") {
    anchorX -= 9;
    anchorY += 9;
  } else if (shape === "diamond") {
    anchorX -= 13;
    anchorY += 12;
  } else {
    anchorX -= 5;
    anchorY += 6;
  }

  const wrapRect = cyWrapEl.getBoundingClientRect();
  const left = Math.max(0, Math.min(wrapRect.width - EDIT_BUTTON_SIZE, anchorX - EDIT_BUTTON_SIZE / 2));
  const top = Math.max(0, Math.min(wrapRect.height - EDIT_BUTTON_SIZE, anchorY - EDIT_BUTTON_SIZE / 2));

  editNodeBtn.style.left = `${left}px`;
  editNodeBtn.style.top = `${top}px`;
  editNodeBtn.style.display = "inline-flex";
  editNodeBtn.style.alignItems = "center";
  editNodeBtn.style.justifyContent = "center";
}

function closeEditorModal() {
  editorModal.classList.add("hidden");
}

function openEditorModalForNode() {
  if (!cy || !selectedNodeId) {
    return;
  }

  const node = cy.getElementById(selectedNodeId);
  if (!node || node.empty()) {
    return;
  }

  if (!isEditableNode(node)) {
    setStatus("Seuls les domains et features sont editables.", true);
    return;
  }

  editorInput.value = String(node.data("label") || "");
  editorSubtitle.textContent = `Widget: ${node.id()} (${node.data("type")})`;
  editorModal.classList.remove("hidden");
  editorInput.focus();
  editorInput.select();
}

function updateYamlDocLabel(node, newLabel) {
  if (!currentYamlDoc || typeof currentYamlDoc !== "object") {
    return false;
  }

  const domains = Array.isArray(currentYamlDoc.domains) ? currentYamlDoc.domains : [];
  const type = node.data("type");

  if (type === "domain") {
    const domainId = String(node.data("domain") || "").trim();
    const domain = domains.find((d) => String(d?.id || "") === domainId);
    if (!domain) {
      return false;
    }
    domain.label = newLabel;
    return true;
  }

  if (type === "feature") {
    const targetFeatureId = String(node.id() || "");
    for (const domain of domains) {
      const features = Array.isArray(domain?.features) ? domain.features : [];
      const feature = features.find((f) => String(f?.id || "") === targetFeatureId);
      if (feature) {
        feature.label = newLabel;
        return true;
      }
    }
  }

  return false;
}

function sourceBaseName(sourceLabel) {
  const source = String(sourceLabel || "").replace(/\\/g, "/");
  const parts = source.split("/");
  return parts[parts.length - 1] || "features.yaml";
}

function serverYamlPathFromSource(sourceLabel) {
  const source = String(sourceLabel || "").replace(/\\/g, "/");
  if (source.startsWith("../YAML/")) {
    return `YAML/${source.slice("../YAML/".length)}`;
  }
  if (source.startsWith("YAML/")) {
    return source;
  }
  return null;
}

function downloadYamlFallback(yamlText, fileName = "features.yaml") {
  const blob = new Blob([yamlText], { type: "text/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function persistYamlDoc() {
  if (!currentYamlDoc) {
    throw new Error("Document YAML non charge");
  }

  const yamlText = jsyaml.dump(currentYamlDoc, { lineWidth: -1, noRefs: true });
  const serverPath = serverYamlPathFromSource(currentYamlSource);
  const fallbackName = sourceBaseName(currentYamlSource);

  if (!serverPath) {
    downloadYamlFallback(yamlText, fallbackName);
    throw new Error("Ce YAML ne vient pas du dossier YAML/. Export telecharge.");
  }

  try {
    const response = await fetch("/api/save-yaml", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: serverPath,
        yaml: yamlText
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `HTTP ${response.status}`);
    }
  } catch (error) {
    downloadYamlFallback(yamlText, fallbackName);
    throw new Error(`Sauvegarde serveur indisponible (${error.message}). YAML telecharge.`);
  }
}

async function saveNodeLabelChanges() {
  if (!cy || !selectedNodeId) {
    return;
  }

  const node = cy.getElementById(selectedNodeId);
  if (!node || node.empty() || !isEditableNode(node)) {
    setStatus("Widget non editable.", true);
    return;
  }

  const newLabel = editorInput.value.trim();
  if (!newLabel) {
    setStatus("Le texte ne peut pas etre vide.", true);
    return;
  }

  const oldLabel = String(node.data("label") || "");
  if (newLabel === oldLabel) {
    closeEditorModal();
    setStatus("Aucun changement detecte.");
    return;
  }

  const updated = updateYamlDocLabel(node, newLabel);
  if (!updated) {
    setStatus("Impossible de mettre a jour ce widget dans le YAML.", true);
    return;
  }

  node.data("label", newLabel);
  cy.style().update();
  updateEditButtonPosition();
  closeEditorModal();

  try {
    await persistYamlDoc();
    setStatus(`Widget mis a jour et YAML sauvegarde (${currentYamlSource}).`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function initCy(elements) {
  if (cleanupMouseWheelZoom) {
    cleanupMouseWheelZoom();
    cleanupMouseWheelZoom = null;
  }

  if (cy) {
    cy.destroy();
  }

  selectedNodeId = "";
  focusedNodeId = "";
  hideEditNodeButton();
  closeEditorModal();

  cy = cytoscape({
    container: document.getElementById("cy"),
    elements,
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          color: "#1f1a15",
          "font-size": 10,
          "text-wrap": "wrap",
          "text-max-width": 150,
          "text-valign": "center",
          "text-halign": "center",
          "background-color": "#c7d2de",
          width: "label",
          height: "label",
          padding: "12px",
          "min-width": 54,
          "min-height": 54,
          "border-width": 1.5,
          "border-color": "#4c647a"
        }
      },
      {
        selector: "node[type = 'domain']",
        style: {
          shape: "round-rectangle",
          width: "label",
          height: "label",
          padding: "14px",
          "min-width": 130,
          "min-height": 54,
          "font-size": 11,
          "font-weight": 700,
          "background-color": "#e0cda8",
          "border-color": "#8f6934",
          "text-max-width": 210
        }
      },
      {
        selector: "node[type = 'feature']",
        style: {
          shape: "ellipse",
          "font-size": 10,
          "text-max-width": 150
        }
      },
      {
        selector: "node[type = 'external']",
        style: {
          shape: "diamond",
          width: "label",
          height: "label",
          padding: "10px",
          "min-width": 48,
          "min-height": 48,
          "text-max-width": 120,
          "font-size": 9,
          "background-color": "#d4d4d4",
          "border-color": "#666"
        }
      },
      {
        selector: "node[status = 'implemented']",
        style: {
          "background-color": "#b9e4cf",
          "border-color": "#39725b"
        }
      },
      {
        selector: "node[status = 'partial']",
        style: {
          "background-color": "#ffe4b5",
          "border-color": "#8c6a2d"
        }
      },
      {
        selector: "node[status = 'placeholder']",
        style: {
          "background-color": "#f3c6c6",
          "border-color": "#7f3a3a"
        }
      },
      {
        selector: "edge",
        style: {
          width: 1.4,
          "line-color": "data(lineColor)",
          "target-arrow-color": "data(lineColor)",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          "arrow-scale": 0.8,
          "font-size": 8,
          label: "data(relation)",
          color: "#4f4f4f",
          "text-background-color": "#f7f2e8",
          "text-background-opacity": 0.8,
          "text-background-padding": 2
        }
      },
      {
        selector: "edge[kind = 'contains']",
        style: {
          "line-style": "dashed",
          "target-arrow-shape": "none",
          width: 1.1,
          "font-size": 0
        }
      },
      {
        selector: ".faded",
        style: {
          opacity: 0.12
        }
      },
      {
        selector: ".focus-faded",
        style: {
          opacity: 0.1
        }
      },
      {
        selector: "node.focus-highlight",
        style: {
          opacity: 1
        }
      },
      {
        selector: "edge.focus-highlight",
        style: {
          opacity: 1,
          width: 2
        }
      },
      {
        selector: "node.focus-target",
        style: {
          "border-color": "#f08a24",
          "border-width": 4,
          "overlay-color": "#f08a24",
          "overlay-opacity": 0.1,
          "overlay-padding": 5
        }
      }
    ],
    wheelSensitivity: 1,
    userZoomingEnabled: false
  });

  installMouseWheelZoom();
  pendingViewportRestore = true;

  const hadSaved = restorePositions();
  applyClusterEdgeColors();
  applyViewModeStyles();
  if (!hadSaved) {
    runLayout();
  } else {
    resolveNodeOverlaps(120, 14);
    cy.fit(undefined, 35);
    if (pendingViewportRestore) {
      restoreViewportState();
      pendingViewportRestore = false;
    }
  }

  applyContainmentVisibility();
  applySearchFilter();
  applyTheme();

  cy.on("tap", "node", (event) => {
    selectedNodeId = event.target.id();
    updateEditButtonPosition();
  });

  cy.on("dbltap", "node", (event) => {
    toggleNeighborFocus(event.target.id());
  });

  cy.on("tap", (event) => {
    if (event.target === cy) {
      selectedNodeId = "";
      hideEditNodeButton();
    }
  });

  cy.on("dbltap", (event) => {
    if (event.target === cy) {
      clearNeighborFocus();
      setStatus("Surbrillance directe desactivee.");
    }
  });

  cy.on("drag free position pan zoom resize render", updateEditButtonPosition);
  cy.on("pan zoom", scheduleViewportSave);
}

function applyTheme() {
  const isDark = themeToggle.checked;
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

  if (!cy) {
    return;
  }

  const isTreeMode = viewModeSelect.value === "tree_horizontal" || viewModeSelect.value === "tree_file";
  const nodeText = isDark ? "#f2eee7" : "#1f1a15";
  const edgeTextBg = isDark ? "#222732" : "#f7f2e8";

  applyClusterEdgeColors();

  cy.style()
    .selector("node")
    .style({
      color: nodeText,
      "border-color": isDark ? "#7f9ab3" : "#4c647a",
      "background-color": isDark ? "#324759" : "#c7d2de"
    })
    .selector("node[type = 'domain']")
    .style({
      "background-color": isDark ? "#64543c" : "#e0cda8",
      "border-color": isDark ? "#cbb186" : "#8f6934"
    })
    .selector("node[type = 'external']")
    .style({
      "background-color": isDark ? "#434b57" : "#d4d4d4",
      "border-color": isDark ? "#9ba4b1" : "#666"
    })
    .selector("node[status = 'implemented']")
    .style({
      "background-color": isDark ? "#2f6d58" : "#b9e4cf",
      "border-color": isDark ? "#86c0aa" : "#39725b"
    })
    .selector("node[status = 'partial']")
    .style({
      "background-color": isDark ? "#7a5f2f" : "#ffe4b5",
      "border-color": isDark ? "#ddbe88" : "#8c6a2d"
    })
    .selector("node[status = 'placeholder']")
    .style({
      "background-color": isDark ? "#6f3b3b" : "#f3c6c6",
      "border-color": isDark ? "#d09999" : "#7f3a3a"
    })
    .selector("edge")
    .style({
      color: isDark ? "#d8dde6" : "#4f4f4f",
      "text-background-color": edgeTextBg
    })
    .update();

  // Force node shape update in case theme switch happens after mode switch.
  if (isTreeMode) {
    applyViewModeStyles();
  }
}

async function loadYamlFromPath(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function listYamlFilesInProject() {
  const response = await fetch(YAML_API_FILES_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.files)) {
    throw new Error("Reponse /api/yaml-files invalide");
  }

  return payload.files
    .map((item) => String(item || "").trim())
    .filter((name) => Boolean(name) && /\.(yaml|yml)$/i.test(name));
}

async function resolveSourceLabelForPickedFile(fileName) {
  const safeName = String(fileName || "").trim();
  if (!safeName) {
    return safeName;
  }

  try {
    const yamlFiles = await listYamlFilesInProject();
    if (yamlFiles.includes(safeName)) {
      return `${YAML_DIR_WEB_PATH}${safeName}`;
    }
  } catch (error) {
    console.warn("Resolution de source YAML impossible, conservation du nom local.", error);
  }

  return safeName;
}

function chooseYamlFile(files) {
  const lines = files.map((name, index) => `${index + 1}. ${name}`).join("\n");
  while (true) {
    const answer = window.prompt(
      `Plusieurs YAML detectes dans YAML/.\nChoisis le numero a charger:\n\n${lines}`,
      "1"
    );
    if (answer === null) {
      return null;
    }

    const idx = Number.parseInt(answer, 10);
    if (Number.isInteger(idx) && idx >= 1 && idx <= files.length) {
      return files[idx - 1];
    }
  }
}

async function openYamlExplorer() {
  // Try modern file picker first; fallback to hidden input click.
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "YAML", accept: { "text/yaml": [".yaml", ".yml"] } }]
      });
      if (handle) {
        const file = await handle.getFile();
        const text = await file.text();
        const sourceLabel = await resolveSourceLabelForPickedFile(file.name);
        renderFromYamlText(text, sourceLabel);
        return true;
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("showOpenFilePicker indisponible, fallback input file.", error);
      }
    }
  }

  yamlFileInput.value = "";
  yamlFileInput.click();
  return false;
}

function renderFromYamlText(yamlText, sourceLabel) {
  const parsed = jsyaml.load(yamlText);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("YAML vide ou invalide");
  }

  currentYamlDoc = parsed;
  currentYamlSource = sourceLabel;

  const graph = buildGraphElements(parsed);
  initCy(graph);

  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  setStatus(`Source: ${sourceLabel} | ${nodeCount} noeuds | ${edgeCount} connexions`);
}

async function init() {
  try {
    const yamlFiles = await listYamlFilesInProject();

    if (yamlFiles.length === 1) {
      const selectedFile = yamlFiles[0];
      const sourcePath = `${YAML_DIR_WEB_PATH}${selectedFile}`;
      const yamlText = await loadYamlFromPath(sourcePath);
      renderFromYamlText(yamlText, sourcePath);
      return;
    }

    if (yamlFiles.length > 1) {
      const selectedFile = chooseYamlFile(yamlFiles);
      if (!selectedFile) {
        setStatus("Selection annulee. Utilise 'Charger un YAML' pour continuer.", true);
        return;
      }
      const sourcePath = `${YAML_DIR_WEB_PATH}${selectedFile}`;
      const yamlText = await loadYamlFromPath(sourcePath);
      renderFromYamlText(yamlText, sourcePath);
      return;
    }

    setStatus("Aucun YAML dans YAML/. Ouverture de l explorateur de fichiers...");
    await openYamlExplorer();
  } catch (error) {
    setStatus(
      "Chargement auto impossible. Lance le serveur local puis charge un fichier YAML manuellement.",
      true
    );
    console.error(error);
  }
}

yamlFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const sourceLabel = await resolveSourceLabelForPickedFile(file.name);
    renderFromYamlText(text, sourceLabel);
  } catch (error) {
    setStatus(`Erreur de parsing YAML: ${error.message}`, true);
  }
});

editNodeBtn.addEventListener("click", openEditorModalForNode);
editorCancelBtn.addEventListener("click", closeEditorModal);
editorSaveBtn.addEventListener("click", saveNodeLabelChanges);
editorModal.addEventListener("click", (event) => {
  if (event.target === editorModal) {
    closeEditorModal();
  }
});
editorInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeEditorModal();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    saveNodeLabelChanges();
  }
});
sortHelpModal?.addEventListener("click", (event) => {
  if (event.target === sortHelpModal) {
    closeSortHelpModal();
  }
});
sortHelpCloseBtn?.addEventListener("click", closeSortHelpModal);
sortHelpBtn?.addEventListener("click", openSortHelpModal);
toggleControlsBtn?.addEventListener("click", () => {
  const collapsed = !controlsPanel?.classList.contains("is-collapsed");
  setControlsCollapsed(collapsed);
  localStorage.setItem(CONTROLS_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSortHelpModal();
  }
});

showContainmentInput.addEventListener("change", applyContainmentVisibility);
searchInput.addEventListener("input", applySearchFilter);
layoutBtn.addEventListener("click", runLayout);
refreshBtn.addEventListener("click", () => window.location.reload());
saveBtn.addEventListener("click", savePositions);
resetBtn.addEventListener("click", resetPositions);
viewModeSelect.addEventListener("change", runLayout);
viewModeSelect.addEventListener("change", () => {
  localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewModeSelect.value);
});
sortModeSelect?.addEventListener("change", runLayout);
exportBtn.addEventListener("click", exportDiagram);
themeToggle.addEventListener("change", () => {
  localStorage.setItem(THEME_STORAGE_KEY, themeToggle.checked ? "dark" : "light");
  applyTheme();
});
sortModeSelect?.addEventListener("change", () => {
  localStorage.setItem(SORT_MODE_STORAGE_KEY, sortModeSelect.value);
});
window.addEventListener("beforeunload", saveViewportState);

setControlsCollapsed(false);
restoreUiPreferences();
applyTheme();
init();
