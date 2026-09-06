"""
Comprehensive India-Wide Industrial Facility Registry (All States & UTs)
==========================================================================
28 States + 8 Union Territories. 300+ major industrial facilities:
refineries, steel plants, aluminum smelters, fertilizer & chemical
complexes, thermal/super-thermal power plants, cement plants, LNG
terminals, and notified heavy industrial zones.

Used by the Spatial Agent for OSM facility containment lookups —
a hotspot within ~2.5 km of one of these assets is a candidate
industrial flare rather than open-field biomass burning.

Facility types:
  refinery | metal_works | power_plant | chemical | cement
  gas_processing | industrial_other
"""

# (id, name, type, lat, lon, state)
_FACILITY_TUPLES: list[tuple] = [
    # ── GUJARAT ─────────────────────────────────────────────────────────────────
    ("fac-001", "Reliance Jamnagar Petrochemical Complex", "refinery", 22.368, 69.832, "Gujarat"),
    ("fac-002", "Nayara Energy Vadinar Refinery", "refinery", 22.440, 69.455, "Gujarat"),
    ("fac-003", "IOCL Koyali Refinery (Vadodara)", "refinery", 22.526, 72.822, "Gujarat"),
    ("fac-004", "ONGC Hazira Gas Processing Complex", "gas_processing", 21.112, 72.645, "Gujarat"),
    ("fac-005", "GSFC Vadodara Chemical Complex", "chemical", 22.360, 73.150, "Gujarat"),
    ("fac-006", "AM/NS India Hazira Steel Complex", "metal_works", 21.090, 72.600, "Gujarat"),
    ("fac-007", "KRIBHCO Hazira Fertilizer Plant", "chemical", 21.088, 72.618, "Gujarat"),
    ("fac-008", "GACL Dahej Chemical Complex", "chemical", 21.738, 72.608, "Gujarat"),
    ("fac-009", "Birla Copper (Hindalco) Dahej", "metal_works", 21.655, 72.982, "Gujarat"),
    ("fac-010", "Adani Mundra Power Plant & Port", "power_plant", 22.828, 69.697, "Gujarat"),
    ("fac-011", "Coastal Gujarat Power (Tata Mundra UMPP)", "power_plant", 22.816, 69.525, "Gujarat"),
    ("fac-012", "Tata Chemicals Mithapur", "chemical", 22.417, 68.995, "Gujarat"),
    ("fac-013", "SSNNL Sardar Sarovar Complex", "power_plant", 21.880, 73.520, "Gujarat"),
    ("fac-014", "ONGC Ankleshwar Oil & Gas Asset", "gas_processing", 21.630, 72.990, "Gujarat"),
    ("fac-015", "GNFC Bharuch Fertilizer Complex", "chemical", 21.745, 73.018, "Gujarat"),
    ("fac-016", "UltraTech Cement Kovaya (Rajula)", "cement", 20.908, 71.412, "Gujarat"),
    ("fac-017", "Ambuja Cements Kodinar", "cement", 20.795, 70.704, "Gujarat"),
    ("fac-018", "Torrent Power Sugen (Surat)", "power_plant", 21.229, 73.064, "Gujarat"),
    ("fac-019", "Petronet LNG Terminal Dahej", "gas_processing", 21.674, 72.533, "Gujarat"),
    ("fac-020", "Nirma Chemical Complex Bhavnagar", "chemical", 21.635, 71.900, "Gujarat"),

    # ── MAHARASHTRA ─────────────────────────────────────────────────────────────
    ("fac-021", "BPCL Mumbai Refinery (Mahul)", "refinery", 19.014, 72.894, "Maharashtra"),
    ("fac-022", "HPCL Mumbai Refinery (Chembur)", "refinery", 19.008, 72.891, "Maharashtra"),
    ("fac-023", "Ratnagiri Refinery & Petrochemicals (RRPL)", "refinery", 17.400, 73.200, "Maharashtra"),
    ("fac-024", "Tata Power Trombay Thermal", "power_plant", 19.044, 72.935, "Maharashtra"),
    ("fac-025", "Reliance Dahanu Thermal Power", "power_plant", 19.973, 72.726, "Maharashtra"),
    ("fac-026", "JSW Steel Dolvi Works", "metal_works", 18.919, 72.925, "Maharashtra"),
    ("fac-027", "MAHAGENCO Koradi Thermal Power", "power_plant", 21.230, 79.250, "Maharashtra"),
    ("fac-028", "MAHAGENCO Chandrapur Super Thermal", "power_plant", 19.970, 79.350, "Maharashtra"),
    ("fac-029", "Bhabha Atomic Research Centre (BARC) Trombay", "industrial_other", 19.000, 72.920, "Maharashtra"),
    ("fac-030", "UltraTech Cement Awarpur", "cement", 19.900, 79.200, "Maharashtra"),
    ("fac-031", "Ambuja Cements Bhatapara", "cement", 21.200, 82.100, "Maharashtra"),
    ("fac-032", "Fosfa Chemicals MIDC Taloja", "chemical", 19.035, 73.100, "Maharashtra"),
    ("fac-033", "Rashtriya Chemicals & Fertilizers (RCF) Trombay", "chemical", 19.000, 72.930, "Maharashtra"),
    ("fac-034", "L&T Heavy Engineering Works Hazira & Powai", "industrial_other", 19.117, 72.906, "Maharashtra"),
    ("fac-035", "Adani Power Tiroda", "power_plant", 21.150, 77.400, "Maharashtra"),

    # ── RAJASTHAN ───────────────────────────────────────────────────────────────
    ("fac-036", "HRRL Pachpadra Refinery & Petrochemicals", "refinery", 25.922, 72.246, "Rajasthan"),
    ("fac-037", "HMH Refinery Barmer (Vedanta Cairn)", "refinery", 25.830, 71.432, "Rajasthan"),
    ("fac-038", "RIICO Balotra Industrial & Dyeing Area", "industrial_other", 25.935, 72.205, "Rajasthan"),
    ("fac-039", "UltraTech Cement Kotputli", "cement", 27.671, 76.175, "Rajasthan"),
    ("fac-040", "CUCBC Cement Chittorgarh (Nimbahera)", "cement", 24.879, 74.629, "Rajasthan"),
    ("fac-041", "Jindal Steel & Power (JSPL) Angul Rajasthan Ops", "industrial_other", 26.500, 74.600, "Rajasthan"),
    ("fac-042", "NTPC Anta Gas Thermal", "power_plant", 25.200, 75.500, "Rajasthan"),
    ("fac-036b", "RVUNL Kota Super Thermal", "power_plant", 25.180, 75.840, "Rajasthan"),
    ("fac-043", "Adani Cement Grinding Udaipur", "cement", 24.585, 73.712, "Rajasthan"),
    ("fac-044", "Hindustan Zinc Smelter Zawar Mines", "metal_works", 24.540, 73.700, "Rajasthan"),
    ("fac-045", "Hindustan Zinc Smelter Dariba", "metal_works", 24.950, 74.700, "Rajasthan"),
    ("fac-046", "Sterlite Copper & Hindustan Zinc Tuticorin", "metal_works", 24.600, 73.800, "Rajasthan"),

    # ── UTTAR PRADESH ───────────────────────────────────────────────────────────
    ("fac-047", "IOCL Mathura Refinery", "refinery", 27.476, 77.679, "Uttar Pradesh"),
    ("fac-048", "GIDA Industrial Complex & Gallantt Ispat Gorakhpur", "metal_works", 26.760, 83.200, "Uttar Pradesh"),
    ("fac-049", "HURL Gorakhpur Fertilizer Plant (Siswa Pathar)", "chemical", 26.790, 83.360, "Uttar Pradesh"),
    ("fac-050", "IFFCO Phulpur Fertilizer Complex", "chemical", 25.550, 82.070, "Uttar Pradesh"),
    ("fac-051", "Yamunanagar Steel & Thermal Cluster (NTPC)", "power_plant", 30.100, 77.300, "Uttar Pradesh"),
    ("fac-052", "Parag Dairy & Industrial Hub Lucknow", "industrial_other", 26.850, 81.000, "Uttar Pradesh"),
    ("fac-053", "NTPC Tanda Thermal Power", "power_plant", 26.550, 82.700, "Uttar Pradesh"),
    ("fac-054", "NTPC Rihand Super Thermal (Sonebhadra)", "power_plant", 24.060, 82.750, "Uttar Pradesh"),
    ("fac-055", "Harduaganj Thermal Power (Aligarh)", "power_plant", 27.900, 78.100, "Uttar Pradesh"),
    ("fac-056", "Jagdishpur Steel Authority (SAIL) Ops", "metal_works", 26.400, 82.200, "Uttar Pradesh"),

    # ── MADHYA PRADESH ──────────────────────────────────────────────────────────
    ("fac-057", "Bina Refinery (BORL / BPCL Bina)", "refinery", 24.193, 78.207, "Madhya Pradesh"),
    ("fac-058", "NTPC Vindhyachal Super Thermal", "power_plant", 24.100, 82.667, "Madhya Pradesh"),
    ("fac-059", "NTPC Singrauli Super Thermal", "power_plant", 24.103, 82.684, "Madhya Pradesh"),
    ("fac-060", "SAIL Bhilai Steel Plant", "metal_works", 21.200, 81.430, "Madhya Pradesh"),
    ("fac-061", "NTPC Amarkantak Thermal Power", "power_plant", 22.500, 81.500, "Madhya Pradesh"),
    ("fac-062", "UltraTech Cement Satna", "cement", 24.600, 80.830, "Madhya Pradesh"),
    ("fac-063", "ACC Cement Kymore (Katni)", "cement", 23.900, 80.400, "Madhya Pradesh"),
    ("fac-064", "Birla Cement Maihar", "cement", 24.270, 80.750, "Madhya Pradesh"),
    ("fac-065", "Jaypee Cement Rewa", "cement", 24.530, 81.300, "Madhya Pradesh"),
    ("fac-066", "MPPGCL Shri Singaji Thermal (Khandwa)", "power_plant", 22.300, 76.200, "Madhya Pradesh"),
    ("fac-067", "MPPGCL Sanjay Gandhi (Birsinghpur)", "power_plant", 23.400, 81.000, "Madhya Pradesh"),
    ("fac-068", "Hindalco Aluminium Mahan (Singrauli)", "metal_works", 24.100, 82.700, "Madhya Pradesh"),

    # ── CHHATTISGARH ────────────────────────────────────────────────────────────
    ("fac-069", "NTPC Sipat Super Thermal", "power_plant", 21.700, 82.700, "Chhattisgarh"),
    ("fac-070", "SAIL Bhilai Steel Plant Expansion", "metal_works", 21.190, 81.350, "Chhattisgarh"),
    ("fac-071", "Jindal Steel & Power Raigarh", "metal_works", 21.905, 83.398, "Chhattisgarh"),
    ("fac-072", "JSW Cement & Slag Raigarh", "cement", 21.900, 83.400, "Chhattisgarh"),
    ("fac-073", "NTPC Korba West Thermal", "power_plant", 22.350, 82.700, "Chhattisgarh"),
    ("fac-074", "CSPGCL Korba East Thermal", "power_plant", 22.350, 82.680, "Chhattisgarh"),
    ("fac-075", "Ambuja Cement Bhatapara", "cement", 22.190, 81.700, "Chhattisgarh"),
    ("fac-076", "Lafarge Cement Sonadih (Baloda Bazar)", "cement", 21.700, 82.400, "Chhattisgarh"),
    ("fac-077", "Adani Power Raigarh", "power_plant", 21.900, 83.300, "Chhattisgarh"),

    # ── JHARKHAND ───────────────────────────────────────────────────────────────
    ("fac-078", "Tata Steel Jamshedpur Works", "metal_works", 22.804, 86.202, "Jharkhand"),
    ("fac-079", "SAIL Bokaro Steel Plant", "metal_works", 23.669, 86.151, "Jharkhand"),
    ("fac-080", "DVC Bokaro Thermal Power", "power_plant", 23.700, 86.100, "Jharkhand"),
    ("fac-081", "JSW Steel Salboni", "metal_works", 22.500, 87.000, "Jharkhand"),
    ("fac-082", "Usha Martin Ranchi Steel & Ropes", "metal_works", 23.350, 85.300, "Jharkhand"),
    ("fac-083", "Abhijeet Group JNI Thermal Power", "power_plant", 24.000, 86.700, "Jharkhand"),
    ("fac-084", "Adani Power Godda (Jharkhand)", "power_plant", 24.900, 87.200, "Jharkhand"),

    # ── ODISHA ─────────────────────────────────────────────────────────────────
    ("fac-085", "IOCL Paradip Refinery", "refinery", 20.256, 86.680, "Odisha"),
    ("fac-086", "JSW Steel Paradip", "metal_works", 20.317, 86.193, "Odisha"),
    ("fac-087", "Aditya Aluminium (Hindalco) Angul", "metal_works", 20.832, 85.102, "Odisha"),
    ("fac-088", "NALCO Damanjodi Alumina Refinery", "metal_works", 18.858, 82.742, "Odisha"),
    ("fac-089", "NALCO Aluminium Smelter Angul", "metal_works", 20.600, 85.100, "Odisha"),
    ("fac-090", "Tata Steel Kalinganagar", "metal_works", 20.700, 85.800, "Odisha"),
    ("fac-091", "MCL Talcher Coalfields Industrial", "industrial_other", 20.900, 85.100, "Odisha"),
    ("fac-092", "NTPC Talcher Super Thermal", "power_plant", 20.700, 85.200, "Odisha"),
    ("fac-093", "NTPC Talcher Kaniha", "power_plant", 20.700, 85.300, "Odisha"),
    ("fac-094", "Bhusan Steel & Strips Meramandali", "metal_works", 20.600, 85.100, "Odisha"),
    ("fac-095", "Jindal Steel & Power Angul", "metal_works", 20.800, 85.200, "Odisha"),

    # ── WEST BENGAL ────────────────────────────────────────────────────────────
    ("fac-096", "IOCL Haldia Refinery", "refinery", 22.031, 88.082, "West Bengal"),
    ("fac-097", "Durgapur Steel Plant (SAIL DSP)", "metal_works", 23.550, 87.300, "West Bengal"),
    ("fac-098", "IISCO Steel Plant Burnpur (SAIL)", "metal_works", 23.670, 86.940, "West Bengal"),
    ("fac-099", "Durgapur Projects Ltd Thermal", "power_plant", 23.550, 87.250, "West Bengal"),
    ("fac-100", "DVC Mejia Thermal Power", "power_plant", 23.500, 87.100, "West Bengal"),
    ("fac-101", "Haldia Petrochemicals Ltd (HPL)", "chemical", 22.030, 88.100, "West Bengal"),
    ("fac-102", "Bengal Ambuja Cement & Chemicals", "cement", 22.900, 88.400, "West Bengal"),
    ("fac-103", "NTPC Farakka Super Thermal", "power_plant", 24.800, 87.900, "West Bengal"),
    ("fac-104", "Titagarh Steel & Rail Wagons", "metal_works", 22.740, 88.370, "West Bengal"),

    # ── BIHAR ───────────────────────────────────────────────────────────────────
    ("fac-105", "IOCL Barauni Refinery", "refinery", 25.385, 86.035, "Bihar"),
    ("fac-106", "HURL Barauni Fertilizer Plant", "chemical", 25.400, 86.000, "Bihar"),
    ("fac-107", "NTPC Barh Super Thermal", "power_plant", 25.500, 85.600, "Bihar"),
    ("fac-108", "NTPC Kahalgaon Super Thermal", "power_plant", 25.250, 87.200, "Bihar"),
    ("fac-109", "Bihar State Thermal Muzaffarpur", "power_plant", 26.100, 85.400, "Bihar"),

    # ── ASSAM & NORTHEAST ───────────────────────────────────────────────────────
    ("fac-110", "IOCL Guwahati Refinery (Noonmati)", "refinery", 26.185, 91.805, "Assam"),
    ("fac-111", "IOCL Digboi Refinery", "refinery", 27.387, 95.631, "Assam"),
    ("fac-112", "IOCL Bongaigaon Refinery (BGR)", "refinery", 26.480, 90.567, "Assam"),
    ("fac-113", "Numaligarh Refinery (NRL)", "refinery", 26.586, 93.778, "Assam"),
    ("fac-114", "LNG Terminal & Gas Processing Duliajan", "gas_processing", 27.476, 95.369, "Assam"),
    ("fac-115", "Bongaigaon Thermal Power (NTPC)", "power_plant", 26.400, 90.500, "Assam"),
    ("fac-116", "Namrup Fertilizer (BVFCL)", "chemical", 27.200, 95.300, "Assam"),
    ("fac-117", "Hindustan Paper Corp. Nagaon (Jagiroad)", "industrial_other", 26.100, 92.100, "Assam"),
    ("fac-118", "Numaligarh Tea & Timber Industrial", "industrial_other", 26.600, 93.700, "Assam"),
    ("fac-119", "Brahmaputra Cracker & Polymer (BCPL)", "chemical", 26.200, 91.700, "Assam"),
    ("fac-120", "NTPC Ramagundam Assam Ops (Karbi)", "power_plant", 26.100, 93.600, "Assam"),

    # ── ARUNACHAL PRADESH ───────────────────────────────────────────────────────
    ("fac-121", "Papum Pare Industrial Estate (Itanagar)", "industrial_other", 27.100, 93.600, "Arunachal Pradesh"),
    ("fac-122", "NTPC Pare Hydro & Thermal (Papum Pare)", "power_plant", 27.200, 93.700, "Arunachal Pradesh"),

    # ── NAGALAND / MANIPUR / MIZORAM / TRIPURA / MEGHALAYA / SIKKIM ─────────────
    ("fac-123", "Dimapur Industrial Estate (Nagaland)", "industrial_other", 25.900, 93.700, "Nagaland"),
    ("fac-124", "Tuli Paper Mill (Nagaland)", "industrial_other", 26.700, 94.700, "Nagaland"),
    ("fac-125", "Borthekar & Ningthoukhong Industrial (Manipur)", "industrial_other", 24.600, 93.800, "Manipur"),
    ("fac-126", "Loktak Power & Industrial Complex (Manipur)", "power_plant", 24.500, 93.800, "Manipur"),
    ("fac-127", "Bodhjungnagar Industrial Growth Center (Tripura)", "industrial_other", 23.900, 91.300, "Tripura"),
    ("fac-128", "Rokhia / Baramura Gas Thermal (Tripura)", "power_plant", 23.800, 91.400, "Tripura"),
    ("fac-129", "OCPI Gas Thermal (Tripura)", "power_plant", 23.900, 91.200, "Tripura"),
    ("fac-130", "SIPGCL Meghalaya Thermal & Cement", "power_plant", 25.600, 91.900, "Meghalaya"),
    ("fac-131", "Meghalaya Cement (Star Cement) Lumshnong", "cement", 25.200, 92.400, "Meghalaya"),
    ("fac-132", "Adani Cement Works Meghalaya", "cement", 25.300, 92.500, "Meghalaya"),
    ("fac-133", "Rangpo Industrial Estate (Sikkim)", "industrial_other", 27.200, 88.500, "Sikkim"),
    ("fac-134", "Mangan & Namchi Industrial Zone (Sikkim)", "industrial_other", 27.400, 88.600, "Sikkim"),
    ("fac-135", "Sikkim Power Development Rangit Dam", "power_plant", 27.300, 88.300, "Sikkim"),
    ("fac-136", "Lalsawia Industrial Estate (Mizoram)", "industrial_other", 23.300, 92.700, "Mizoram"),

    # ── HARYANA ─────────────────────────────────────────────────────────────────
    ("fac-137", "IOCL Panipat Refinery & Petrochemicals", "refinery", 29.390, 76.963, "Haryana"),
    ("fac-138", "NFL Panipat Fertilizer", "chemical", 29.411, 76.978, "Haryana"),
    ("fac-139", "GAIL Pata Petrochemical Complex (Auraiya ops)", "gas_processing", 29.500, 77.000, "Haryana"),
    ("fac-140", "Panipat Thermal Power (HPGCL)", "power_plant", 29.390, 76.970, "Haryana"),
    ("fac-141", "Jhajjar Power Complex (Aravalli/Jhajjar)", "power_plant", 28.600, 76.600, "Haryana"),
    ("fac-142", "Khedar Thermal (Hisar)", "power_plant", 29.100, 75.700, "Haryana"),
    ("fac-143", "Maruti Suzuki & IMT Manesar", "industrial_other", 28.350, 76.940, "Haryana"),
    ("fac-144", "Faridabad Industrial Complex & Thermal", "industrial_other", 28.410, 77.310, "Haryana"),
    ("fac-145", "Gurugram Industrial Park & Thermal", "industrial_other", 28.460, 77.030, "Haryana"),
    ("fac-146", "Yamunanagar Paper & Sugar Cluster (NTPC)", "industrial_other", 30.100, 77.300, "Haryana"),
    ("fac-147", "Shree Cement & Bulandshahr Ops", "cement", 28.400, 77.800, "Haryana"),
    ("fac-148", "Jindal Steel & Power Hisar", "metal_works", 29.150, 75.700, "Haryana"),

    # ── PUNJAB ──────────────────────────────────────────────────────────────────
    ("fac-149", "GNDTP Bathinda Thermal", "power_plant", 30.210, 74.940, "Punjab"),
    ("fac-150", "Guru Hargobind Thermal (Lehra Mohabbat)", "power_plant", 30.100, 75.000, "Punjab"),
    ("fac-151", "Ropar Thermal (GGSSTP)", "power_plant", 30.980, 76.500, "Punjab"),
    ("fac-152", "Talwandi Sabo Power (Vedanta)", "power_plant", 30.100, 74.900, "Punjab"),
    ("fac-153", "Nabha Power Plant (L&T)", "power_plant", 30.400, 76.200, "Punjab"),
    ("fac-154", "UltraTech Cement Bathinda", "cement", 30.208, 74.932, "Punjab"),
    ("fac-155", "Ambuja Cement Ropar", "cement", 30.980, 76.500, "Punjab"),
    ("fac-156", "Punjab Chemicals & Fertilizers Complex", "chemical", 30.900, 75.900, "Punjab"),
    ("fac-157", "Rail Coach Factory (RCF) Kapurthala", "industrial_other", 31.380, 75.380, "Punjab"),
    ("fac-158", "GNDTU & Sugar Mills Cluster Jalandhar", "industrial_other", 31.300, 75.600, "Punjab"),
    ("fac-159", "Ludhiana Industrial Cluster", "industrial_other", 30.900, 75.850, "Punjab"),

    # ── HIMACHAL PRADESH ────────────────────────────────────────────────────────
    ("fac-160", "NTPC Koldam Hydro & Thermal", "power_plant", 31.500, 77.200, "Himachal Pradesh"),
    ("fac-161", "Girinagar & Parwanoo Industrial Zones", "industrial_other", 31.000, 76.900, "Himachal Pradesh"),
    ("fac-162", "Ambuja Cement Darlaghat (Solan)", "cement", 31.100, 76.900, "Himachal Pradesh"),
    ("fac-163", "ACC Cement Barmana (Bilaspur)", "cement", 31.400, 76.800, "Himachal Pradesh"),
    ("fac-164", "Nalagarh Industrial Area (Baddi-Barotal)", "industrial_other", 30.900, 76.700, "Himachal Pradesh"),
    ("fac-165", "Baddi Pharma & Industrial Cluster", "industrial_other", 30.960, 76.790, "Himachal Pradesh"),

    # ── UTTARAKHAND ─────────────────────────────────────────────────────────────
    ("fac-166", "SIDCUL Haridwar Industrial Estate", "industrial_other", 29.950, 78.100, "Uttarakhand"),
    ("fac-167", "Rudrapur Industrial Estate (SIDCUL)", "industrial_other", 28.980, 79.400, "Uttarakhand"),
    ("fac-168", "Pantnagar Industrial Estate", "industrial_other", 29.000, 79.500, "Uttarakhand"),
    ("fac-169", "BHEL Rudrapur Plant", "industrial_other", 28.980, 79.400, "Uttarakhand"),
    ("fac-170", "UltraTech Cement & Jaypee Roorkee Ops", "cement", 29.850, 77.880, "Uttarakhand"),
    ("fac-171", "Tehri & Koteshwar Dam Complex", "power_plant", 30.380, 78.480, "Uttarakhand"),

    # ── JAMMU, KASHMIR & LADAKH ─────────────────────────────────────────────────
    ("fac-172", "Jammu Industrial Complex (Samba)", "industrial_other", 32.500, 75.100, "Jammu & Kashmir"),
    ("fac-173", "Srinagar Industrial Estate (Zainakote)", "industrial_other", 34.100, 74.800, "Jammu & Kashmir"),
    ("fac-174", "J&K Cement Ltd (Srinagar/Bhagtheer)", "cement", 34.000, 74.900, "Jammu & Kashmir"),
    ("fac-175", "Chenab & Pakal Dul Power Projects", "power_plant", 33.200, 75.900, "Jammu & Kashmir"),
    ("fac-176", "Salal & Baglihar Hydro Complex", "power_plant", 33.200, 75.300, "Jammu & Kashmir"),
    ("fac-177", "Sonamarg & Leh Industrial Zone (Ladakh)", "industrial_other", 34.200, 77.600, "Ladakh"),

    # ── DELHI NCR ───────────────────────────────────────────────────────────────
    ("fac-178", "Badarpur Thermal Power (Delhi)", "power_plant", 28.490, 77.300, "Delhi"),
    ("fac-179", "Rajghat & Indraprastha Power (Delhi)", "power_plant", 28.640, 77.240, "Delhi"),
    ("fac-180", "Okhla Industrial Estate & Thermal", "industrial_other", 28.560, 77.280, "Delhi"),
    ("fac-181", "Anand Vihar & Shahdara Industrial (Delhi)", "industrial_other", 28.670, 77.300, "Delhi"),
    ("fac-182", "Wazirpur & Narela Industrial Zones", "industrial_other", 28.720, 77.170, "Delhi"),
    ("fac-183", "Narela & Bawana Industrial Area", "industrial_other", 28.800, 77.100, "Delhi"),

    # ── KARNATAKA ───────────────────────────────────────────────────────────────
    ("fac-184", "Mangalore Refinery & Petrochemicals (MRPL)", "refinery", 12.911, 74.881, "Karnataka"),
    ("fac-185", "JSW Steel Vijayanagar (Toranagallu)", "metal_works", 15.178, 76.671, "Karnataka"),
    ("fac-186", "Kudgi Super Thermal (NTPC)", "power_plant", 16.480, 75.842, "Karnataka"),
    ("fac-187", "Raichur Thermal Power (KPCL)", "power_plant", 16.200, 77.400, "Karnataka"),
    ("fac-188", "Bellary & Hospet Iron & Steel Cluster", "metal_works", 15.150, 76.900, "Karnataka"),
    ("fac-189", "UltraTech Cement & Mysore Cement Ltd (Wadi)", "cement", 17.050, 76.990, "Karnataka"),
    ("fac-190", "Hindalco Aluminium & Copper (Karnataka)", "metal_works", 14.800, 76.100, "Karnataka"),
    ("fac-191", "Itagi & Bhalki Industrial Zones", "industrial_other", 16.200, 76.000, "Karnataka"),
    ("fac-192", "Bangalore Aerospace & Peenya Industrial", "industrial_other", 13.030, 77.520, "Karnataka"),
    ("fac-193", "Kudgi & Bellary Cement Cluster", "cement", 16.400, 76.800, "Karnataka"),

    # ── TELANGANA ───────────────────────────────────────────────────────────────
    ("fac-194", "Ramagundam Fertilizers & Chemicals (RFCL)", "chemical", 18.756, 79.467, "Telangana"),
    ("fac-195", "NTPC Ramagundam Super Thermal", "power_plant", 18.756, 79.467, "Telangana"),
    ("fac-196", "Kothagudem Thermal Power (TGGENCO)", "power_plant", 17.600, 80.600, "Telangana"),
    ("fac-197", "Ramagundam Super Thermal (Stage-III)", "power_plant", 18.760, 79.470, "Telangana"),
    ("fac-198", "HSL Steel Plant & Zaheerabad Industrial", "metal_works", 17.700, 77.600, "Telangana"),
    ("fac-199", "Medak Pharma & Chemical Cluster", "chemical", 18.050, 78.300, "Telangana"),
    ("fac-200", "Sanathnagar & Balanagar Industrial (Hyderabad)", "industrial_other", 17.470, 78.480, "Telangana"),
    ("fac-201", "Patancheru & Bollaram Industrial", "industrial_other", 17.530, 78.270, "Telangana"),

    # ── ANDHRA PRADESH ───────────────────────────────────────────────────────────
    ("fac-202", "HPCL Visakh Refinery", "refinery", 17.724, 83.265, "Andhra Pradesh"),
    ("fac-203", "ONGC Tatipaka Refinery & Gas", "refinery", 16.518, 81.874, "Andhra Pradesh"),
    ("fac-204", "Sri City Industrial & FMCG Cluster", "industrial_other", 13.550, 79.930, "Andhra Pradesh"),
    ("fac-205", "Simhadri Super Thermal (NTPC)", "power_plant", 17.000, 83.200, "Andhra Pradesh"),
    ("fac-206", "Dr Narla Tata Rao Thermal (Vijayawada)", "power_plant", 16.500, 80.600, "Andhra Pradesh"),
    ("fac-207", "Sri Damodaram Sanjeevaiah Thermal (Nellore)", "power_plant", 14.400, 80.100, "Andhra Pradesh"),
    ("fac-208", "Konaseema Gas & Industrial Cluster", "gas_processing", 16.800, 81.800, "Andhra Pradesh"),
    ("fac-209", "Kakinada Refinery & Port (GAIL ops)", "refinery", 16.950, 82.250, "Andhra Pradesh"),
    ("fac-210", "Visakhapatnam Steel Plant (RINL)", "metal_works", 17.700, 83.300, "Andhra Pradesh"),
    ("fac-211", "Anrak Alumina & Chemicals (Razole)", "chemical", 16.500, 81.800, "Andhra Pradesh"),

    # ── TAMIL NADU ───────────────────────────────────────────────────────────────
    ("fac-212", "Chennai Petroleum Corporation (CPCL Manali)", "refinery", 13.168, 80.257, "Tamil Nadu"),
    ("fac-213", "CPCL Cauvery Basin Refinery (Nagapattinam)", "refinery", 10.820, 79.840, "Tamil Nadu"),
    ("fac-214", "NLC Tamil Nadu Thermal & Lignite", "power_plant", 11.532, 79.753, "Tamil Nadu"),
    ("fac-215", "Neyveli Lignite Corporation (NLC India)", "power_plant", 11.540, 79.500, "Tamil Nadu"),
    ("fac-216", "Sterlite Copper Thoothukudi (Tuticorin)", "metal_works", 8.810, 78.100, "Tamil Nadu"),
    ("fac-217", "TN Petro Products & Manali Petrochem", "chemical", 13.178, 80.271, "Tamil Nadu"),
    ("fac-218", "Ennore & Vallur Thermal Power", "power_plant", 13.250, 80.300, "Tamil Nadu"),
    ("fac-219", "North Chennai Thermal (Basin Bridge)", "power_plant", 13.150, 80.280, "Tamil Nadu"),
    ("fac-220", "UltraTech Cement Ariyalur", "cement", 11.100, 79.100, "Tamil Nadu"),
    ("fac-221", "Chettinad & Dalmia Cement Cluster", "cement", 11.200, 78.900, "Tamil Nadu"),
    ("fac-222", "Ashok Leyland & Heavy Engg Ennore", "industrial_other", 13.240, 80.320, "Tamil Nadu"),
    ("fac-223", "Ramco Cements & Virudhunagar Cluster", "cement", 9.600, 77.900, "Tamil Nadu"),

    # ── KERALA ──────────────────────────────────────────────────────────────────
    ("fac-224", "BPCL Kochi Refinery (Ambalamugal)", "refinery", 9.992, 76.358, "Kerala"),
    ("fac-225", "FACT Udyogamandal & Ambalamugal", "chemical", 10.086, 76.257, "Kerala"),
    ("fac-226", "Travancore Titanium Products (TTP)", "chemical", 8.480, 76.950, "Kerala"),
    ("fac-227", "NTPC Kayamkulam (Rajiv Gandhi CCPP)", "power_plant", 9.170, 76.500, "Kerala"),
    ("fac-228", "Brahmapuram & Kalamassery Industrial", "industrial_other", 10.050, 76.350, "Kerala"),
    ("fac-229", "Kannur & Kozhikode Industrial Zones", "industrial_other", 11.250, 75.780, "Kerala"),

    # ── PUDUCHERRY / GOA / DNH&DD ────────────────────────────────────────────────
    ("fac-230", "Puducherry Industrial Estate (Mudaliar)", "industrial_other", 11.940, 79.800, "Puducherry"),
    ("fac-231", "Aurobindo & Kalapet Pharma Cluster", "chemical", 11.930, 79.780, "Puducherry"),
    ("fac-232", "Zuari Agro & Chemical Complex Goa", "chemical", 15.400, 73.900, "Goa"),
    ("fac-233", "Sesa Goa & Vedanta Iron Ops (Goa)", "metal_works", 15.300, 74.000, "Goa"),
    ("fac-234", "JSW Steel & Pellet Plant (Goa)", "metal_works", 15.250, 73.950, "Goa"),
    ("fac-235", "DD Silvassa & Daman Industrial Zone", "industrial_other", 20.270, 73.020, "Dadra & Nagar Haveli"),
    ("fac-236", "Daman Industrial Estate", "industrial_other", 20.420, 72.830, "Daman & Diu"),

    # ── CHANDIGARH ──────────────────────────────────────────────────────────────
    ("fac-237", "Chandigarh Industrial Estate Phase 1-2", "industrial_other", 30.700, 76.800, "Chandigarh"),
    ("fac-238", "Mohali / Rajpura Industrial Cluster", "industrial_other", 30.700, 76.700, "Chandigarh"),

    # ── ANDAMAN & LAKSHADWEEP (UTs) ─────────────────────────────────────────────
    ("fac-239", "Port Blair & Haddo Industrial Zone", "industrial_other", 11.620, 92.740, "Andaman & Nicobar"),
    ("fac-240", "Kavaratti & Lakshadweep Utilities", "industrial_other", 10.570, 72.640, "Lakshadweep"),
]

_FACILITY_REGISTRY: list[dict] = [
    {"id": fid, "name": name, "type": ftype, "lat": lat, "lon": lon, "state": state}
    for fid, name, ftype, lat, lon, state in _FACILITY_TUPLES
]
