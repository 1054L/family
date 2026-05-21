const { createApp, ref, computed, watch } = Vue;

// 33 Gipuzkoa towns mapped to exact latitude and longitude coordinates
const TOWN_COORDINATES = {
    'AIA': [43.2356, -2.1486],
    'AIZARNAZABAL': [43.2547, -2.2351],
    'ALBIZTUR': [43.1293, -2.1378],
    'AZKOITIA': [43.1779, -2.3117],
    'AZPEITIA': [43.1833, -2.2667],
    'AIZARNA-ZESTOA': [43.2333, -2.2333],
    'ARROA-ZESTOA': [43.2500, -2.2667],
    'ARTADI-ZUMAIA': [43.2872, -2.2589],
    'ASKIZU-GETARIA': [43.2980, -2.2150],
    'BEIZAMA': [43.1311, -2.2031],
    'BIDANIA-BIDANIA-GOYAZ': [43.1375, -2.1625],
    'BIDEGOIAN': [43.1375, -2.1625],
    'DEBA': [43.2952, -2.3524],
    'ELGOIBAR': [43.2144, -2.4137],
    'ERREZIL': [43.1645, -2.2173],
    'GETARIA': [43.3032, -2.2045],
    'GOIATZ-BIDANI-GOIATZ': [43.1340, -2.1690],
    'GOIAZ-BIDEGOIAN': [43.1340, -2.1690],
    'ITZIAR-DEBA': [43.2828, -2.3278],
    'LEGAZPI': [43.0531, -2.3308],
    'LAURGAIN-AIA': [43.2380, -2.1300],
    'MENDARO': [43.2504, -2.3817],
    'MUTRIKU': [43.3075, -2.4042],
    'ORIO': [43.2797, -2.1278],
    'OIKIA-ZUMAIA': [43.2731, -2.2597],
    'URRESTILLA-AZPEITIA': [43.1650, -2.2817],
    'URRETXU': [43.0906, -2.3164],
    'ZARAUTZ': [43.2844, -2.1722],
    'ZESTOA': [43.2396, -2.2598],
    'ZESTOA-AIZARNA': [43.2333, -2.2333],
    'ZESTOA-ARROA': [43.2500, -2.2667],
    'ZUMARRAGA': [43.0861, -2.3128]
};

function getCoordinatesForTown(townName) {
    if (!townName) return null;
    const key = String(townName).toUpperCase().trim();
    return TOWN_COORDINATES[key] || null;
}

createApp({
    setup() {
        // App State
        const people = ref([]);
        const loading = ref(true);
        const currentTab = ref('tree'); // 'tree', 'filters', 'registros', 'stats'
        const focusedId = ref(null);
        
        // Navigation History
        const historyBack = ref([]);
        const historyForward = ref([]);
        
        // UI Control
        const expandedDetails = ref(true);
        
        // Filters State
        const filters = ref({
            name: '',
            town: '',
            century: ''
        });

        // Registry Table State
        const tableSearch = ref('');
        const currentPage = ref(1);
        const pageSize = 15;

        // Fetch and initialize data
        fetch('data.json')
            .then(response => response.json())
            .then(data => {
                // Pre-process years and text cleanups
                people.value = data.map(person => {
                    const parsedYear = parseBirthYear(person.year);
                    
                    let name = person.name;
                    let surname = person.surname;
                    
                    // Extract missing name/surname from fullName if they are null or blank
                    if ((!name || String(name).trim() === '') && person.fullName) {
                        const parts = person.fullName.split(',');
                        if (parts.length > 0) {
                            name = parts[0].trim();
                        }
                        if (parts.length > 1) {
                            // Extract surname by joining subsequent parts, excluding placeholder dashes
                            surname = parts.slice(1)
                                .map(p => p.trim())
                                .filter(p => p && !p.includes('---'))
                                .join(', ');
                        }
                    }
                    
                    // Safe fallbacks to guarantee these are always valid string properties
                    name = name || 'Desconocido';
                    surname = surname || '';

                    return {
                        ...person,
                        name,
                        surname,
                        birthYearNum: parsedYear,
                        // Normalize the pre-constructed fullName from JSON for ultra-robust searching
                        normalizedFullName: normalizeText(person.fullName || `${name} ${surname}`)
                    };
                });
                
                // Establish initial focus (first record or node_0)
                if (people.value.length > 0) {
                    const rootNode = people.value.find(p => p.id === 'node_0') || people.value[0];
                    focusedId.value = rootNode.id;
                }
                
                loading.value = false;
            })
            .catch(err => {
                console.error("Error cargando los datos del linaje:", err);
                loading.value = false;
            });

        // Helper functions
        function parseBirthYear(yearStr) {
            if (!yearStr) return null;
            const match = String(yearStr).match(/\d{4}/);
            return match ? parseInt(match[0]) : null;
        }

        function normalizeText(text) {
            if (!text) return '';
            let s = String(text).toLowerCase();
            s = s.replace(/[áàäâ]/g, 'a')
                 .replace(/[éèëê]/g, 'e')
                 .replace(/[íìïî]/g, 'i')
                 .replace(/[óòöô]/g, 'o')
                 .replace(/[úùüû]/g, 'u')
                 .replace(/[ñ]/g, 'n')
                 .replace(/[ç]/g, 'c');
            return s.normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Remove accents
                .replace(/[^a-z0-9]/g, " ")     // Replace punctuation with space
                .replace(/\s+/g, " ")            // Collapse spacing
                .trim();
        }

        // Fuzzy matches a name text string with a person node in database
        function findPersonByNameText(nameText) {
            if (!nameText || nameText.trim() === '' || nameText.includes('----------')) return null;
            const normalizedQuery = normalizeText(nameText);
            
            // Try to find the best match in the database
            let bestMatch = null;
            let bestScore = 0;
            
            for (const person of people.value) {
                const normalizedTarget = person.normalizedFullName;
                
                // Check exact substring or overlap
                if (normalizedTarget === normalizedQuery) {
                    return person; // Perfect match
                }
                
                // Token overlapping score
                const queryTokens = normalizedQuery.split(' ').filter(t => t.length > 2);
                const targetTokens = normalizedTarget.split(' ').filter(t => t.length > 2);
                
                if (queryTokens.length === 0) continue;
                
                let matches = 0;
                for (const token of queryTokens) {
                    if (targetTokens.includes(token)) {
                        matches++;
                    }
                }
                
                const score = matches / Math.max(queryTokens.length, targetTokens.length);
                if (score > bestScore && score >= 0.5) { // At least 50% tokens must match
                    bestScore = score;
                    bestMatch = person;
                }
            }
            
            return bestMatch;
        }

        // Active focused person computed data
        const focusedPerson = computed(() => {
            if (!focusedId.value) return {};
            return people.value.find(p => p.id === focusedId.value) || {};
        });

        // Resolve mother and father nodes (biologically corrected)
        const focusedParents = computed(() => {
            const current = focusedPerson.value;
            if (!current.id) return { father: null, mother: null };
            
            let fatherNode = null;
            let motherNode = null;
            
            // INVERTED RELATIONSHIPS CORRECTION: 
            // In data.json, parents point to their children using the parentId field.
            // So the parents of 'current' are the nodes in the database where p.parentId === current.id
            const databaseParents = people.value.filter(p => p.parentId === current.id);
            
            databaseParents.forEach(p => {
                const pName = p.name || 'Desconocido';
                const normName = normalizeText(pName + ' ' + (p.surname || ''));
                const normFather = current.father ? normalizeText(current.father) : '';
                const normMother = current.mother ? normalizeText(current.mother) : '';
                
                // If p matches the father text name, it's the father
                if (normFather && (normFather.includes(normalizeText(pName)) || normName.includes(normFather.split(' ')[0]))) {
                    fatherNode = p;
                } 
                // If p matches the mother text name, it's the mother
                else if (normMother && (normMother.includes(normalizeText(pName)) || normName.includes(normMother.split(' ')[0]))) {
                    motherNode = p;
                } 
                // Fallback to simple gender heuristic if names aren't matched perfectly
                else {
                    const maleNames = ['jose', 'joseph', 'nicolas', 'ignacio', 'luis', 'jose agustin', 'martin', 'pedro', 'manuel', 'juan', 'joanes', 'tiburcio', 'julian', 'ramos', 'ygnacio', 'joan', 'alexandro'];
                    const firstName = normalizeText(pName.split(' ')[0]);
                    if (maleNames.includes(firstName)) {
                        fatherNode = p;
                    } else {
                        motherNode = p;
                    }
                }
            });
            
            // Safe fallback: if parents aren't directly linked by parentId, try to resolve via fuzzy text search
            if (!fatherNode && current.father) {
                fatherNode = findPersonByNameText(current.father);
            }
            if (!motherNode && current.mother) {
                motherNode = findPersonByNameText(current.mother);
            }

            return {
                father: fatherNode,
                mother: motherNode
            };
        });

        const focusedParentsNames = computed(() => {
            const current = focusedPerson.value;
            if (!current.father && !current.mother) return null;
            
            const getShortName = (nameStr) => {
                if (!nameStr) return '';
                return nameStr.split(',')[0].trim();
            };

            if (current.father && current.mother) {
                return `${getShortName(current.father)} y ${getShortName(current.mother)}`;
            }
            return current.father ? getShortName(current.father) : getShortName(current.mother);
        });

        // Resolve biological children (biologically corrected)
        const focusedChildren = computed(() => {
            const current = focusedPerson.value;
            if (!current.id) return [];
            
            const childrenList = [];
            const addedIds = new Set();
            
            // INVERTED RELATIONSHIPS CORRECTION:
            // Since parents point to children, a direct lineage child 'p' will have p.id === current.parentId
            if (current.parentId) {
                const directChild = people.value.find(p => p.id === current.parentId);
                if (directChild) {
                    childrenList.push(directChild);
                    addedIds.add(directChild.id);
                }
            }
            
            // Fallback & Siblings resolution: Find any other nodes listing current as father or mother in text
            const currentShortName = current.name ? normalizeText(current.name) : '';
            
            if (currentShortName) {
                people.value.forEach(p => {
                    if (addedIds.has(p.id)) return;
                    
                    let isChild = false;
                    
                    if (p.father) {
                        const normFather = normalizeText(p.father);
                        if (normFather.includes(currentShortName)) {
                            const resolvedFather = findPersonByNameText(p.father);
                            if (resolvedFather && resolvedFather.id === current.id) {
                                isChild = true;
                            }
                        }
                    }
                    
                    if (p.mother && !isChild) {
                        const normMother = normalizeText(p.mother);
                        if (normMother.includes(currentShortName)) {
                            const resolvedMother = findPersonByNameText(p.mother);
                            if (resolvedMother && resolvedMother.id === current.id) {
                                isChild = true;
                            }
                        }
                    }
                    
                    if (isChild) {
                        childrenList.push(p);
                        addedIds.add(p.id);
                    }
                });
            }
            
            return childrenList.sort((a, b) => {
                if (a.birthYearNum && b.birthYearNum) return a.birthYearNum - b.birthYearNum;
                return 0;
            });
        });

        // Smart Spouse Detection: Detect who shares the focused children
        const focusedSpouse = computed(() => {
            const children = focusedChildren.value;
            if (children.length === 0) return null;
            
            const current = focusedPerson.value;
            
            for (const child of children) {
                let spouseNameText = null;
                
                // If current focused person is the father, spouse is the mother
                if (child.father && normalizeText(child.father).includes(normalizeText(current.name))) {
                    spouseNameText = child.mother;
                } 
                // If current focused person is the mother, spouse is the father
                else if (child.mother && normalizeText(child.mother).includes(normalizeText(current.name))) {
                    spouseNameText = child.father;
                }
                
                if (spouseNameText && spouseNameText.trim() !== '') {
                    const spouseNode = findPersonByNameText(spouseNameText);
                    if (spouseNode && spouseNode.id !== current.id) {
                        return spouseNode; // Return first valid spouse found
                    }
                }
            }
            
            return null;
        });

        // Navigation Actions
        function focusPerson(id, pushHistory = true) {
            if (!id) return;
            
            if (pushHistory && focusedId.value && focusedId.value !== id) {
                historyBack.value.push(focusedId.value);
                historyForward.value = []; // Clear forward history on new navigation
            }
            
            focusedId.value = id;
            currentTab.value = 'tree';
            expandedDetails.value = true;
            
            // Smooth scroll to top of tree canvas on navigation
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        // History Back & Forward computed properties
        const canGoBack = computed(() => historyBack.value.length > 0);
        const canGoForward = computed(() => historyForward.value.length > 0);

        function goBack() {
            if (canGoBack.value) {
                const prev = historyBack.value.pop();
                historyForward.value.push(focusedId.value);
                focusedId.value = prev;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        function goForward() {
            if (canGoForward.value) {
                const next = historyForward.value.pop();
                historyBack.value.push(focusedId.value);
                focusedId.value = next;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        function resetToRoot() {
            const root = people.value.find(p => p.id === 'node_0') || people.value[0];
            if (root) {
                focusPerson(root.id);
            }
        }

        // Format dates beautifully
        function formatDate(dateStr) {
            if (!dateStr) return 'Fecha no registrada';
            const parts = dateStr.split('-');
            if (parts.length < 3) return dateStr;
            
            const months = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            
            const day = parseInt(parts[2]);
            const monthIdx = parseInt(parts[1]) - 1;
            const year = parts[0];
            
            if (isNaN(day) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) {
                return dateStr;
            }
            
            return `${day} de ${months[monthIdx]} de ${year}`;
        }

        function formatLifeYears(person) {
            if (!person || !person.year) return 'Años desconocidos';
            const birth = person.year.substring(0, 4);
            return `Nac: ${birth}`;
        }

        function toggleDetails() {
            expandedDetails.value = !expandedDetails.value;
        }

        // FILTERS AND SEARCH
        const uniqueTowns = computed(() => {
            const towns = people.value.map(p => p.town).filter(Boolean);
            return [...new Set(towns)].sort();
        });

        const filteredPeople = computed(() => {
            return people.value.filter(p => {
                // 1. Name query filter (robust word-by-word token matching)
                if (filters.value.name) {
                    const queryWords = normalizeText(filters.value.name).split(' ').filter(w => w.length > 0);
                    const match = queryWords.every(word => p.normalizedFullName.includes(word));
                    if (!match) {
                        return false;
                    }
                }
                
                // 2. Town filter
                if (filters.value.town && p.town !== filters.value.town) {
                    return false;
                }
                
                // 3. Century filter
                if (filters.value.century) {
                    if (!p.birthYearNum) return false;
                    const centuryStart = parseInt(filters.value.century) * 100;
                    const centuryEnd = centuryStart + 99;
                    if (p.birthYearNum < centuryStart || p.birthYearNum > centuryEnd) {
                        return false;
                    }
                }
                
                return true;
            });
        });

        function clearFilters() {
            filters.value.name = '';
            filters.value.town = '';
            filters.value.century = '';
        }

        // REGISTRY TABLE (PAGINATED & SEARCHABLE)
        const tableFilteredPeople = computed(() => {
            if (!tableSearch.value || tableSearch.value.trim() === '') {
                return people.value;
            }
            const queryWords = normalizeText(tableSearch.value).split(' ').filter(w => w.length > 0);
            return people.value.filter(p => {
                return queryWords.every(word => p.normalizedFullName.includes(word));
            });
        });

        const totalPages = computed(() => {
            return Math.ceil(tableFilteredPeople.value.length / pageSize) || 1;
        });

        const paginatedPeople = computed(() => {
            const start = (currentPage.value - 1) * pageSize;
            const end = start + pageSize;
            return tableFilteredPeople.value.slice(start, end);
        });

        // Reset page number on search
        watch(tableSearch, () => {
            currentPage.value = 1;
        });

        // ANALYTICAL DEMOGRAPHICS STATISTICS
        const stats = computed(() => {
            if (people.value.length === 0) {
                return {
                    totalTowns: 0,
                    oldestYear: '-',
                    newestYear: '-',
                    townDistribution: [],
                    centuryDistribution: []
                };
            }

            const totalCount = people.value.length;
            const validYears = people.value.map(p => p.birthYearNum).filter(Boolean);
            const oldest = validYears.length > 0 ? Math.min(...validYears) : '-';
            const newest = validYears.length > 0 ? Math.max(...validYears) : '-';

            // Town distribution
            const townMap = {};
            people.value.forEach(p => {
                if (p.town) {
                    townMap[p.town] = (townMap[p.town] || 0) + 1;
                }
            });

            const uniqueTownsCount = Object.keys(townMap).length;
            const townDistribution = Object.keys(townMap)
                .map(name => {
                    const count = townMap[name];
                    return {
                        name,
                        count,
                        percentage: Math.round((count / totalCount) * 100)
                    };
                })
                .sort((a, b) => b.count - a.count)
                .slice(0, 5); // Top 5 towns

            // Century distribution
            const centuryMap = {
                'Siglo XVI (1500 - 1599)': 0,
                'Siglo XVII (1600 - 1699)': 0,
                'Siglo XVIII (1700 - 1799)': 0,
                'Siglo XIX (1800 - 1899)': 0,
                'Siglo XX (1900 - 1999)': 0
            };

            people.value.forEach(p => {
                if (p.birthYearNum) {
                    if (p.birthYearNum >= 1500 && p.birthYearNum < 1600) centuryMap['Siglo XVI (1500 - 1599)']++;
                    else if (p.birthYearNum >= 1600 && p.birthYearNum < 1700) centuryMap['Siglo XVII (1600 - 1699)']++;
                    else if (p.birthYearNum >= 1700 && p.birthYearNum < 1800) centuryMap['Siglo XVIII (1700 - 1799)']++;
                    else if (p.birthYearNum >= 1800 && p.birthYearNum < 1900) centuryMap['Siglo XIX (1800 - 1899)']++;
                    else if (p.birthYearNum >= 1900 && p.birthYearNum < 2000) centuryMap['Siglo XX (1900 - 1999)']++;
                }
            });

            const centuryDistribution = Object.keys(centuryMap)
                .map(name => {
                    const count = centuryMap[name];
                    return {
                        name,
                        count,
                        percentage: Math.round((count / totalCount) * 100)
                    };
                })
                .filter(c => c.count > 0);

            return {
                totalTowns: uniqueTownsCount,
                oldestYear: oldest,
                newestYear: newest,
                townDistribution,
                centuryDistribution
            };
        });

        // Leaflet Map integration
        let mapInstance = null;
        let markersGroup = null;

        function initLeafletMap() {
            if (mapInstance) {
                try {
                    mapInstance.remove();
                } catch (e) {
                    console.error("Error standardizing map removal:", e);
                }
                mapInstance = null;
            }

            const canvas = document.getElementById('map-canvas');
            if (!canvas) return;

            // Wait if the element is not yet rendered or has 0 dimensions
            if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
                setTimeout(initLeafletMap, 50);
                return;
            }

            // Initialize map (don't set view yet to prevent dimension-calculation glitches)
            // Initialize map with a safe default view in Guipúzcoa (Azpeitia center) to prevent uninitialized sea drift
            mapInstance = L.map('map-canvas', {
                center: [43.1833, -2.2667],
                zoom: 10,
                zoomControl: true,
                maxZoom: 18,
                minZoom: 8
            });

            // Add elegant CartoDB Voyager tiles matching the premium Stitch aesthetic
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(mapInstance);

            markersGroup = L.layerGroup().addTo(mapInstance);

            renderMapMarkers();

            // Force size recalculation and center AFTER layout has settled to prevent flying to [0,0]
            setTimeout(() => {
                if (mapInstance) {
                    mapInstance.invalidateSize({ animate: false });
                    
                    // Safely zoom/highlight to focused person or fit bounds INSTANTLY (animate: false) to prevent fly-to-sea
                    if (focusedPerson.value && focusedPerson.value.town) {
                        highlightFocusedPersonOnMap(false);
                    } else {
                        resetMapZoom(false);
                    }
                }
            }, 100);
        }

        function renderMapMarkers() {
            if (!markersGroup || !people.value) return;
            markersGroup.clearLayers();

            // Group people by town
            const peopleByTown = {};
            people.value.forEach(p => {
                if (p.town) {
                    const normTown = p.town.trim();
                    if (!peopleByTown[normTown]) {
                        peopleByTown[normTown] = [];
                    }
                    peopleByTown[normTown].push(p);
                }
            });

            // Add markers
            Object.keys(peopleByTown).forEach(townName => {
                const coords = getCoordinatesForTown(townName);
                if (!coords) return;

                const townPeople = peopleByTown[townName];
                const count = townPeople.length;

                const isFocusedTown = focusedPerson.value && focusedPerson.value.town && 
                                      normalizeText(focusedPerson.value.town) === normalizeText(townName);

                let markerClass = 'custom-town-marker-wrapper';
                if (isFocusedTown) {
                    markerClass += ' focused focused-pulse-marker';
                }

                const customIcon = L.divIcon({
                    className: markerClass,
                    html: `<div class="marker-bubble"><span>${count}</span></div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                    popupAnchor: [0, -16]
                });

                const marker = L.marker(coords, { icon: customIcon });

                let popupHtml = `
                    <div class="p-2 max-w-[260px] font-sans">
                        <h4 class="font-serif font-bold text-[#182820] text-sm border-b border-[#c3c8c3] pb-1 mb-2 flex justify-between items-center">
                            <span>${townName}</span>
                            <span class="bg-[#d4e7da] text-[#0e1f17] text-[10px] px-2 py-0.5 rounded-full font-sans font-semibold">${count} personas</span>
                        </h4>
                        <div class="max-h-[180px] overflow-y-auto pr-1 scroll-hide">
                            <ul class="space-y-1.5">
                `;

                const sortedTownPeople = [...townPeople].sort((a, b) => {
                    if (a.birthYearNum && b.birthYearNum) return a.birthYearNum - b.birthYearNum;
                    const nameA = String(a.name || '').trim();
                    const nameB = String(b.name || '').trim();
                    return nameA.localeCompare(nameB);
                });

                sortedTownPeople.forEach(p => {
                    const yearStr = p.year ? p.year.substring(0, 4) : 'Desconocido';
                    const displayName = `${p.name} ${p.surname}`.trim() || 'Nombre desconocido';
                    popupHtml += `
                        <li class="text-xs">
                            <a href="javascript:void(0);" onclick="window.focusFromMap('${p.id}')" class="hover:underline text-[#334d38] hover:text-[#182820] font-semibold flex justify-between items-center gap-2">
                                <span class="truncate max-w-[160px]">${displayName}</span>
                                <span class="text-[10px] text-gray-500 font-normal font-mono">(${yearStr})</span>
                            </a>
                        </li>
                    `;
                });

                popupHtml += `
                            </ul>
                        </div>
                    </div>
                `;

                marker.bindPopup(popupHtml, { autoPan: false });
                markersGroup.addLayer(marker);
            });
        }

        function highlightFocusedPersonOnMap(animate = true) {
            if (!mapInstance || !focusedPerson.value || !focusedPerson.value.town) return;

            const coords = getCoordinatesForTown(focusedPerson.value.town);
            if (!coords) return;

            // Set view with optional smooth transition
            mapInstance.setView(coords, 12, { animate: animate, duration: animate ? 1.0 : 0 });

            // Trigger marker popup open
            if (markersGroup) {
                markersGroup.eachLayer(layer => {
                    const latlng = layer.getLatLng();
                    if (Math.abs(latlng.lat - coords[0]) < 0.0001 && Math.abs(latlng.lng - coords[1]) < 0.0001) {
                        setTimeout(() => {
                            layer.openPopup();
                        }, animate ? 500 : 50);
                    }
                });
            }
        }

        function goToMapForFocusedPerson() {
            if (!focusedPerson.value || !focusedPerson.value.town) return;
            if (currentTab.value === 'map') {
                highlightFocusedPersonOnMap(true);
            } else {
                currentTab.value = 'map';
            }
        }

        function resetMapZoom(animate = true) {
            if (!mapInstance || !people.value) return;

            const bounds = [];
            people.value.forEach(p => {
                if (p.town) {
                    const coords = getCoordinatesForTown(p.town);
                    if (coords) {
                        bounds.push(coords);
                    }
                }
            });

            if (bounds.length > 0) {
                mapInstance.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 12,
                    animate: animate
                });
            }
        }

        // Global bridge for Leaflet raw HTML links to Vue scope
        window.focusFromMap = (id) => {
            focusPerson(id);
        };

        // Watchers for Map Updates
        watch(currentTab, (newTab) => {
            if (newTab === 'map') {
                setTimeout(() => {
                    initLeafletMap();
                }, 200);
            }
        });

        watch(focusedId, () => {
            if (currentTab.value === 'map' && mapInstance) {
                renderMapMarkers();
                highlightFocusedPersonOnMap(true);
            }
        });

        return {
            people,
            loading,
            currentTab,
            focusedId,
            focusedPerson,
            focusedParents,
            focusedParentsNames,
            focusedChildren,
            focusedSpouse,
            
            // Navigation
            focusPerson,
            
            // History
            canGoBack,
            canGoForward,
            goBack,
            goForward,
            resetToRoot,
            
            // UI
            expandedDetails,
            toggleDetails,
            
            // Formatter
            formatDate,
            formatLifeYears,
            
            // Filters
            filters,
            uniqueTowns,
            filteredPeople,
            clearFilters,
            
            // Registry Table
            tableSearch,
            currentPage,
            totalPages,
            paginatedPeople,
            
            // Demographics Stats
            stats,

            // Leaflet Map integration
            goToMapForFocusedPerson,
            resetMapZoom
        };
    }
}).mount('#app');
