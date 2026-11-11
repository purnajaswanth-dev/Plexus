import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Compass,
  Layers,
  Search,
  Navigation,
  Sparkles,
  Sliders,
  ExternalLink,
  ChevronRight,
  Database,
  Radio,
  Clock,
  Shield,
  Send,
  Eye,
  GitBranch,
  Info
} from 'lucide-react';

export const MetropolisCityViewport = ({
  cityData,
  executionPath,
  journeyGraph,
  activeStepIndex = 1,
  journeyMode = 'REQUEST',
  selectedEndpoint = null,
  onSelectBuilding = () => {},
  onSelectWorkstation = () => {},
  onSelectEndpoint = () => {},
  selectedBuildingId = null,
  selectedEntity: propSelectedEntity = null,
  onSelectEntity = () => {},
  impactMode = null,
  onClearImpactMode = () => {}
}) => {
  const containerRef = useRef(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.getAttribute('data-theme') !== 'light' &&
           document.documentElement.getAttribute('data-t') !== 'l';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const isL = document.documentElement.getAttribute('data-theme') === 'light' ||
                  document.documentElement.getAttribute('data-t') === 'l';
      setIsDark(!isL);
    };
    window.addEventListener('plexus-theme-changed', handleThemeChange);
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-t'] });
    return () => {
      window.removeEventListener('plexus-theme-changed', handleThemeChange);
      observer.disconnect();
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const cityTheme = useMemo(() => {
    if (isDark) {
      return {
        bg: '#09090c',
        groundPerimeter: '#0e0e13',
        groundBorder: '#23232c',
        gridDot: '#262631',
        roadBed: '#14141b',
        roadLane: '#262631',
        roadAvenue: '#181822',
        roadCenterline: '#38bdf8',
        intersection: '#181822',
        intersectionBorder: '#272731',
        intersectionSignal: '#38bdf8',
        districtFill: '#0e0e13',
        districtBorder: '#272731',
        districtHeaderFill: '#15151b',
        districtText: '#ececf2',
        districtSubtext: '#8b8b9a',
        orientationFill: '#15151b',
        orientationBorder: '#272731',
        orientationText: '#ececf2',
        compassAccent: '#38bdf8',
        hudBg: 'rgba(15, 15, 19, 0.94)',
        hudBorder: '#23232c',
        hudText: '#ececf2',
        hudMuted: '#8b8b9a'
      };
    } else {
      return {
        bg: '#eceef3',
        groundPerimeter: '#fafbfc',
        groundBorder: '#d0d5df',
        gridDot: '#d3d8e2',
        roadBed: '#ffffff',
        roadLane: '#e3e6ed',
        roadAvenue: '#ffffff',
        roadCenterline: '#0278b8',
        intersection: '#ffffff',
        intersectionBorder: '#d0d5df',
        intersectionSignal: '#0278b8',
        districtFill: '#fafbfc',
        districtBorder: '#d0d5df',
        districtHeaderFill: '#f4f5f8',
        districtText: '#12141a',
        districtSubtext: '#586073',
        orientationFill: '#ffffff',
        orientationBorder: '#d0d5df',
        orientationText: '#12141a',
        compassAccent: '#0278b8',
        hudBg: 'rgba(255, 255, 255, 0.94)',
        hudBorder: '#e3e6ed',
        hudText: '#12141a',
        hudMuted: '#586073'
      };
    }
  }, [isDark]);

  // Layer Toggles
  const [showStreets, setShowStreets] = useState(true);
  const [showBuildingLabels, setShowBuildingLabels] = useState(true);
  const [showDependencyOverlay, setShowDependencyOverlay] = useState(true);
  const [showApiGates, setShowApiGates] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [forceCutaway, setForceCutaway] = useState(false);

  // Semantic Overlay Filters
  const [overlayFilters, setOverlayFilters] = useState({
    CALLS: true,
    PERSISTS_TO: true,
    EXTERNAL_CALL: true,
    EVENT_ASYNC: true,
    EXTENDS: true,
    IMPLEMENTS: true,
    DEPENDS_ON: true
  });

  // Selected Entity State (synchronize internal and prop state)
  const [internalSelectedEntity, setInternalSelectedEntity] = useState(null);
  const selectedEntity = propSelectedEntity || internalSelectedEntity;

  const handleSelectEntityInternal = useCallback((ent) => {
    setInternalSelectedEntity(ent);
    if (onSelectEntity) onSelectEntity(ent);
  }, [onSelectEntity]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState('ALL');
  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [activeBreadcrumbBuilding, setActiveBreadcrumbBuilding] = useState(null);

  // 5-Level Continuous Zoom Level Detection
  const zoomLevel = useMemo(() => {
    if (zoom < 0.65) return { id: 1, name: 'Metropolis', scaleName: '1 · Metropolis' };
    if (zoom < 0.95) return { id: 2, name: 'District', scaleName: '2 · District' };
    if (zoom < 1.35) return { id: 3, name: 'Block', scaleName: '3 · Block' };
    if (zoom < 1.9) return { id: 4, name: 'Building', scaleName: '4 · Building' };
    return { id: 5, name: 'Room', scaleName: '5 · Room / Workstation' };
  }, [zoom]);

  // Calculate city bounds for responsive auto-framing
  const cityBounds = useMemo(() => {
    if (!cityData) return { minX: 0, minY: 0, maxX: 1200, maxY: 800, width: 1200, height: 800 };

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    (cityData.districts || []).forEach(d => {
      minX = Math.min(minX, d.x);
      minY = Math.min(minY, d.y);
      maxX = Math.max(maxX, d.x + d.width);
      maxY = Math.max(maxY, d.y + d.height);
    });

    (cityData.buildings || []).forEach(b => {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });

    (cityData.landmarks || []).forEach(lm => {
      minX = Math.min(minX, lm.x);
      minY = Math.min(minY, lm.y);
      maxX = Math.max(maxX, lm.x + (lm.width || 90));
      maxY = Math.max(maxY, lm.y + (lm.height || 90));
    });

    if (minX === Infinity) {
      return { minX: 0, minY: 0, maxX: 1200, maxY: 800, width: 1200, height: 800 };
    }

    const pad = 60;
    const finalMinX = Math.max(0, minX - pad);
    const finalMinY = Math.max(0, minY - pad);
    const finalMaxX = Math.max(1200, maxX + pad);
    const finalMaxY = Math.max(800, maxY + pad);

    return {
      minX: finalMinX,
      minY: finalMinY,
      maxX: finalMaxX,
      maxY: finalMaxY,
      width: finalMaxX - finalMinX,
      height: finalMaxY - finalMinY
    };
  }, [cityData]);

  // Center / Fit View so city fills available viewport
  const fitView = useCallback(() => {
    if (!containerRef.current || !cityBounds) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const pad = 48;
    const availW = rect.width - pad * 2;
    const availH = rect.height - pad * 2;

    const scaleX = availW / cityBounds.width;
    const scaleY = availH / cityBounds.height;
    const fittedZoom = Math.min(scaleX, scaleY);

    const safeZoom = Math.min(Math.max(fittedZoom, 0.35), 1.5);

    const centerX = (rect.width - cityBounds.width * safeZoom) / 2 - cityBounds.minX * safeZoom;
    const centerY = (rect.height - cityBounds.height * safeZoom) / 2 - cityBounds.minY * safeZoom;

    setZoom(safeZoom);
    setPan({ x: centerX, y: centerY });
  }, [cityBounds]);

  // Initial auto-framing
  useEffect(() => {
    if (cityData) {
      const timer = setTimeout(() => {
        fitView();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [cityData, fitView]);

  // Fly Camera to Coordinates
  const flyTo = useCallback((targetX, targetY, targetZoom = 1.0) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newPanX = rect.width / 2 - targetX * targetZoom;
    const newPanY = rect.height / 2 - targetY * targetZoom;

    setZoom(targetZoom);
    setPan({ x: newPanX, y: newPanY });
  }, []);

  // Quick Level Switcher Handler
  const setLevelZoom = (lvl) => {
    if (lvl === 1) {
      fitView();
    } else if (lvl === 2) {
      setZoom(0.8);
    } else if (lvl === 3) {
      setZoom(1.15);
    } else if (lvl === 4) {
      setZoom(1.6);
    } else if (lvl === 5) {
      setZoom(2.3);
    }
  };

  // Pan & Zoom Event Handlers (Bound with passive: false to eliminate browser console violations)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom((prevZoom) => {
        const nextZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.22), 3.5);
        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * (nextZoom / prevZoom),
          y: mouseY - (mouseY - prevPan.y) * (nextZoom / prevZoom)
        }));
        return nextZoom;
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Keyboard navigation shortcuts (+/- zoom, F fit, 0 reset, Escape deselect, Space drag)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }
      if (e.code === 'Space') {
        setIsSpacePressed(true);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom(prev => Math.min(prev * 1.2, 3.5));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom(prev => Math.max(prev * 0.8, 0.22));
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        fitView();
      } else if (e.key === '0') {
        e.preventDefault();
        fitView();
      } else if (e.key === 'Escape') {
        handleSelectEntityInternal(null);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [fitView, handleSelectEntityInternal]);

  // Viewport Frustum Calculation for Overview Minimap Navigator
  const minimapFrustum = useMemo(() => {
    if (!containerRef.current || !cityBounds) return { x: 0, y: 0, width: 0, height: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const vx = (-pan.x) / zoom;
    const vy = (-pan.y) / zoom;
    const vw = rect.width / zoom;
    const vh = rect.height / zoom;
    return { x: vx, y: vy, width: vw, height: vh };
  }, [pan, zoom, cityBounds]);

  const handleMinimapClick = (e) => {
    if (!cityBounds) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));
    const targetX = cityBounds.minX + normX * cityBounds.width;
    const targetY = cityBounds.minY + normY * cityBounds.height;
    flyTo(targetX, targetY, zoom);
  };

  // Helper for label overflow truncation with guaranteed fit
  const truncate = (str, maxLen = 14) => {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, Math.max(3, maxLen - 1)) + '…';
  };

  // Search Files, Classes, Methods, Districts, Landmarks
  useEffect(() => {
    if (!searchQuery.trim() || !cityData) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = [];

    (cityData.districts || []).forEach(d => {
      if (d.name && d.name.toLowerCase().includes(q)) {
        matches.push({ type: 'DISTRICT', id: d.id, name: d.name, district: d });
      }
    });

    (cityData.landmarks || []).forEach(lm => {
      if ((lm.name && lm.name.toLowerCase().includes(q)) || (lm.landmarkType && lm.landmarkType.toLowerCase().includes(q))) {
        matches.push({ type: 'LANDMARK', id: lm.id, name: lm.name, landmark: lm });
      }
    });

    (cityData.buildings || []).forEach(b => {
      if (b.name.toLowerCase().includes(q) || (b.fileName && b.fileName.toLowerCase().includes(q))) {
        matches.push({ type: 'FILE', id: b.id, name: b.fileName || b.name, building: b, district: b.districtName });
      }
      (b.rooms || []).forEach(r => {
        if (r.name.toLowerCase().includes(q)) {
          matches.push({ type: 'CLASS', id: r.id, name: r.name, building: b, district: b.districtName, room: r });
        }
        (r.workstations || []).forEach(w => {
          if (w.name.toLowerCase().includes(q)) {
            matches.push({ type: 'METHOD', id: w.id, name: `${r.name}.${w.name}()`, building: b, district: b.districtName, workstationId: w.id, workstation: w, room: r });
          }
        });
      });
    });

    setSearchResults(matches.slice(0, 10));
  }, [searchQuery, cityData]);

  // Active Journey Step Resolution
  const activeJourneyData = useMemo(() => {
    if (!executionPath && !journeyGraph) return null;

    const currentSteps = journeyMode === 'RESPONSE' && executionPath?.responseSteps?.length > 0
      ? executionPath.responseSteps
      : (executionPath?.steps || []);

    const activeStepObj = currentSteps.find(s => s.stepIndex === activeStepIndex) || currentSteps[0];
    const activeTransition = journeyGraph?.transitions?.[activeStepIndex - 1];
    const activeTargetNodeId = activeTransition?.toNodeId;
    const activeNode = journeyGraph?.nodes?.find(n => n.id === activeTargetNodeId);
    const activeScope = activeTransition?.scope || 'BUILDING';
    const activeRoadId = (activeScope === 'BUILDING' || activeScope === 'EXTERNAL') ? activeTransition?.roadId : null;
    const activeWorkstationId = activeNode?.cityRef?.workstationId || activeNode?.methodId;
    const activeBuildingKey = activeNode?.cityRef?.buildingId || activeStepObj?.targetComponentKey || activeStepObj?.sourceComponentKey;

    const involvedBuildings = new Set();
    currentSteps.forEach(s => {
      if (s.sourceComponentKey) involvedBuildings.add(s.sourceComponentKey);
      if (s.targetComponentKey) involvedBuildings.add(s.targetComponentKey);
    });
    if (journeyGraph?.nodes) {
      journeyGraph.nodes.forEach(n => {
        if (n.cityRef?.buildingId) involvedBuildings.add(n.cityRef.buildingId);
        if (n.fileId) involvedBuildings.add(n.fileId);
      });
    }

    return {
      activeStepObj,
      activeTransition,
      activeNode,
      activeScope,
      activeRoadId,
      activeWorkstationId,
      activeBuildingKey,
      involvedBuildings,
      currentSteps
    };
  }, [executionPath, journeyGraph, activeStepIndex, journeyMode]);

  // Center camera on active building when step changes
  useEffect(() => {
    if (!activeJourneyData || !cityData || !activeJourneyData.activeBuildingKey) return;

    const bldg = (cityData.buildings || []).find(b =>
      b.id === activeJourneyData.activeBuildingKey ||
      b.fileId === activeJourneyData.activeBuildingKey ||
      b.name === activeJourneyData.activeBuildingKey
    );
    if (bldg) {
      setActiveBreadcrumbBuilding(bldg);
      flyTo(bldg.x + bldg.width / 2, bldg.y + bldg.height / 2, Math.max(zoom, 1.15));
    }
  }, [activeJourneyData, cityData, flyTo]);

  // Keep track of active breadcrumbs
  const currentActiveBuilding = useMemo(() => {
    if (selectedBuildingId) {
      const b = (cityData?.buildings || []).find(x => x.id === selectedBuildingId || x.fileId === selectedBuildingId);
      if (b) return b;
    }
    return activeBreadcrumbBuilding || (cityData?.buildings?.[0] || null);
  }, [selectedBuildingId, activeBreadcrumbBuilding, cityData]);

  const currentDistrict = useMemo(() => {
    if (!currentActiveBuilding || !cityData?.districts) return cityData?.districts?.[0] || null;
    return cityData.districts.find(d => d.id === currentActiveBuilding.districtId) || cityData.districts[0];
  }, [currentActiveBuilding, cityData]);

  const currentBlock = useMemo(() => {
    if (!currentActiveBuilding || !cityData?.blocks) return null;
    return cityData.blocks.find(b => b.id === currentActiveBuilding.blockId) || null;
  }, [currentActiveBuilding, cityData]);

  // Building color palette mapping
  const getBuildingTheme = useCallback((bldg) => {
    const isUnsupported = bldg.gapStatus === 'UNSUPPORTED' || (bldg.fileName && (bldg.fileName.endsWith('.yml') || bldg.fileName.endsWith('.yaml') || bldg.fileName.endsWith('.properties')));
    const isExternal = bldg.componentType === 'EXTERNAL' || (bldg.districtName && bldg.districtName.toUpperCase().includes('EXTERNAL'));

    if (isDark) {
      if (isUnsupported) {
        return { fill: '#14141b', isUnsupported: true, isExternal: false, textFill: '#8b8b9a', stroke: '#272731' };
      }
      if (isExternal) {
        return { fill: '#1a1014', isUnsupported: false, isExternal: true, textFill: '#f87171', stroke: '#ef4444', chipBg: '#ef4444', chipText: '#ffffff' };
      }

      const type = (bldg.componentType || '').toUpperCase();
      const name = (bldg.name || '').toUpperCase();
      const dist = (bldg.districtName || '').toUpperCase();

      if (type.includes('CONTROLLER') || name.includes('CONTROLLER') || dist.includes('CONTROLLER') || dist.includes('API')) {
        return { fill: '#162033', textFill: '#ececf2', stroke: '#38bdf8', chipBg: '#0284c7', chipText: '#ffffff' };
      }
      if (type.includes('SERVICE') || name.includes('SERVICE') || dist.includes('SERVICE')) {
        return { fill: '#151b2c', textFill: '#ececf2', stroke: '#6d8cff', chipBg: '#4f46e5', chipText: '#ffffff' };
      }
      if (type.includes('REPOSITORY') || type.includes('DAO') || name.includes('REPOSITORY') || name.includes('DAO') || dist.includes('REPOSITORY')) {
        return { fill: '#10221c', textFill: '#ececf2', stroke: '#34d399', chipBg: '#059669', chipText: '#ffffff' };
      }
      if (type.includes('ENTITY') || type.includes('MODEL') || type.includes('DTO') || dist.includes('ENTITY') || dist.includes('DOMAIN')) {
        return { fill: '#241b0f', textFill: '#ececf2', stroke: '#f5b942', chipBg: '#d97706', chipText: '#ffffff' };
      }
      if (type.includes('CONFIG') || name.includes('CONFIG') || dist.includes('CONFIG') || dist.includes('SECURITY')) {
        return { fill: '#23162a', textFill: '#ececf2', stroke: '#a855f7', chipBg: '#7c3aed', chipText: '#ffffff' };
      }
      if (type.includes('EVENT') || name.includes('EVENT') || name.includes('LISTENER') || dist.includes('EVENT')) {
        return { fill: '#231320', textFill: '#ececf2', stroke: '#ec4899', chipBg: '#db2777', chipText: '#ffffff' };
      }
      if (type.includes('UTIL') || name.includes('UTIL') || dist.includes('UTIL')) {
        return { fill: '#181820', textFill: '#ececf2', stroke: '#52525b', chipBg: '#52525b', chipText: '#ffffff' };
      }

      return { fill: '#15151b', textFill: '#ececf2', stroke: '#3f3f46', chipBg: '#3f3f46', chipText: '#ffffff' };
    }

    // Light Theme
    if (isUnsupported) {
      return { fill: '#EFE9E3', isUnsupported: true, isExternal: false, textFill: '#62574E', stroke: '#D9CFC7' };
    }
    if (isExternal) {
      return { fill: '#FFFFFF', isUnsupported: false, isExternal: true, textFill: '#B77C61', stroke: '#B77C61', chipBg: '#B77C61', chipText: '#FFFFFF' };
    }

    const type = (bldg.componentType || '').toUpperCase();
    const name = (bldg.name || '').toUpperCase();
    const dist = (bldg.districtName || '').toUpperCase();

    if (type.includes('CONTROLLER') || name.includes('CONTROLLER') || dist.includes('CONTROLLER') || dist.includes('API')) {
      return { fill: '#587C78', textFill: '#FFFFFF', stroke: 'none', chipBg: '#587C78', chipText: '#FFFFFF' };
    }
    if (type.includes('SERVICE') || name.includes('SERVICE') || dist.includes('SERVICE')) {
      return { fill: '#71869B', textFill: '#FFFFFF', stroke: 'none', chipBg: '#71869B', chipText: '#FFFFFF' };
    }
    if (type.includes('REPOSITORY') || type.includes('DAO') || name.includes('REPOSITORY') || name.includes('DAO') || dist.includes('REPOSITORY')) {
      return { fill: '#8D916B', textFill: '#FFFFFF', stroke: 'none', chipBg: '#8D916B', chipText: '#FFFFFF' };
    }
    if (type.includes('ENTITY') || type.includes('MODEL') || type.includes('DTO') || dist.includes('ENTITY') || dist.includes('DOMAIN')) {
      return { fill: '#9EA37E', textFill: '#39332E', stroke: 'none', chipBg: '#8D916B', chipText: '#FFFFFF' };
    }
    if (type.includes('CONFIG') || name.includes('CONFIG') || dist.includes('CONFIG') || dist.includes('SECURITY')) {
      return { fill: '#C09A62', textFill: '#39332E', stroke: 'none', chipBg: '#C09A62', chipText: '#FFFFFF' };
    }
    if (type.includes('EVENT') || name.includes('EVENT') || name.includes('LISTENER') || dist.includes('EVENT')) {
      return { fill: '#927D91', textFill: '#FFFFFF', stroke: 'none', chipBg: '#927D91', chipText: '#FFFFFF' };
    }
    if (type.includes('UTIL') || name.includes('UTIL') || dist.includes('UTIL')) {
      return { fill: '#62574E', textFill: '#FFFFFF', stroke: 'none', chipBg: '#62574E', chipText: '#FFFFFF' };
    }

    return { fill: '#71869B', textFill: '#FFFFFF', stroke: 'none', chipBg: '#71869B', chipText: '#FFFFFF' };
  }, [isDark]);

  // Filtered Districts & Buildings
  const visibleDistricts = useMemo(() => {
    if (!cityData?.districts) return [];
    if (selectedDistrictFilter === 'ALL') return cityData.districts;
    return cityData.districts.filter(d => d.id === selectedDistrictFilter);
  }, [cityData, selectedDistrictFilter]);

  const visibleBuildings = useMemo(() => {
    if (!cityData?.buildings) return [];
    if (selectedDistrictFilter === 'ALL') return cityData.buildings;
    return cityData.buildings.filter(b => b.districtId === selectedDistrictFilter);
  }, [cityData, selectedDistrictFilter]);

  // Request Journey Route Highway Path
  const journeyHighwayPath = useMemo(() => {
    if (!activeJourneyData || !cityData) return null;
    const { currentSteps } = activeJourneyData;
    if (!currentSteps || currentSteps.length === 0) return null;

    const points = [];
    const firstStep = currentSteps[0];
    const firstBldg = (cityData.buildings || []).find(b =>
      b.id === firstStep.targetComponentKey ||
      b.id === firstStep.sourceComponentKey ||
      b.fileId === firstStep.targetComponentKey ||
      b.fileId === firstStep.sourceComponentKey
    );

    if (firstBldg) {
      points.push({ x: 20, y: firstBldg.y + firstBldg.height / 2 });
      points.push({ x: firstBldg.x, y: firstBldg.y + firstBldg.height / 2 });
    }

    currentSteps.forEach(step => {
      const bldg = (cityData.buildings || []).find(b =>
        b.id === step.targetComponentKey ||
        b.fileId === step.targetComponentKey ||
        b.name === step.targetComponentName
      );
      if (bldg) {
        points.push({
          x: bldg.x + bldg.width / 2,
          y: bldg.y + bldg.height / 2,
          bldg
        });
      }
    });

    const dbLandmark = (cityData.landmarks || []).find(lm => lm.landmarkType === 'DATABASE_VAULT');
    if (dbLandmark && currentSteps.some(s => (s.targetComponentName || '').toLowerCase().includes('repo') || (s.targetComponentName || '').toLowerCase().includes('database'))) {
      points.push({
        x: dbLandmark.x,
        y: dbLandmark.y + dbLandmark.height / 2
      });
    }

    if (points.length < 2) return null;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const midX = (p1.x + p2.x) / 2;
      d += ` H ${midX} V ${p2.y} H ${p2.x}`;
    }

    return { d, points };
  }, [activeJourneyData, cityData]);

  // Toggle single overlay filter
  const toggleOverlay = (key) => {
    setOverlayFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      className="metropolis-viewport-root"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
        background: cityTheme.bg
      }}
    >
      {/* =================================================================== */}
      {/* DOCKED SUB-TOOLBAR: BREADCRUMBS, DISTRICTS, OVERLAYS & LEVEL ZOOM  */}
      {/* =================================================================== */}
      <div
        className="metropolis-docked-toolbar"
        style={{
          height: '42px',
          flexShrink: 0,
          background: cityTheme.hudBg,
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${cityTheme.hudBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          gap: '12px',
          zIndex: 25,
          fontSize: '12px',
          color: cityTheme.hudText,
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}
      >
        {/* LEFT: Interactive Breadcrumbs Trail */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 1 }}>
          <button
            onClick={() => {
              fitView();
              handleSelectEntityInternal({ type: 'REPOSITORY', name: cityData?.repositoryName || 'Repository', data: cityData, id: cityData?.repositoryId });
            }}
            style={{
              background: 'none',
              border: 'none',
              color: isDark ? 'var(--cc-cyan, #38bdf8)' : 'var(--a, #3552d6)',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}
            title={`Entire repository: ${cityData?.repositoryName || 'Metropolis'}`}
          >
            <span>🌆</span>
            <span>{truncate(cityData?.repositoryName || 'Metropolis', 22)}</span>
          </button>

          {currentDistrict && (
            <>
              <ChevronRight size={13} style={{ color: cityTheme.hudMuted, flexShrink: 0 }} />
              <button
                onClick={() => {
                  setSelectedDistrictFilter(currentDistrict.id);
                  flyTo(currentDistrict.x + currentDistrict.width / 2, currentDistrict.y + currentDistrict.height / 2, 0.85);
                  handleSelectEntityInternal({ type: 'DISTRICT', name: currentDistrict.name, data: currentDistrict, id: currentDistrict.id });
                }}
                style={{ background: 'none', border: 'none', color: cityTheme.hudText, fontWeight: 600, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
                title={`District: ${currentDistrict.name}`}
              >
                📍 {truncate(currentDistrict.name, 18)}
              </button>
            </>
          )}

          {currentBlock && (
            <>
              <ChevronRight size={13} style={{ color: cityTheme.hudMuted, flexShrink: 0 }} />
              <button
                onClick={() => {
                  flyTo(currentBlock.x + currentBlock.width / 2, currentBlock.y + currentBlock.height / 2, 1.2);
                  handleSelectEntityInternal({ type: 'BLOCK', name: currentBlock.name, data: currentBlock, id: currentBlock.id });
                }}
                style={{ background: 'none', border: 'none', color: cityTheme.hudMuted, fontWeight: 500, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
                title={`Neighbourhood: ${currentBlock.name}`}
              >
                🏘️ {truncate(currentBlock.name, 16)}
              </button>
            </>
          )}

          {currentActiveBuilding && (
            <>
              <ChevronRight size={13} style={{ color: cityTheme.hudMuted, flexShrink: 0 }} />
              <button
                onClick={() => {
                  onSelectBuilding(currentActiveBuilding);
                  flyTo(currentActiveBuilding.x + currentActiveBuilding.width / 2, currentActiveBuilding.y + currentActiveBuilding.height / 2, 1.6);
                  handleSelectEntityInternal({ type: 'BUILDING', name: currentActiveBuilding.name, data: currentActiveBuilding, id: currentActiveBuilding.id });
                }}
                style={{ background: 'none', border: 'none', color: isDark ? 'var(--wa, #f5b942)' : '#a86a00', fontWeight: 600, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
                title={`Building: ${currentActiveBuilding.fileName || currentActiveBuilding.name}`}
              >
                🏢 {truncate(currentActiveBuilding.fileName || currentActiveBuilding.name, 18)}
              </button>
            </>
          )}

          {selectedEntity && (
            <>
              <ChevronRight size={13} style={{ color: cityTheme.hudMuted, flexShrink: 0 }} />
              <span style={{ color: isDark ? 'var(--cc-cyan, #38bdf8)' : 'var(--cy, #0278b8)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                🔍 {truncate(selectedEntity.name || selectedEntity.type, 16)}
              </span>
            </>
          )}

          <div style={{ width: '1px', height: '16px', background: cityTheme.hudBorder, margin: '0 6px', flexShrink: 0 }} />

          {/* District Selector Filter */}
          <select
            value={selectedDistrictFilter}
            onChange={(e) => {
              setSelectedDistrictFilter(e.target.value);
              if (e.target.value !== 'ALL') {
                const dist = (cityData?.districts || []).find(d => d.id === e.target.value);
                if (dist) flyTo(dist.x + dist.width / 2, dist.y + dist.height / 2, 0.9);
              } else {
                fitView();
              }
            }}
            style={{
              background: 'transparent',
              border: `1px solid ${cityTheme.hudBorder}`,
              color: cityTheme.hudText,
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <option value="ALL">🌆 All Districts</option>
            {(cityData?.districts || []).map(d => (
              <option key={d.id} value={d.id}>📍 {truncate(d.name, 20)} ({d.buildingCount})</option>
            ))}
          </select>

          {/* Search Box in Sub-bar */}
          <div style={{ position: 'relative', width: '180px', flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${cityTheme.hudBorder}`,
                borderRadius: '6px',
                padding: '3px 8px',
                color: cityTheme.hudText
              }}
            >
              <Search size={12} style={{ color: cityTheme.hudMuted, marginRight: '6px', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Find in city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: cityTheme.hudText,
                  width: '100%',
                  fontSize: '11px',
                  fontFamily: 'inherit'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: cityTheme.hudMuted, cursor: 'pointer', fontSize: '11px', padding: 0 }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search Dropdown */}
            {searchResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  width: '280px',
                  background: cityTheme.hudBg,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${cityTheme.hudBorder}`,
                  borderRadius: '8px',
                  boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.6)' : '0 8px 24px rgba(18, 20, 26, 0.12)',
                  padding: '4px 0',
                  zIndex: 50,
                  fontSize: '11px',
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}
              >
                {searchResults.map((res, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (res.building) {
                        flyTo(res.building.x + res.building.width / 2, res.building.y + res.building.height / 2, 1.4);
                        onSelectBuilding(res.building);
                        setActiveBreadcrumbBuilding(res.building);
                        if (res.type === 'METHOD') {
                          if (res.workstationId) onSelectWorkstation(res.workstationId);
                          handleSelectEntityInternal({ type: 'WORKSTATION', name: res.name, data: res.workstation, room: res.room, building: res.building, id: res.id });
                        } else if (res.type === 'CLASS') {
                          handleSelectEntityInternal({ type: 'ROOM', name: res.name, data: res.room, building: res.building, id: res.id });
                        } else {
                          handleSelectEntityInternal({ type: 'BUILDING', name: res.building.name, data: res.building, id: res.building.id });
                        }
                      } else if (res.district) {
                        flyTo(res.district.x + res.district.width / 2, res.district.y + res.district.height / 2, 0.85);
                        handleSelectEntityInternal({ type: 'DISTRICT', name: res.district.name, data: res.district, id: res.district.id });
                      } else if (res.landmark) {
                        flyTo(res.landmark.x + (res.landmark.width || 90) / 2, res.landmark.y + (res.landmark.height || 90) / 2, 1.3);
                        handleSelectEntityInternal({ type: 'LANDMARK', name: res.landmark.name, data: res.landmark, id: res.landmark.id });
                      }
                      setSearchQuery('');
                    }}
                    style={{
                      padding: '6px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: `1px solid ${cityTheme.hudBorder}`
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '8.5px',
                          fontWeight: 700,
                          padding: '1px 4px',
                          borderRadius: '3px',
                          background: isDark ? '#1a1a23' : '#eef1f6',
                          color: '#38bdf8'
                        }}
                      >
                        {res.type}
                      </span>
                      <span style={{ fontWeight: 600, color: cityTheme.hudText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {truncate(res.name, 22)}
                      </span>
                    </div>
                    <span style={{ fontSize: '9px', color: cityTheme.hudMuted, marginLeft: '6px', flexShrink: 0 }}>
                      {truncate(res.district, 12)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Semantic Overlays & 5-Level Continuous Zoom Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Overlays Pill Group */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${cityTheme.hudBorder}`,
              borderRadius: '6px',
              padding: '2px 4px'
            }}
          >
            <span style={{ fontSize: '10px', color: cityTheme.hudMuted, fontWeight: 600, padding: '0 3px' }}>
              Overlays:
            </span>
            {[
              { key: 'CALLS', label: 'Calls', color: '#587C78' },
              { key: 'PERSISTS_TO', label: 'DB', color: '#8D916B' },
              { key: 'EXTERNAL_CALL', label: 'Ext', color: '#B77C61' },
              { key: 'EVENT_ASYNC', label: 'Async', color: '#927D91' }
            ].map(ov => (
              <button
                key={ov.key}
                onClick={() => toggleOverlay(ov.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: overlayFilters[ov.key] ? ov.color : 'transparent',
                  background: overlayFilters[ov.key] ? (isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.08)') : 'transparent',
                  color: overlayFilters[ov.key] ? ov.color : cityTheme.hudMuted,
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ov.color }} />
                {ov.label}
              </button>
            ))}

            <button
              onClick={() => setForceCutaway(!forceCutaway)}
              title="Force interior cutaways (Rooms and Workstations)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: forceCutaway ? '#C09A62' : 'transparent',
                background: forceCutaway ? (isDark ? 'rgba(192, 154, 98, 0.18)' : 'rgba(192, 154, 98, 0.15)') : 'transparent',
                color: forceCutaway ? '#C09A62' : cityTheme.hudMuted,
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Eye size={10} /> Cutaway
            </button>
          </div>

          {/* 5-Level Continuous Zoom Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${cityTheme.hudBorder}`,
              borderRadius: '6px',
              padding: '2px 4px'
            }}
          >
            {[
              { id: 1, label: '1 · Metro' },
              { id: 2, label: '2 · Dist' },
              { id: 3, label: '3 · Block' },
              { id: 4, label: '4 · Build' },
              { id: 5, label: '5 · Room' }
            ].map(lvl => (
              <button
                key={lvl.id}
                onClick={() => setLevelZoom(lvl.id)}
                style={{
                  padding: '3px 6px',
                  borderRadius: '4px',
                  border: 'none',
                  background: zoomLevel.id === lvl.id ? (isDark ? 'var(--cc-accent, #6d8cff)' : 'var(--cc-border-2, #cdd2dd)') : 'transparent',
                  color: zoomLevel.id === lvl.id ? (isDark ? '#ffffff' : '#12141a') : cityTheme.hudMuted,
                  fontSize: '10.5px',
                  fontWeight: zoomLevel.id === lvl.id ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {lvl.label}
              </button>
            ))}

            <div style={{ width: '1px', height: '14px', background: cityTheme.hudBorder, margin: '0 3px' }} />

            <span style={{ fontSize: '10.5px', color: cityTheme.hudMuted, fontWeight: 600, padding: '0 2px' }}>
              {Math.round(zoom * 100)}%
            </span>

            <button
              onClick={() => setZoom(z => Math.min(z * 1.25, 3.5))}
              title="Zoom In"
              style={{ background: 'transparent', border: 'none', color: cityTheme.hudMuted, padding: '3px', cursor: 'pointer', borderRadius: '4px', display: 'flex' }}
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(z * 0.8, 0.22))}
              title="Zoom Out"
              style={{ background: 'transparent', border: 'none', color: cityTheme.hudMuted, padding: '3px', cursor: 'pointer', borderRadius: '4px', display: 'flex' }}
            >
              <ZoomOut size={12} />
            </button>
            <button
              onClick={fitView}
              title="Fit Metropolis into Canvas"
              style={{ background: 'transparent', border: 'none', color: isDark ? '#38bdf8' : '#0278b8', padding: '3px', cursor: 'pointer', borderRadius: '4px', display: 'flex' }}
            >
              <Compass size={12} />
            </button>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              style={{ background: 'transparent', border: 'none', color: isDark ? '#38bdf8' : '#0278b8', padding: '3px', cursor: 'pointer', borderRadius: '4px', display: 'flex' }}
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2D METROPOLIS SVG CANVAS CONTAINER (Strictly Bounded)               */}
      {/* =================================================================== */}
      <div
        ref={containerRef}
        className="metropolis-canvas-container"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: cityTheme.bg,
          cursor: isDragging ? 'grabbing' : (isSpacePressed ? 'grab' : 'default')
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Impact Analysis Active Banner (Floating Pill) */}
        {impactMode?.active && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 35,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: cityTheme.hudBg,
              backdropFilter: 'blur(10px)',
              border: '1px solid #B58A4A',
              borderRadius: '8px',
              padding: '6px 14px',
              boxShadow: '0 4px 20px rgba(181, 138, 74, 0.2)',
              fontSize: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#B58A4A', fontWeight: 700 }}>⚡ Impact Mode:</span>
              <span style={{ color: cityTheme.hudText, fontWeight: 600 }}>{truncate(impactMode.targetName, 18)}</span>
              <span style={{ color: cityTheme.hudMuted }}>•</span>
              <span style={{ color: '#64836B', fontWeight: 600 }}>{impactMode.upstreamIds?.size || 0} Upstream</span>
              <span style={{ color: cityTheme.hudMuted }}>•</span>
              <span style={{ color: '#B7655D', fontWeight: 600 }}>{impactMode.downstreamIds?.size || 0} Downstream</span>
            </div>
            <button
              onClick={onClearImpactMode}
              style={{
                background: 'rgba(181, 138, 74, 0.15)',
                border: '1px solid rgba(181, 138, 74, 0.4)',
                color: '#B58A4A',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Exit Impact Mode
            </button>
          </div>
        )}

      {/* =================================================================== */}
      {/* 2D METROPOLIS SVG CANVAS (Strict Symbol Design System V1)          */}
      {/* =================================================================== */}
      <svg
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: cityTheme.bg
        }}
      >
        <defs>
          {/* Active building glowing filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="9" />
          </filter>

          {/* Drop shadow for buildings */}
          <filter id="metro-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor={isDark ? "#000000" : "#39332E"} floodOpacity={isDark ? "0.4" : "0.12"} />
          </filter>

          {/* Urban background grid */}
          <pattern id="metro-ground-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.7" fill={cityTheme.gridDot} opacity="0.6" />
          </pattern>

          {/* Hatch pattern for unsupported files */}
          <pattern id="unsupported-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke={cityTheme.hudBorder} strokeWidth="1.2" opacity="0.8" />
          </pattern>
        </defs>

        {/* Global Pan & Zoom Scaled Container */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 1. METROPOLIS GROUND & PERIMETER BOUNDARY */}
          <rect
            x={-1000}
            y={-1000}
            width={(cityBounds.width || 1200) + 2000}
            height={(cityBounds.height || 900) + 2000}
            fill={cityTheme.bg}
          />
          <rect
            x={-1000}
            y={-1000}
            width={(cityBounds.width || 1200) + 2000}
            height={(cityBounds.height || 900) + 2000}
            fill="url(#metro-ground-grid)"
          />

          {/* Metropolitan Ground Surface Perimeter */}
          <rect
            x={cityBounds.minX}
            y={cityBounds.minY}
            width={cityBounds.width}
            height={cityBounds.height}
            rx={20}
            fill={cityTheme.groundPerimeter}
            stroke={cityTheme.groundBorder}
            strokeWidth={2}
          />

          {/* 2. ORIENTATION PLAZA AT PRIMARY AVENUE ORIGIN (20, 20) */}
          <g
            id="orientation-plaza"
            transform="translate(20, 20)"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              fitView();
              handleSelectEntityInternal({ type: 'REPOSITORY', name: cityData?.repositoryName || 'Repository', data: cityData, id: cityData?.repositoryId });
            }}
          >
            <rect x={0} y={0} width={90} height={70} rx={10} fill={cityTheme.orientationFill} stroke={cityTheme.orientationBorder} strokeWidth={1.5} />
            {/* Compass Rose */}
            <circle cx={45} cy={26} r={14} fill={cityTheme.groundPerimeter} stroke={cityTheme.compassAccent} strokeWidth={1.2} />
            <path d="M 45 14 L 47 24 L 57 26 L 47 28 L 45 38 L 43 28 L 33 26 L 43 24 Z" fill={cityTheme.compassAccent} />
            <text x={45} y={11} fontSize={7} fontWeight="800" fill={cityTheme.compassAccent} textAnchor="middle">N</text>
            {/* Orientation Plaque */}
            <text x={45} y={49} fontFamily="'Geist', 'Inter', sans-serif" fontSize={7.5} fontWeight="700" letterSpacing="0.08em" fill={cityTheme.orientationText} textAnchor="middle">
              ORIENTATION PLAZA
            </text>
            <text x={45} y={60} fontFamily="'Geist', 'Inter', sans-serif" fontSize={6.5} fontWeight="600" fill={cityTheme.hudMuted} textAnchor="middle">
              ALL REQUESTS ENTER HERE
            </text>
          </g>

          {/* 3. PHYSICAL STREETS & URBAN NETWORK */}
          {showStreets && (
            <g id="physical-street-network">
              {(cityData?.streets || []).map(street => {
                const isAve = street.isAvenue || street.streetType === 'AVENUE';
                const sWidth = street.width || (isAve ? 20 : 12);
                return (
                  <g key={street.id}>
                    {/* Asphalt bed */}
                    <line
                      x1={street.x1}
                      y1={street.y1}
                      x2={street.x2}
                      y2={street.y2}
                      stroke={isDark ? (isAve ? cityTheme.roadAvenue : cityTheme.roadBed) : (street.surfaceColor || (isAve ? '#D9CFC7' : '#E6DFD7'))}
                      strokeWidth={sWidth}
                      strokeLinecap="round"
                    />
                    {/* Lane Marking Centerline for Avenues */}
                    {isAve && (
                      <line
                        x1={street.x1}
                        y1={street.y1}
                        x2={street.x2}
                        y2={street.y2}
                        stroke={cityTheme.roadCenterline}
                        strokeWidth={2}
                        strokeDasharray="8 6"
                        opacity={0.9}
                      />
                    )}
                  </g>
                );
              })}

              {/* Intersections & Junction Pads */}
              {(cityData?.intersections || []).map(inter => (
                <g key={inter.id} transform={`translate(${inter.x}, ${inter.y})`}>
                  <circle cx={0} cy={0} r={inter.radius || 14} fill={cityTheme.intersection} stroke={cityTheme.intersectionBorder} strokeWidth={1.5} />
                  {/* Traffic Signal indicator */}
                  <circle cx={0} cy={0} r={3.5} fill={cityTheme.intersectionSignal} />
                </g>
              ))}
            </g>
          )}

          {/* 4. DISTRICTS & RESERVED HEADER PLAQUES */}
          {visibleDistricts.map(d => {
            const shortTag = d.name.length >= 2 ? d.name.substring(0, 2).toUpperCase() : 'DS';
            const maxDistChars = Math.max(8, Math.floor((d.width - 130) / 7.2));
            const displayDistName = truncate(d.name, maxDistChars);

            return (
              <g
                key={d.id}
                id={`district-${d.id}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDistrictFilter(d.id);
                  flyTo(d.x + d.width / 2, d.y + d.height / 2, 0.85);
                  handleSelectEntityInternal({ type: 'DISTRICT', name: d.name, data: d, id: d.id });
                }}
              >
                {/* District Outer Boundary Card */}
                <rect
                  className="d"
                  x={d.x}
                  y={d.y}
                  width={d.width}
                  height={d.height}
                  rx={14}
                  fill={cityTheme.districtFill}
                  stroke={cityTheme.districtBorder}
                  strokeWidth={1.5}
                />
                {/* Dedicated District Header Plaque (Reserved Area - Never Collides) */}
                <g transform={`translate(${d.x + 12}, ${d.y + 10})`}>
                  {/* 2-Letter Module Tag */}
                  <rect x={0} y={0} width={24} height={20} rx={4} fill={cityTheme.districtHeaderFill} stroke={cityTheme.districtBorder} strokeWidth={1} />
                  <text x={12} y={14} fontFamily="'Geist', 'Inter', sans-serif" fontSize={10} fontWeight="800" fill={cityTheme.compassAccent} textAnchor="middle">
                    {shortTag}
                  </text>
                  {/* Uppercase District Name with Tooltip Title */}
                  <text
                    x={32}
                    y={15}
                    fontFamily="'Geist', 'Inter', sans-serif"
                    fontSize={11.5}
                    fontWeight="700"
                    letterSpacing="0.08em"
                    fill={cityTheme.districtText}
                  >
                    <title>{d.name}</title>
                    {displayDistName.toUpperCase()}
                  </text>
                  {/* File Count Badge */}
                  <rect x={d.width - 92} y={0} width={44} height={20} rx={10} fill={cityTheme.districtHeaderFill} stroke={cityTheme.districtBorder} strokeWidth={1} />
                  <text x={d.width - 70} y={14} fontFamily="'Geist Mono', 'Inter', sans-serif" fontSize={9.5} fontWeight="700" fill={cityTheme.districtSubtext} textAnchor="middle">
                    {d.buildingCount || 0} files
                  </text>
                  {/* Neighbourhood Count Badge */}
                  <rect x={d.width - 42} y={0} width={28} height={20} rx={10} fill={cityTheme.districtHeaderFill} stroke={cityTheme.districtBorder} strokeWidth={1} />
                  <text x={d.width - 28} y={14} fontFamily="'Geist Mono', 'Inter', sans-serif" fontSize={9.5} fontWeight="700" fill={cityTheme.compassAccent} textAnchor="middle">
                    {d.neighbourhoodCount || 1}N
                  </text>
                </g>
              </g>
            );
          })}

          {/* 5. NEIGHBOURHOOD BLOCKS (Dashed Boundary + Header Banner) */}
          {(cityData?.blocks || []).map(blk => {
            const maxBlkChars = Math.max(8, Math.floor((blk.width - 24) / 6.5));
            const displayBlkName = truncate(blk.name, maxBlkChars);

            return (
              <g
                key={blk.id}
                id={`block-${blk.id}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  flyTo(blk.x + blk.width / 2, blk.y + blk.height / 2, 1.2);
                  handleSelectEntityInternal({ type: 'BLOCK', name: blk.name, data: blk, id: blk.id });
                }}
              >
                <rect
                  x={blk.x}
                  y={blk.y}
                  width={blk.width}
                  height={blk.height}
                  rx={8}
                  fill={isDark ? '#14141c' : '#F4EFEA'}
                  stroke={cityTheme.districtBorder}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
                {/* Reserved Neighbourhood Title Header */}
                <g transform={`translate(${blk.x + 10}, ${blk.y + 8})`}>
                  <text
                    fontFamily="'Geist', 'Inter', sans-serif"
                    fontSize={9.5}
                    fontWeight="700"
                    letterSpacing="0.06em"
                    fill={cityTheme.districtSubtext}
                  >
                    <title>{blk.name}</title>
                    🏘️ {displayBlkName.toUpperCase()}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 6. SEMANTIC OVERLAY SOFTWARE ROADS (Overlays 1 to 8) */}
          {showDependencyOverlay && (
            <g id="semantic-software-overlays">
              {(cityData?.roads || []).map(road => {
                const rel = (road.relationshipType || 'CALLS').toUpperCase();
                if (!overlayFilters[rel] && !overlayFilters['CALLS']) return null;

                const src = (cityData.buildings || []).find(b => b.id === road.sourceBuildingId);
                const tgt = (cityData.buildings || []).find(b => b.id === road.targetBuildingId);
                if (!src || !tgt) return null;

                const x1 = src.x + src.width;
                const y1 = src.y + src.height / 2;
                const x2 = tgt.x;
                const y2 = tgt.y + tgt.height / 2;
                const midX = (x1 + x2) / 2;
                const d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;

                // Official Overlay Styling & Colors (CodeCity Visualization Palette)
                let strokeColor = '#587C78'; // Overlay 1: Method call (Muted Teal)
                let dashArray = 'none';
                let strokeWidth = 2.5;

                if (rel === 'PERSISTS_TO') {
                  strokeColor = '#8D916B'; // Overlay 2: DB (Olive)
                  strokeWidth = 3;
                } else if (rel === 'EXTERNAL_CALL') {
                  strokeColor = '#B77C61'; // Overlay 3: External (Terracotta)
                  dashArray = '6 4';
                } else if (rel === 'EVENT_ASYNC') {
                  strokeColor = '#927D91'; // Overlay 4: Async (Dusty Mauve)
                  dashArray = '5 4';
                } else if (rel === 'EXTENDS') {
                  strokeColor = '#71869B'; // Overlay 5: Inheritance (Slate Blue)
                  dashArray = '2 4';
                } else if (rel === 'IMPLEMENTS') {
                  strokeColor = '#71869B'; // Overlay 6: Implements (Slate Blue)
                  strokeWidth = 3;
                } else if (rel === 'DEPENDS_ON') {
                  strokeColor = '#71869B'; // Overlay 7: DI (Slate Blue)
                  dashArray = '6 3 2 3';
                }

                const isRoadSelected = selectedEntity?.data?.id === road.id || selectedEntity?.id === road.id;
                const isImpactRoad = impactMode?.active && (
                  (road.targetBuildingId === impactMode.targetBuildingId && impactMode.upstreamIds?.has(road.sourceBuildingId)) ||
                  (road.sourceBuildingId === impactMode.targetBuildingId && impactMode.downstreamIds?.has(road.targetBuildingId))
                );

                let roadOpacity = 0.8;
                if (impactMode?.active) {
                  roadOpacity = isImpactRoad ? 1.0 : 0.15;
                } else if (activeJourneyData != null) {
                  roadOpacity = 0.35;
                }

                return (
                  <g
                    key={road.id}
                    opacity={roadOpacity}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectEntityInternal({ type: 'ROAD', name: `${rel}: ${src.name} → ${tgt.name}`, data: road, id: road.id });
                    }}
                  >
                    {/* Road bed shadow */}
                    <path
                      d={d}
                      fill="none"
                      stroke={isImpactRoad ? '#C09A62' : (isRoadSelected ? '#C09A62' : '#D9CFC7')}
                      strokeWidth={isRoadSelected || isImpactRoad ? 14 : 10}
                      strokeLinejoin="round"
                    />
                    {/* Semantic Overlay Line */}
                    <path
                      d={d}
                      fill="none"
                      stroke={isImpactRoad ? '#C09A62' : (isRoadSelected ? '#C09A62' : strokeColor)}
                      strokeWidth={isImpactRoad ? 4 : strokeWidth}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={isImpactRoad ? '6 4' : dashArray}
                    >
                      <title>{`${road.roadName || rel} (Evidence: ${road.evidence || 'AST Resolved'})`}</title>
                    </path>
                    {/* Arrowhead */}
                    <path
                      d="M -5 -4 L 5 0 L -5 4 Z"
                      transform={`translate(${midX}, ${y2}) rotate(0)`}
                      fill={strokeColor}
                    />
                    {/* Evidence Marker Badge */}
                    <g transform={`translate(${midX}, ${(y1 + y2) / 2})`}>
                      <circle cx={0} cy={0} r={5.5} fill="#FFFFFF" stroke={strokeColor} strokeWidth={1} />
                      <text x={0} y={2.5} fontSize={6.5} fontWeight="700" fill={strokeColor} textAnchor="middle">
                        {road.evidenceLevel === 'STATIC_INFERENCE' ? 'I' : 'S'}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* 7. SELECTED REQUEST ROUTE HIGHWAY (High-contrast ochre + animated pulse) */}
          {journeyHighwayPath && (
            <g id="selected-journey-highway">
              <path d={journeyHighwayPath.d} fill="none" stroke="#D9CFC7" strokeWidth={14} strokeLinejoin="round" />
              <path d={journeyHighwayPath.d} fill="none" stroke="#C09A62" strokeWidth={18} strokeLinejoin="round" opacity={0.25} />
              <path d={journeyHighwayPath.d} fill="none" stroke="#C09A62" strokeWidth={5} strokeLinecap="round" />
              {/* Animated pulse highway */}
              <path d={journeyHighwayPath.d} fill="none" stroke="#FFFFFF" strokeWidth={3.5} strokeDasharray="11 8" strokeLinejoin="round">
                <animate attributeName="stroke-dashoffset" from="19" to="0" dur="0.9s" repeatCount="indefinite" />
              </path>
              {/* Direction arrowheads */}
              {journeyHighwayPath.points.map((pt, idx) => {
                if (idx === 0) return null;
                const prev = journeyHighwayPath.points[idx - 1];
                const midX = (prev.x + pt.x) / 2;
                return (
                  <g key={idx}>
                    <circle cx={midX} cy={prev.y} r={5} fill="#EFE9E3" stroke="#C09A62" strokeWidth={1.5} />
                    <path d="M -6 -5 L 6 0 L -6 5 Z" transform={`translate(${midX}, ${pt.y}) rotate(0)`} fill="#C09A62" />
                  </g>
                );
              })}
            </g>
          )}

          {/* 8. BUILDINGS (8 Official Footprint Shapes & Cutaways) */}
          {visibleBuildings.map(bldg => {
            const theme = getBuildingTheme(bldg);
            const isInJourney = activeJourneyData?.involvedBuildings?.has(bldg.id) || activeJourneyData?.involvedBuildings?.has(bldg.fileId);
            const isCurrentStep = activeJourneyData?.activeBuildingKey === bldg.id || activeJourneyData?.activeBuildingKey === bldg.fileId;
            const isSubdued = activeJourneyData != null && !isInJourney;
            const isSelected = selectedBuildingId === bldg.id || currentActiveBuilding?.id === bldg.id;
            const isHovered = hoveredBuilding === bldg.id;

            // Show cutaway at Zoom Level 4/5 or when hovered/selected/forced
            const showCutawayInterior = forceCutaway || zoom >= 1.35 || isHovered || isSelected || isCurrentStep;

            // Step number if along route
            let stepNum = null;
            if (activeJourneyData?.currentSteps) {
              const stepObj = activeJourneyData.currentSteps.find(s =>
                s.targetComponentKey === bldg.id ||
                s.sourceComponentKey === bldg.id ||
                s.targetComponentName === bldg.name
              );
              if (stepObj) stepNum = stepObj.stepIndex;
            }

            const cleanFileName = bldg.name;
            const ext = bldg.fileName && bldg.fileName.includes('.')
              ? bldg.fileName.substring(bldg.fileName.lastIndexOf('.'))
              : '.java';

            const shape = bldg.footprintShape || 'STANDARD_OFFICE';

            // Safe maximum character count for building label based on footprint width
            const maxBldgChars = Math.max(8, Math.floor((bldg.width - 16) / 6.2));
            const displayBldgName = truncate(cleanFileName, maxBldgChars);

            const isImpactTarget = impactMode?.active && (bldg.id === impactMode.targetBuildingId || bldg.name === impactMode.targetName);
            const isImpactUpstream = impactMode?.active && (impactMode.upstreamIds?.has(bldg.id) || impactMode.upstreamIds?.has(bldg.fileId));
            const isImpactDownstream = impactMode?.active && (impactMode.downstreamIds?.has(bldg.id) || impactMode.downstreamIds?.has(bldg.fileId));
            const isImpactDimmed = impactMode?.active && !isImpactTarget && !isImpactUpstream && !isImpactDownstream;

            const isRoadConnected = selectedEntity?.type === 'ROAD' && (selectedEntity.data?.sourceBuildingId === bldg.id || selectedEntity.data?.targetBuildingId === bldg.id);
            const isDirectlySelected = selectedEntity?.id === bldg.id || (selectedEntity?.type === 'BUILDING' && selectedEntity?.name === bldg.name);

            let buildingOpacity = 1.0;
            if (isImpactDimmed) {
              buildingOpacity = 0.22;
            } else if (isSubdued) {
              buildingOpacity = 0.35;
            }

            return (
              <g
                key={bldg.id}
                id={`building-${bldg.id}`}
                transform={`translate(${bldg.x}, ${bldg.y})`}
                opacity={buildingOpacity}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                onMouseEnter={() => setHoveredBuilding(bldg.id)}
                onMouseLeave={() => setHoveredBuilding(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBuilding(bldg);
                  setActiveBreadcrumbBuilding(bldg);
                  handleSelectEntityInternal({ type: 'BUILDING', name: bldg.name, data: bldg, id: bldg.id });
                }}
              >
                {/* Active Halo Glow / Selection Outline */}
                {(isCurrentStep || isImpactTarget || isImpactUpstream || isImpactDownstream || isRoadConnected || isDirectlySelected) && (
                  <rect
                    x={-8}
                    y={-8}
                    width={bldg.width + 16}
                    height={bldg.height + 16}
                    rx={12}
                    fill={isImpactTarget ? '#B58A4A' : (isImpactUpstream ? '#64836B' : (isImpactDownstream ? '#B7655D' : (isRoadConnected || isDirectlySelected ? '#C09A62' : '#C09A62')))}
                    opacity={0.75}
                    filter="url(#glow)"
                  />
                )}

                {/* Building Footprint Body */}
                {theme.isUnsupported ? (
                  // Unsupported File Card (Hatched Pattern)
                  <g>
                    <rect
                      x={0}
                      y={0}
                      width={bldg.width}
                      height={bldg.height}
                      rx={6}
                      fill={isDark ? "#1b1b23" : "#EFE9E3"}
                      stroke={cityTheme.hudBorder}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                    <rect x={0} y={0} width={bldg.width} height={bldg.height} rx={6} fill="url(#unsupported-hatch)" />
                    <text x={bldg.width / 2} y={bldg.height / 2 + 3} fontFamily="'Inter', sans-serif" fontSize={9.5} fontWeight="600" fill={cityTheme.hudText} textAnchor="middle">
                      <title>{bldg.fileName || bldg.name}</title>
                      {truncate(bldg.fileName || bldg.name, maxBldgChars)}
                    </text>
                  </g>
                ) : theme.isExternal ? (
                  // External Dependency Card (Dashed Terracotta Box)
                  <g>
                    <rect
                      x={0}
                      y={0}
                      width={bldg.width}
                      height={bldg.height}
                      rx={8}
                      fill="#F4EDE6"
                      stroke="#B77C61"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                    />
                    <text x={bldg.width / 2} y={bldg.height / 2 - 2} fontFamily="'Inter', sans-serif" fontSize={10} fontWeight="700" fill="#B77C61" textAnchor="middle">
                      <title>{bldg.name}</title>
                      {truncate(bldg.name, maxBldgChars)}
                    </text>
                    <text x={bldg.width / 2} y={bldg.height / 2 + 10} fontFamily="'Inter', sans-serif" fontSize={8.5} fontWeight="500" fill="#62574E" textAnchor="middle">
                      External · Third Party
                    </text>
                  </g>
                ) : (
                  // Canonical Verified Building Card
                  <g>
                    {/* Exterior Facade Base */}
                    <rect
                      x={0}
                      y={0}
                      width={bldg.width}
                      height={bldg.height}
                      rx={6}
                      fill={isCurrentStep ? '#FDFBF7' : theme.fill}
                      stroke={isCurrentStep ? '#C09A62' : (isSelected ? '#C09A62' : (bldg.isTestFile ? '#64836B' : 'none'))}
                      strokeWidth={isCurrentStep ? 3 : (isSelected ? 2 : (bldg.isTestFile ? 1.5 : 0))}
                      strokeDasharray={bldg.isTestFile ? '4 3' : 'none'}
                      filter="url(#metro-shadow)"
                    />

                    {/* Stepped Tower Portico for Wide Headquarters */}
                    {shape === 'WIDE_HEADQUARTERS' && (
                      <path d={`M ${bldg.width / 2 - 14} 0 L ${bldg.width / 2} -6 L ${bldg.width / 2 + 14} 0 Z`} fill="#62574E" />
                    )}

                    {/* Helipad for Slender Tower */}
                    {shape === 'SLENDER_TOWER' && (
                      <circle cx={bldg.width / 2} cy={12} r={8} fill="none" stroke="#62574E" strokeWidth={1.5} opacity={0.6} />
                    )}

                    {/* Atrium Glass for Campus Complex */}
                    {shape === 'CAMPUS_COMPLEX' && (
                      <rect x={12} y={8} width={bldg.width - 24} height={8} fill="#C9B59C" opacity={0.35} rx={2} />
                    )}

                    {/* Top Chips: Language (Left) & Role (Right) */}
                    <g transform="translate(6, 6)">
                      {/* Language Chip */}
                      <rect x={0} y={0} width={18} height={12} rx={3} fill="#39332E" />
                      <text x={9} y={9} fontSize={7.5} fontWeight="800" fill="#F9F8F6" textAnchor="middle">
                        {bldg.languageChip || 'JV'}
                      </text>
                      {/* Role Chip */}
                      <rect x={bldg.width - 40} y={0} width={28} height={12} rx={3} fill={theme.chipBg || '#587C78'} />
                      <text x={bldg.width - 26} y={9} fontSize={7.5} fontWeight="800" fill="#ffffff" textAnchor="middle">
                        {bldg.roleChip || 'SERV'}
                      </text>
                    </g>

                    {/* Test File Persistent Checkmark Badge */}
                    {bldg.isTestFile && (
                      <g transform={`translate(${bldg.width - 8}, ${bldg.height - 8})`}>
                        <circle cx={0} cy={0} r={6.5} fill="#64836B" />
                        <text x={0} y={3} fontSize={8} fontWeight="900" fill="#ffffff" textAnchor="middle">✓</text>
                      </g>
                    )}

                    {/* CUTAWAY INTERIOR VIEW (Levels 4 & 5) */}
                    {showCutawayInterior && bldg.rooms && bldg.rooms.length > 0 ? (
                      <g id="cutaway-interior">
                        {bldg.rooms.map((room, ri) => {
                          const maxRoomChars = Math.max(5, Math.floor((room.width - 14) / 5.6));
                          const displayRoomName = truncate(room.name, maxRoomChars);

                          return (
                            <g
                              key={room.id || ri}
                              transform={`translate(${room.x - bldg.x}, ${room.y - bldg.y})`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectWorkstation(room.id);
                                handleSelectEntityInternal({ type: 'ROOM', name: room.name, data: room, building: bldg, id: room.id });
                              }}
                            >
                              {/* Interior Room Chamber */}
                              <rect
                                x={0}
                                y={0}
                                width={room.width}
                                height={room.height}
                                rx={4}
                                fill={cityTheme.districtFill}
                                stroke={room.isInterface ? '#927D91' : (room.isAbstract ? '#B77C61' : cityTheme.hudBorder)}
                                strokeWidth={1}
                                strokeDasharray={room.isAbstract ? '3 2' : 'none'}
                              />
                              {/* Room Header Label with Tooltip */}
                              <text x={6} y={10} fontSize={8} fontWeight="700" fill={cityTheme.hudText} fontFamily="'Inter', sans-serif">
                                <title>{room.qualifiedName || room.name}</title>
                                {displayRoomName}
                              </text>
                              {/* Abstract or Interface Badge */}
                              {room.isInterface && (
                                <text x={room.width - 6} y={10} fontSize={7.5} fontWeight="800" fill="#927D91" textAnchor="end">«I»</text>
                              )}
                              {room.isAbstract && !room.isInterface && (
                                <text x={room.width - 6} y={10} fontSize={7.5} fontWeight="800" fill="#B77C61" textAnchor="end">A</text>
                              )}

                              {/* Storage Cabinets (Fields) */}
                              {room.cabinetCount > 0 && (
                                <g transform={`translate(${room.width - 14}, 14)`}>
                                  <rect x={0} y={0} width={10} height={12} rx={2} fill={cityTheme.districtHeaderFill} stroke={cityTheme.hudBorder} strokeWidth={0.8} />
                                  <line x1={2} y1={4} x2={8} y2={4} stroke={cityTheme.hudMuted} strokeWidth={0.8} />
                                  <line x1={2} y1={8} x2={8} y2={8} stroke={cityTheme.hudMuted} strokeWidth={0.8} />
                                </g>
                              )}

                              {/* Method Workstations Inside Room */}
                              {(room.workstations || []).slice(0, 4).map((ws, wi) => {
                                const maxWsChars = Math.max(4, Math.floor((ws.width - 6) / 5.2));
                                const displayWsName = truncate(ws.name, maxWsChars);

                                return (
                                  <g
                                    key={ws.id || wi}
                                    transform={`translate(${ws.x - room.x}, ${ws.y - room.y})`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectWorkstation(ws.id);
                                      handleSelectEntityInternal({ type: 'WORKSTATION', name: ws.name, data: ws, room, building: bldg, id: ws.id });
                                    }}
                                  >
                                    {/* Workstation Desk */}
                                    <rect x={0} y={0} width={ws.width || 30} height={ws.height || 18} rx={2} fill={cityTheme.districtFill} stroke={cityTheme.hudBorder} strokeWidth={0.8} />
                                    {/* Monitor Screen */}
                                    <rect x={4} y={3} width={14} height={7} rx={1} fill={ws.isConstructor ? '#71869B' : '#587C78'} />
                                    {/* Method Name with Tooltip */}
                                    <text x={4} y={15} fontSize={6.5} fontWeight="600" fill={cityTheme.hudText}>
                                      <title>{ws.signature || ws.name}</title>
                                      {displayWsName}
                                    </text>
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })}
                      </g>
                    ) : (
                      // Macro Building Face (Levels 1 to 3)
                      <g>
                        <text
                          className="b"
                          x={bldg.width / 2}
                          y={bldg.height / 2 - 2}
                          fontFamily="'Inter', sans-serif"
                          fontSize={10.5}
                          fontWeight="700"
                          fill={theme.textFill}
                          textAnchor="middle"
                        >
                          <title>{bldg.fileName || bldg.name}</title>
                          {displayBldgName}
                        </text>
                        <text
                          className="b"
                          x={bldg.width / 2}
                          y={bldg.height / 2 + 10}
                          fontFamily="'Inter', sans-serif"
                          fontSize={9}
                          fontWeight="500"
                          fill={theme.textFill}
                          opacity={0.7}
                          textAnchor="middle"
                        >
                          {ext}
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* Numbered Step Badge on Route */}
                {stepNum != null && (
                  <g transform="translate(0, 0)">
                    {isCurrentStep ? (
                      <g>
                        <circle cx={0} cy={0} r={13} fill="#C09A62" />
                        <text x={0} y={4} fontFamily="'Inter', sans-serif" fontSize={12} fontWeight="800" fill="#ffffff" textAnchor="middle">
                          {stepNum}
                        </text>
                      </g>
                    ) : stepNum < activeStepIndex ? (
                      <g>
                        <circle cx={0} cy={0} r={10} fill="#64836B" />
                        <text x={0} y={3.5} fontFamily="'Inter', sans-serif" fontSize={10} fontWeight="800" fill="#ffffff" textAnchor="middle">
                          {stepNum}
                        </text>
                      </g>
                    ) : (
                      <g>
                        <circle cx={0} cy={0} r={10} fill="#FFFFFF" stroke="#C09A62" strokeWidth={2} />
                        <text x={0} y={3.5} fontFamily="'Inter', sans-serif" fontSize={10} fontWeight="800" fill="#C09A62" textAnchor="middle">
                          {stepNum}
                        </text>
                      </g>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* 9. INFRASTRUCTURE & LANDMARKS (Data Centre, Message Hub, Clock Tower, Checkpoint, API Gateway) */}
          {showLandmarks && (cityData?.landmarks || []).map(lm => {
            const isDb = lm.landmarkType === 'DATABASE_VAULT';
            const isMsg = lm.landmarkType === 'MESSAGE_HUB';
            const isQueue = lm.landmarkType === 'QUEUE_TERMINAL';
            const isClock = lm.landmarkType === 'CLOCK_TOWER';
            const isSecurity = lm.landmarkType === 'SECURITY_CHECKPOINT';
            const isGate = lm.landmarkType === 'API_ENTRANCE_PORTAL';

            const onSelectLm = (e) => {
              if (e) e.stopPropagation();
              handleSelectEntityInternal({ type: 'LANDMARK', name: lm.name, data: lm, id: lm.id });
            };

            if (isDb) {
              return (
                <g key={lm.id} transform={`translate(${lm.x}, ${lm.y})`} style={{ cursor: 'pointer' }} onClick={onSelectLm}>
                  {/* Dual Cylinders for Database */}
                  <rect x={0} y={10} width={lm.width || 88} height={(lm.height || 74) - 10} rx={6} fill="#F0F4F1" stroke="#8D916B" strokeWidth={1.5} />
                  <ellipse cx={(lm.width || 88) / 2} cy={10} rx={(lm.width || 88) / 2} ry={10} fill="#E2EBE4" stroke="#8D916B" strokeWidth={1.5} />
                  {/* Drive Slots & Blinking LED */}
                  <line x1={14} y1={30} x2={(lm.width || 88) - 14} y2={30} stroke="#8D916B" strokeWidth={1.5} />
                  <line x1={14} y1={44} x2={(lm.width || 88) - 14} y2={44} stroke="#8D916B" strokeWidth={1.5} />
                  <circle cx={20} cy={58} r={3} fill="#64836B">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                  <text x={(lm.width || 88) / 2} y={58} fontSize={9.5} fontWeight="700" fill="#8D916B" textAnchor="middle">
                    <title>{lm.name}: {lm.description}</title>
                    DATA CENTRE
                  </text>
                </g>
              );
            }

            if (isMsg) {
              return (
                <g key={lm.id} transform={`translate(${lm.x + 40}, ${lm.y + 36})`} style={{ cursor: 'pointer' }} onClick={onSelectLm}>
                  {/* Central rotor + 4 antenna spokes */}
                  <circle cx={0} cy={0} r={24} fill="#F5F0F5" stroke="#927D91" strokeWidth={2} />
                  <circle cx={0} cy={0} r={8} fill="#927D91" />
                  <line x1={-32} y1={0} x2={32} y2={0} stroke="#927D91" strokeWidth={2} />
                  <line x1={0} y1={-32} x2={0} y2={32} stroke="#927D91" strokeWidth={2} />
                  <text x={0} y={38} fontSize={9} fontWeight="700" fill="#927D91" textAnchor="middle">
                    <title>{lm.name}: {lm.description}</title>
                    MESSAGE HUB
                  </text>
                </g>
              );
            }

            if (isQueue) {
              return (
                <g key={lm.id} transform={`translate(${lm.x}, ${lm.y})`} style={{ cursor: 'pointer' }} onClick={onSelectLm}>
                  <rect x={0} y={0} width={lm.width || 90} height={lm.height || 50} rx={6} fill="#F9F5F0" stroke="#C09A62" strokeWidth={1.5} />
                  {/* Queue Slots */}
                  {[0, 1, 2, 3].map(qi => (
                    <rect key={qi} x={10 + qi * 18} y={14} width={12} height={14} rx={2} fill="#C09A62" opacity={0.6} />
                  ))}
                  <text x={(lm.width || 90) / 2} y={40} fontSize={8.5} fontWeight="700" fill="#C09A62" textAnchor="middle">
                    <title>{lm.name}: {lm.description}</title>
                    QUEUE TERMINAL
                  </text>
                </g>
              );
            }

            if (isClock) {
              return (
                <g key={lm.id} transform={`translate(${lm.x}, ${lm.y})`} style={{ cursor: 'pointer' }} onClick={onSelectLm}>
                  <rect x={14} y={26} width={36} height={lm.height || 84} fill="#F7F1EE" stroke="#B77C61" strokeWidth={1.5} rx={4} />
                  {/* Clock Face */}
                  <circle cx={32} cy={22} r={16} fill="#EFE4E0" stroke="#B77C61" strokeWidth={2} />
                  <line x1={32} y1={22} x2={32} y2={12} stroke="#B77C61" strokeWidth={1.5} />
                  <line x1={32} y1={22} x2={40} y2={22} stroke="#B77C61" strokeWidth={1.5} />
                  <text x={32} y={55} fontSize={8.5} fontWeight="700" fill="#B77C61" textAnchor="middle">
                    <title>{lm.name}: {lm.description}</title>
                    CRON
                  </text>
                </g>
              );
            }

            if (isSecurity) {
              return (
                <g key={lm.id} transform={`translate(${lm.x}, ${lm.y})`} style={{ cursor: 'pointer' }} onClick={onSelectLm}>
                  <rect x={0} y={10} width={50} height={42} rx={4} fill="#F9F6F0" stroke="#C09A62" strokeWidth={1.5} />
                  {/* Boom Barrier Arm */}
                  <line x1={40} y1={20} x2={lm.width || 78} y2={20} stroke="#B7655D" strokeWidth={3} strokeDasharray="4 4" />
                  <text x={25} y={34} fontSize={8} fontWeight="700" fill="#C09A62" textAnchor="middle">
                    <title>{lm.name}: {lm.description}</title>
                    AUTH GATE
                  </text>
                </g>
              );
            }

            if (isGate) {
              return (
                <g key={lm.id} transform={`translate(${lm.x}, ${lm.y})`} style={{ cursor: 'pointer' }} onClick={onSelectLm}>
                  {/* Archway Pillars */}
                  <rect x={6} y={14} width={10} height={46} fill="#EFF4F4" stroke="#587C78" strokeWidth={1.2} />
                  <rect x={(lm.width || 82) - 16} y={14} width={10} height={46} fill="#EFF4F4" stroke="#587C78" strokeWidth={1.2} />
                  <path d={`M 11 16 Q ${(lm.width || 82) / 2} -4 ${(lm.width || 82) - 11} 16`} fill="none" stroke="#587C78" strokeWidth={3} />
                  <text x={(lm.width || 82) / 2} y={36} fontSize={8.5} fontWeight="800" fill="#587C78" textAnchor="middle">
                    <title>{lm.name}: {lm.description}</title>
                    API PORTAL
                  </text>
                  <text x={(lm.width || 82) / 2} y={48} fontSize={7} fontWeight="600" fill="#62574E" textAnchor="middle">
                    ENTRY GATE
                  </text>
                </g>
              );
            }

            return null;
          })}

          {/* 10. EMBEDDED ROAD TYPES LEGEND (Bottom Left of Canvas) */}
          <g id="city-road-types-legend" transform={`translate(${cityBounds.minX + 30}, ${cityBounds.maxY - 250})`}>
            <rect x={0} y={0} width={230} height={236} rx={12} fill={isDark ? "rgba(21, 21, 27, 0.95)" : "rgba(255, 255, 255, 0.95)"} stroke={cityTheme.hudBorder} strokeWidth={1.5} />
            <text x={16} y={22} fontFamily="'Inter', sans-serif" fontSize={10.5} fontWeight="700" letterSpacing="0.12em" fill={cityTheme.hudText}>
              ROAD & OVERLAY TYPES
            </text>

            <path stroke="#C09A62" strokeWidth={3.5} d="M 16 42 H 44" />
            <text x={54} y={46} fontSize={10.5} fill={cityTheme.hudText} fontFamily="'Inter', sans-serif">Selected request route</text>

            <path stroke="#71869B" strokeWidth={2.5} d="M 16 60 H 44" />
            <text x={54} y={64} fontSize={10.5} fill={cityTheme.hudText} fontFamily="'Inter', sans-serif">1. Method call (arrow = dir)</text>

            <path stroke="#8D916B" strokeWidth={3} d="M 16 78 H 44" />
            <text x={54} y={82} fontSize={10.5} fill={cityTheme.hudText} fontFamily="'Inter', sans-serif">2. Database operation</text>

            <path stroke="#B77C61" strokeWidth={2.5} strokeDasharray="5 3" d="M 16 96 H 44" />
            <text x={54} y={100} fontSize={10.5} fill={cityTheme.hudText} fontFamily="'Inter', sans-serif">3. External service</text>

            <path stroke="#927D91" strokeWidth={2.5} strokeDasharray="5 3" d="M 16 114 H 44" />
            <text x={54} y={118} fontSize={10.5} fill={cityTheme.hudText} fontFamily="'Inter', sans-serif">4. Async event (⚡)</text>

            <path stroke="#71869B" strokeWidth={2} strokeDasharray="2 3" d="M 16 132 H 44" />
            <text x={54} y={136} fontSize={10.5} fill={cityTheme.hudText} fontFamily="'Inter', sans-serif">5. Inheritance (extends)</text>

            <path stroke="#587C78" strokeWidth={3} d="M 16 150 H 44" />
            <text x={54} y={154} fontSize={10.5} fill={cityTheme.hudText} fontFamily="'Inter', sans-serif">6. Implements interface</text>

            <path stroke="#71869B" strokeWidth={2} strokeDasharray="5 2 1 2" d="M 16 168 H 44" />
            <text x={54} y={172} fontSize={10.5} fill={cityTheme.hudText} fontFamily="'Inter', sans-serif">7. Dependency injection</text>

            <text x={16} y={194} fontFamily="'Inter', sans-serif" fontSize={10} fontWeight="700" letterSpacing="0.08em" fill={cityTheme.hudText}>
              EVIDENCE BADGES
            </text>
            <circle cx={24} cy={212} r={6.5} fill={isDark ? "#1a2424" : "#EFF4F4"} stroke="#587C78" strokeWidth={1.2} />
            <text x={24} y={215} fontSize={7.5} fontWeight="700" fill="#587C78" textAnchor="middle">S</text>
            <text x={38} y={215} fontSize={10} fill={cityTheme.hudText}>Static AST</text>

            <circle cx={104} cy={212} r={6.5} fill={isDark ? "#241e24" : "#F5F0F5"} stroke="#927D91" strokeWidth={1.2} />
            <text x={104} y={215} fontSize={7.5} fontWeight="700" fill="#927D91" textAnchor="middle">I</text>
            <text x={118} y={215} fontSize={10} fill={cityTheme.hudText}>Inferred</text>
          </g>

          {/* 11. EMBEDDED ANALYSIS STATUS & FOOTPRINT LEGEND (Bottom Right) */}
          <g id="city-analysis-status-card" transform={`translate(${cityBounds.maxX - 250}, ${cityBounds.maxY - 250})`}>
            <rect x={0} y={0} width={230} height={236} rx={12} fill={isDark ? "rgba(21, 21, 27, 0.95)" : "rgba(255, 255, 255, 0.95)"} stroke={cityTheme.hudBorder} strokeWidth={1.5} />
            <text x={16} y={22} fontFamily="'Inter', sans-serif" fontSize={10.5} fontWeight="700" letterSpacing="0.12em" fill={cityTheme.hudText}>
              URBAN FOOTPRINTS & GAPS
            </text>

            <rect x={16} y={40} width={16} height={12} rx={2} fill="#587C78" />
            <text x={40} y={50} fontSize={10} fill={cityTheme.hudText}>Wide HQ (Controller / API)</text>

            <rect x={16} y={62} width={12} height={16} rx={2} fill="#71869B" />
            <text x={40} y={74} fontSize={10} fill={cityTheme.hudText}>Slender Tower (&gt;350 LOC)</text>

            <rect x={16} y={88} width={16} height={12} rx={2} fill="#8D916B" />
            <text x={40} y={98} fontSize={10} fill={cityTheme.hudText}>Storage Silo (Repo / DAO)</text>

            <circle cx={24} cy={118} r={7} fill="#927D91" />
            <text x={40} y={121} fontSize={10} fill={cityTheme.hudText}>Pavilion (Event Listener)</text>

            <rect x={16} y={136} width={16} height={12} rx={2} fill="none" stroke="#64836B" strokeWidth={1.2} strokeDasharray="3 2" />
            <text x={40} y={146} fontSize={10} fill={cityTheme.hudText}>Test Suite File (✓)</text>

            <rect x={16} y={160} width={16} height={12} rx={2} fill={isDark ? "#1b1b23" : "#EFE9E3"} stroke={cityTheme.hudBorder} strokeDasharray="3 2" />
            <text x={40} y={170} fontSize={10} fill={cityTheme.hudText}>Hatched (Unsupported)</text>

            <rect x={16} y={184} width={16} height={12} rx={2} fill="none" stroke="#B77C61" strokeWidth={1.5} strokeDasharray="4 2" />
            <text x={40} y={194} fontSize={10} fill={cityTheme.hudText}>External (Unresolved)</text>

            <text x={16} y={222} fontSize={9.5} fill={cityTheme.hudMuted} fontFamily="'Inter', sans-serif">
              Architecture determines geography.
            </text>
          </g>
        </g>
      </svg>

      {/* =================================================================== */}
      {/* INTERACTIVE OVERVIEW MINIMAP NAVIGATOR (Bottom Right)              */}
      {/* =================================================================== */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          zIndex: 35,
          background: cityTheme.hudBg,
          backdropFilter: 'blur(12px)',
          border: `1px solid ${cityTheme.hudBorder}`,
          borderRadius: '10px',
          boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.45)' : '0 4px 16px rgba(18, 20, 26, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          width: showMinimap ? '200px' : 'auto'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            borderBottom: showMinimap ? `1px solid ${cityTheme.hudBorder}` : 'none',
            background: cityTheme.hudBg,
            fontSize: '10px',
            fontWeight: 700,
            color: cityTheme.hudText,
            letterSpacing: '0.05em'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Compass size={12} style={{ color: isDark ? 'var(--cc-cyan, #38bdf8)' : 'var(--a, #3552d6)' }} />
            <span>METROPOLIS NAVIGATOR</span>
          </div>
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            style={{
              background: 'none',
              border: 'none',
              color: isDark ? 'var(--cc-cyan, #38bdf8)' : 'var(--a, #3552d6)',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: '10px',
              fontWeight: 600
            }}
          >
            {showMinimap ? 'Hide' : 'Show'}
          </button>
        </div>

        {showMinimap && (
          <div
            onClick={handleMinimapClick}
            style={{
              width: '200px',
              height: '150px',
              position: 'relative',
              cursor: 'crosshair',
              background: cityTheme.groundPerimeter
            }}
            title="Click anywhere to pan camera directly to that location"
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`${cityBounds.minX} ${cityBounds.minY} ${cityBounds.width} ${cityBounds.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* District Outlines */}
              {(cityData?.districts || []).map((d) => (
                <rect
                  key={d.id}
                  x={d.x}
                  y={d.y}
                  width={d.width}
                  height={d.height}
                  fill={d.themeColor ? `${d.themeColor}22` : (isDark ? '#23232c' : '#D9CFC7')}
                  stroke={d.themeColor || (isDark ? '#30303c' : '#C9B59C')}
                  strokeWidth={cityBounds.width * 0.003}
                  rx={8}
                />
              ))}

              {/* Viewport Frustum Rectangle */}
              <rect
                x={minimapFrustum.x}
                y={minimapFrustum.y}
                width={minimapFrustum.width}
                height={minimapFrustum.height}
                fill="rgba(109, 140, 255, 0.2)"
                stroke="var(--cc-accent, #6d8cff)"
                strokeWidth={Math.max(cityBounds.width * 0.006, 6)}
                rx={4}
              />
            </svg>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* FLOATING COMPASS PILL (Bottom Left - Non-colliding)                 */}
      {/* =================================================================== */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: cityTheme.hudBg,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${cityTheme.hudBorder}`,
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '11px',
          color: cityTheme.hudText,
          boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(18, 20, 26, 0.06)'
        }}
      >
        <Compass size={14} style={{ color: isDark ? 'var(--cc-cyan, #38bdf8)' : 'var(--a, #3552d6)' }} />
        <span style={{ fontFamily: "var(--m, 'Geist Mono', monospace)", fontWeight: 600 }}>METROPOLIS N-34</span>
        <span style={{ color: cityTheme.hudBorder }}>|</span>
        <button
          onClick={fitView}
          style={{
            background: 'none',
            border: 'none',
            color: isDark ? 'var(--cc-cyan, #38bdf8)' : 'var(--a, #3552d6)',
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0
          }}
        >
          Reset View
        </button>
        <span style={{ color: cityTheme.hudBorder }}>|</span>
        <span style={{ color: cityTheme.hudMuted, fontSize: '10px' }}>Space+Drag • F: Fit • +/-: Zoom</span>
      </div>
      </div>
    </div>
  );
};
