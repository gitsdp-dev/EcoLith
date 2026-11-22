import { supabase } from './supabase.js';

/**
 * Built-in circular resource recovery rules fallback.
 * Strictly adheres to database check constraint recovery_method in
 * ('reuse', 'redistribution', 'composting', 'biogas', 'pectin_recovery', 'material_recovery', 'separate_disposal')
 * while providing comprehensive coverage for both organic and inorganic materials.
 */
export const DEFAULT_RECOVERY_RULES = [
  // =========================================================================
  // 1. INORGANIC: ELECTRONIC & ELECTRICAL (E-WASTE)
  // =========================================================================
  {
    material_pattern:
      'pcb|circuit|motherboard|logic board|microcontroller|integrated circuit|\\bic\\b|server board',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Use temperature-controlled hot air rework stations and ESD-safe grounding to desolder undamaged discrete components (FPGA, MOSFETs, tantalum capacitors, quartz crystals).',
    explanation:
      'High-density server and computer circuit boards contain functioning microprocessors, power ICs, and high-purity gold-plated pin headers suitable for component harvesting.',
    estimated_resource_value: 'High ($15–$60 salvaged functional component value per board)',
    category_group: 'electronics',
    tier: 'community'
  },
  {
    material_pattern:
      'pcb|circuit|motherboard|logic board|e-waste|telecom board|ram stick|gold contact',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Consolidate in dry totes; route to ISO 14001 / R2 certified electronic scrap smelting and hydrometallurgical refining refineries; avoid open-flame burning.',
    explanation:
      'Printed circuit boards yield 100–300g gold, 1kg silver, and 100kg copper per metric ton, exceeding the yield of primary raw ore mining by 40-50x.',
    estimated_resource_value: 'High ($3,500–$12,000/ton refined e-scrap yield)',
    category_group: 'electronics',
    tier: 'industrial'
  },
  {
    material_pattern:
      'battery|lithium|18650|lifepo4|li-ion|battery pack|cell pack|prismatic \\bcell\\b',
    waste_category: 'other_separate',
    recovery_method: 'separate_disposal',
    requirements:
      'Tape open terminals with non-conductive electrical tape; store in non-combustible sand or vermiculite containers; never puncture, crush, or heat.',
    explanation:
      'Spent lithium-ion battery cells undergo cryogenic shredding and hydrometallurgical leaching to recover battery-grade lithium carbonate, nickel sulfate, and cobalt.',
    estimated_resource_value: 'High (Critical minerals security: Li, Co, Ni recovery)',
    category_group: 'electronics',
    tier: 'industrial'
  },
  {
    material_pattern:
      'electric motor|stepper motor|servo motor|bldc motor|alternator rotor|induction motor',
    waste_category: 'edible_reusable',
    recovery_method: 'reuse',
    requirements:
      'Measure phase winding resistance; inspect bearings for play; clean shaft and repack grease to restore operational specification.',
    explanation:
      'Industrial electric motors and precision steppers feature robust lamination stacks that can be rebuilt with new bearings and brushes for robotics and automation.',
    estimated_resource_value: 'High ($25–$120 remanufactured motor replacement value)',
    category_group: 'mechanical',
    tier: 'community'
  },
  {
    material_pattern:
      'copper wire|electrical cable|wiring harness|copper winding|busbar|coaxial cable',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Mechanically strip outer PVC/rubber insulation with automated rotary wire strippers; keep bare bright copper (Millberry) segregated.',
    explanation:
      'Scrap electrical copper maintains 100% of its electrical conductivity upon remelting, requiring 85% less energy than producing virgin copper from chalcopyrite ore.',
    estimated_resource_value: 'High ($6.50–$8.80/kg Bare Bright #1 copper scrap)',
    category_group: 'metals',
    tier: 'industrial'
  },

  // =========================================================================
  // 2. INORGANIC: MECHANICAL & ENGINEERING HARDWARE
  // =========================================================================
  {
    material_pattern:
      'bearing|ball bearing|roller bearing|tapered bearing|pillow block|needle bearing',
    waste_category: 'edible_reusable',
    recovery_method: 'reuse',
    requirements:
      'Degrease in solvent wash; inspect raceway for micro-pitting or brinelling using dial indicator; repack with EP2 synthetic lithium grease.',
    explanation:
      'Quality 52100 chrome steel ball bearings with minor cosmetic wear can be inspected, cleaned, and redeployed in secondary low-speed conveyors or workshop equipment.',
    estimated_resource_value: 'Medium ($5–$25 per refurbished precision bearing assembly)',
    category_group: 'mechanical',
    tier: 'community'
  },
  {
    material_pattern: 'gear|sprocket|spline shaft|timing pulley|spur gear|bevel gear|helical gear',
    waste_category: 'edible_reusable',
    recovery_method: 'reuse',
    requirements:
      'Check pitch line wear and tooth flank backlash; re-machine root radius or induction harden for secondary mechanical drives.',
    explanation:
      'Carburized steel gears can be resurfaced or adapted with keyways for custom mechanical drives, prototype gearboxes, or agricultural repairs.',
    estimated_resource_value: 'High ($20–$80 per remanufactured machine drive gear)',
    category_group: 'mechanical',
    tier: 'industrial'
  },
  {
    material_pattern:
      'bolt|fastener|screw|hex nut|stud|socket cap|machine screw|high tensile|grade 8.8|grade 10.9',
    waste_category: 'edible_reusable',
    recovery_method: 'reuse',
    requirements:
      'Clean in ultrasonic bath; check thread pitch with thread gauge; discard any stretched neck or stripped fasteners.',
    explanation:
      'High-strength structural and alloy steel fasteners can be segregated into hardware storage bin systems for maintenance and prototyping.',
    estimated_resource_value: 'Medium ($0.20–$1.50 per sorted structural fastener)',
    category_group: 'mechanical',
    tier: 'household'
  },
  {
    material_pattern:
      'hydraulic cylinder|pneumatic cylinder|hydraulic valve|directional valve|spool valve|manifold',
    waste_category: 'edible_reusable',
    recovery_method: 'reuse',
    requirements:
      'Inspect chrome rod for scoring; hone cylinder bore; install replacement polyurethane U-cup seal and wiper kit; pressure test to 200 bar.',
    explanation:
      'Hydraulic rams and valves are engineered for multi-decade service life; seal rebuilds restore full operating pressure at 20% of new equipment cost.',
    estimated_resource_value: 'High ($80–$300 cylinder rebuild value)',
    category_group: 'mechanical',
    tier: 'industrial'
  },
  {
    material_pattern:
      'carbide insert|toolholder|endmill|drill bit|tool steel|hss|cutting tool|milling insert',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Collect in segregated tungsten carbide scrap canisters; send to specialized zinc-process or acid digestion recycling refiners.',
    explanation:
      'Spent carbide milling inserts contain 90%+ tungsten carbide (WC) and cobalt binder, yielding high scrap value and conserving critical tungsten reserves.',
    estimated_resource_value: 'High ($18–$28/kg solid tungsten carbide scrap)',
    category_group: 'metals',
    tier: 'industrial'
  },

  // =========================================================================
  // 3. INORGANIC: INDUSTRIAL SCRAP METALS
  // =========================================================================
  {
    material_pattern:
      'aluminum extrusion|structural aluminum|t-slot|6061|6063|aluminum plate|aluminum sheet|billet',
    waste_category: 'edible_reusable',
    recovery_method: 'reuse',
    requirements:
      'Inspect for squareness and straightness; remove steel fasteners and chips; square cut ends on cold saw.',
    explanation:
      'Modular 6061/6063 aluminum T-slot extrusions can be immediately repurposed to construct 3D printer frames, robotics testbeds, safety guarding, and workshop tables.',
    estimated_resource_value: 'High ($12–$45/meter structural framing value)',
    category_group: 'metals',
    tier: 'community'
  },
  {
    material_pattern:
      'aluminum scrap|aluminum turnings|aluminum chips|aluminum shavings|aluminum can',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Centrifuge to remove water-soluble machining coolant; briquette turnings to minimize oxidation during induction furnace melting.',
    explanation:
      'Recycling clean aluminum scraps requires only 5% of the electrical energy required to produce primary aluminum from bauxite ore, reducing 95% of greenhouse emissions.',
    estimated_resource_value: 'High ($1.80–$2.50/kg segregated aluminum scrap)',
    category_group: 'metals',
    tier: 'industrial'
  },
  {
    material_pattern:
      'copper scrap|copper pipe|copper tube|copper bar|brass fitting|bronze bushing|plumbing scrap',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Cut away lead solder joints; drain fluids; segregate clean unalloyed copper from yellow brass (Cu-Zn) and bronze (Cu-Sn).',
    explanation:
      'Scrap copper and copper alloys are 100% recyclable without any loss of ductility or thermal/electrical conductivity, serving as premier feedstock for foundries.',
    estimated_resource_value: 'High ($5.50–$8.20/kg clean copper and brass scrap)',
    category_group: 'metals',
    tier: 'industrial'
  },
  {
    material_pattern:
      'stainless steel|304 stainless|316 stainless|stainless tank|stainless pipe|ferritic stainless',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Test with magnet to distinguish austenitic (300-series non-magnetic) from 400-series; degrease and shear into furnace-ready charging sizes.',
    explanation:
      'Stainless steel scrap provides essential recycled chromium (18%) and nickel (8-10%), drastically lowering carbon intensity for stainless steel production.',
    estimated_resource_value: 'High ($1.40–$2.60/kg stainless scrap)',
    category_group: 'metals',
    tier: 'industrial'
  },
  {
    material_pattern:
      'cast iron|engine block|brake rotor|machine casting|flywheel|pig iron|heavy melt',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Remove bearings, bronze bushings, and aluminum pistons; break oversized castings into charge dimensions for foundry cupola or electric arc furnace.',
    explanation:
      'Gray and ductile cast iron scrap has superior remelting fluidity, serving as primary feedstock for new machine tools, pump housings, and municipal castings.',
    estimated_resource_value: 'Medium ($0.30–$0.55/kg heavy foundry scrap)',
    category_group: 'metals',
    tier: 'industrial'
  },

  // =========================================================================
  // 4. INORGANIC: ENGINEERING POLYMERS & PLASTICS
  // =========================================================================
  {
    material_pattern:
      'hdpe|high density polyethylene|plastic drum|plastic pallet|pipe scrap|hdpe pipe',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Rinse residual chemicals; shred into 8mm flakes; wash in detergent bath and dry; pelletize through single-screw vented extruder.',
    explanation:
      'HDPE retains high tensile impact strength across recycling cycles, producing commercial recycled pellets for underground corrugated drainage pipe and composite plastic lumber.',
    estimated_resource_value: 'Medium ($1.10–$1.80/kg clean recycled HDPE regrind)',
    category_group: 'polymers',
    tier: 'industrial'
  },
  {
    material_pattern:
      '\\babs\\b|polycarbonate|nylon|pa6|pa66|teflon|ptfe|polypropylene|engineering plastic|3d print scrap',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Keep resin codes strictly segregated; desiccant dry at 80°C to eliminate absorbed atmospheric moisture before extrusion or re-molding.',
    explanation:
      'Engineering polymers (ABS, Nylon, Polycarbonate) can be ground and re-extruded into 3D printer filament or blended with virgin resin for injection-molded enclosures.',
    estimated_resource_value: 'Medium ($2.00–$4.50/kg clean engineering polymer regrind)',
    category_group: 'polymers',
    tier: 'community'
  },

  // =========================================================================
  // 5. INORGANIC: AUTOMOTIVE & HEAVY EQUIPMENT
  // =========================================================================
  {
    material_pattern: 'alternator|starter motor|ac compressor|power steering pump|caliper core',
    waste_category: 'surplus_redistributable',
    recovery_method: 'redistribution',
    requirements:
      'Verify casting housing has no structural cracks; pack in core return crate for remanufacturing supplier deposit return.',
    explanation:
      'Automotive component cores are remanufactured by replacing worn brushes, commutators, and bearings, saving 85% of raw manufacturing material and energy.',
    estimated_resource_value: 'High ($30–$90 core deposit credit value)',
    category_group: 'automotive',
    tier: 'industrial'
  },
  {
    material_pattern: 'catalytic converter|exhaust catalyst|diesel particulate filter|dpf',
    waste_category: 'other_separate',
    recovery_method: 'material_recovery',
    requirements:
      'Do not crush or breathe monolith ceramic dust; deliver intact to licensed precious metal assay refiner.',
    explanation:
      'Catalytic converters contain cordierite honeycomb wash-coated with platinum (Pt), palladium (Pd), and rhodium (Rh), yielding the highest precious metal scrap value per unit.',
    estimated_resource_value: 'Very High ($80–$350+ depending on OEM catalyst code)',
    category_group: 'automotive',
    tier: 'industrial'
  },

  // =========================================================================
  // 6. INORGANIC: CONSTRUCTION & DEMOLITION
  // =========================================================================
  {
    material_pattern: 'concrete|masonry rubble|brick|crushed concrete|demolition rubble|mortar',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Run through magnetic overband separator to remove rebar; crush with primary jaw crusher and screen into 20mm/40mm aggregate sizes.',
    explanation:
      'Crushed concrete replaces virgin quarried stone as Department of Transportation approved road sub-base (Class 2 aggregate), reducing quarrying impact.',
    estimated_resource_value: 'Medium ($15–$25/ton recycled concrete road-base aggregate)',
    category_group: 'construction',
    tier: 'industrial'
  },
  {
    material_pattern: 'plate glass|architectural glass|window pane|float glass|tempered glass',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Separate window frames, rubber gaskets, and sealants; separate clear float glass from tinted glass; collect in sturdy glass bins.',
    explanation:
      'Clean plate glass cullet melts at lower furnace temperatures than raw sand and soda ash, reducing glass manufacturing energy and producing fiberglass insulation.',
    estimated_resource_value: 'Medium ($50–$90/ton clean flat glass cullet)',
    category_group: 'construction',
    tier: 'industrial'
  },

  // =========================================================================
  // 7. ORGANIC: CITRUS, PRODUCE, FOOD & RESIDUES
  // =========================================================================
  {
    material_pattern: 'citrus|lemon|orange|lime|grapefruit|tangerine|citron|peel|rind',
    waste_category: 'unavoidable_organic',
    recovery_method: 'pectin_recovery',
    requirements:
      'Requires access to specialized biochemical or industrial extraction facility; free from synthetic fruit stickers and waxes.',
    explanation:
      'Citrus rinds are abundant in natural polysaccharides, yielding commercial-grade pectin used in food stabilizing, confectionery, and pharmaceutical capsules.',
    estimated_resource_value: 'High ($2.50–$4.50/kg refined pectin value)',
    category_group: 'fruit',
    tier: 'industrial'
  },
  {
    material_pattern: 'citrus|lemon|orange|lime|grapefruit|tangerine|citron',
    waste_category: 'unavoidable_organic',
    recovery_method: 'composting',
    requirements:
      'Chop or shred rinds into small pieces; mix well with dry brown carbon; avoid over-concentrating in vermicompost (earthworms are sensitive to citric acid).',
    explanation:
      'Aerobic composting breaks down citrus cellulose and terpenes into rich humic matter, retaining soil moisture and adding trace micronutrients.',
    estimated_resource_value: 'Medium (Restores soil organic matter; diverts landfill methane)',
    category_group: 'fruit',
    tier: 'household'
  },
  {
    material_pattern: 'banana|plantain|mango skin|papaya peel|tropical fruit peel',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Air-dry or bake at 80°C to dehydrate; pulverize or steep in water for nutrient extraction.',
    explanation:
      'Banana and plantain peels are extraordinarily rich in bioavailable potassium (K) and phosphorus (P), yielding rapid-uptake liquid organic plant fertilizer.',
    estimated_resource_value: 'Medium (High potassium bio-fertilizer replacement)',
    category_group: 'fruit',
    tier: 'household'
  },
  {
    material_pattern: 'apple|pear|quince|cider pomace|fruit core',
    waste_category: 'unavoidable_organic',
    recovery_method: 'pectin_recovery',
    requirements:
      'Process press cake or cores within 12 hours of juicing or freeze to prevent spontaneous wild fermentation.',
    explanation:
      'Apple pomace contains high-methoxyl pectin and dietary fiber, suitable for upcycled prebiotic dietary fiber ingredients and thickening agents.',
    estimated_resource_value: 'High ($3–$5/kg upcycled dietary fiber value)',
    category_group: 'fruit',
    tier: 'industrial'
  },
  {
    material_pattern: 'coffee ground|spent coffee|coffee residue|tea leaf|tea leaves|spent tea',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Dry thoroughly before storage to prevent green mold; blend with pasteurized straw or hardwood sawdust substrate at a 1:3 ratio.',
    explanation:
      "Spent coffee grounds and tea leaves provide ideal nitrogen, lignin, and mineral profiles for cultivating gourmet oyster and lion's mane mushrooms.",
    estimated_resource_value: 'High (Yields up to 1kg fresh oyster mushrooms per 2.5kg grounds)',
    category_group: 'beverage',
    tier: 'community'
  },
  {
    material_pattern: 'aloe|aloe vera|succulent|cactus|medicinal leaf|herbal leaf',
    waste_category: 'unavoidable_organic',
    recovery_method: 'reuse',
    requirements:
      'Wash outer leaf thoroughly; fillet to extract clear inner gel for topical skin hydration or soothing preparations.',
    explanation:
      'Aloe vera leaves contain polysaccharide-rich gel and acemannan, providing natural topical cooling, moisturizing, and home cosmetic reuse value.',
    estimated_resource_value: 'High (Natural botanical cosmetic & skincare savings)',
    category_group: 'vegetable',
    tier: 'household'
  },
  {
    material_pattern: 'aloe|aloe vera|succulent|cactus|medicinal leaf|herbal leaf',
    waste_category: 'unavoidable_organic',
    recovery_method: 'composting',
    requirements:
      'Chop thick outer leaf rinds coarsely to accelerate decomposition; mix with dry carbon browns to balance high moisture content.',
    explanation:
      'Aloe vera rinds and botanical plant residues provide valuable moisture, minerals, and organic matter to soil compost heaps.',
    estimated_resource_value: 'Medium (Restores garden soil fertility and hydration)',
    category_group: 'vegetable',
    tier: 'household'
  },
  {
    material_pattern: 'coffee ground|spent coffee|tea leaf|tea leaves',
    waste_category: 'unavoidable_organic',
    recovery_method: 'composting',
    requirements:
      'Spread evenly across compost layers; count grounds as green nitrogen-rich material despite their dark brown color.',
    explanation:
      'Coffee grounds heat up compost piles rapidly to thermophilic levels (55°C–65°C), accelerating the breakdown of stubborn dry leaves and yard waste.',
    estimated_resource_value: 'Medium (Accelerates compost cycle by 20–30%)',
    category_group: 'beverage',
    tier: 'household'
  },
  {
    material_pattern: 'bread|bakery|pastry|croissant|bagel|bun|loaf|fresh bread',
    waste_category: 'surplus_redistributable',
    recovery_method: 'redistribution',
    requirements:
      'Must be wholesome, unexpired, stored dry in original sealed food-grade packaging; verify allergen labeling (gluten, dairy, nuts).',
    explanation:
      'Fresh surplus baked goods can be immediately diverted to local hunger relief charities, community pantries, and youth breakfast clubs.',
    estimated_resource_value: 'High (Immediate community food security)',
    category_group: 'bakery',
    tier: 'community'
  },
  {
    material_pattern: 'stale bread|bread crust|baguette|pita|tortilla|crouton',
    waste_category: 'edible_reusable',
    recovery_method: 'reuse',
    requirements:
      'Ensure zero signs of visible mold; bake at low heat (150°C) until bone dry, or store in sealed jars.',
    explanation:
      'Stale bread can be transformed into shelf-stable seasoned croutons, Japanese-style panko breadcrumbs, French toast, bread pudding, or kvass.',
    estimated_resource_value: 'Medium ($4–$8 bakery ingredient savings)',
    category_group: 'bakery',
    tier: 'household'
  },
  {
    material_pattern:
      'spent.*grain|brewer.*grain|brewery mash|malt residue|distillery grain|spent mash',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Dehydrate promptly within 6 hours of brewing to prevent lactic souring; store in moisture-sealed totes.',
    explanation:
      'Spent barley grain contains up to 20% protein and 70% fiber, making it a high-value input for upcycled baking flours, artisanal dog biscuits, and livestock feed.',
    estimated_resource_value: 'High ($200–$400/ton dehydrated feed value)',
    category_group: 'grain',
    tier: 'industrial'
  },
  {
    material_pattern:
      'vegetable scrap|carrot peel|onion skin|celery top|leek green|herb stem|root peel',
    waste_category: 'unavoidable_organic',
    recovery_method: 'reuse',
    requirements:
      'Wash thoroughly to remove soil grit; freeze in a dedicated sealed container until gathering a 500g batch; avoid brassicas (cabbage/broccoli can impart bitterness).',
    explanation:
      'Clean vegetable trimmings simmered with water and bay leaves yield an aromatic, nutrient-rich culinary vegetable stock for soups and risottos.',
    estimated_resource_value: 'Medium ($3–$6 culinary stock equivalent)',
    category_group: 'vegetable',
    tier: 'household'
  },
  {
    material_pattern: 'raw vegetable scrap|salad greens|leafy green|cabbage|lettuce|spinach|kale',
    waste_category: 'unavoidable_organic',
    recovery_method: 'composting',
    requirements:
      'Mix high-moisture greens with dry brown leaves or shredded cardboard in a 1:2 volume ratio to prevent anaerobic slime.',
    explanation:
      'Microbial aerobic digestion converts succulent vegetable matter into bioactive organic humus that rebuilds soil structure and locks in soil moisture.',
    estimated_resource_value: 'Medium (Restores garden soil fertility)',
    category_group: 'vegetable',
    tier: 'household'
  },
  {
    material_pattern:
      'whole fruit|whole vegetable|blemished fruit|ugly produce|surplus produce|farm surplus',
    waste_category: 'surplus_redistributable',
    recovery_method: 'redistribution',
    requirements:
      'Sort to remove bruised or decaying specimens; pack in clean ventilated crates; maintain ambient or cool conditions.',
    explanation:
      'Cosmetically imperfect but nutritionally wholesome produce can be supplied directly to community kitchen gleaning programs and food banks.',
    estimated_resource_value: 'High (Immediate nutrition for vulnerable families)',
    category_group: 'produce',
    tier: 'community'
  },
  {
    material_pattern:
      'cooked food|cooked meal|prepared surplus|curry|casserole|pasta dish|rice dish|leftover meal',
    waste_category: 'edible_reusable',
    recovery_method: 'reuse',
    requirements:
      'Rapidly cool to below 4°C within 2 hours of cooking; store in airtight food-grade glass containers; reheat to 74°C internal temperature before eating.',
    explanation:
      'Structured meal planning, proper refrigeration, and creative ingredient recombination prevent wholesome prepared foods from premature disposal.',
    estimated_resource_value: 'High ($8–$18 meal replacement value)',
    category_group: 'prepared',
    tier: 'household'
  },
  {
    material_pattern: 'surplus milk|dairy|yogurt|cream|whey|curd|cottage cheese',
    waste_category: 'edible_reusable',
    recovery_method: 'reuse',
    requirements: 'Check for clean lactic aroma; ensure continuous cold-chain storage below 4°C.',
    explanation:
      'Surplus whole milk can be gently curdled with vinegar or lemon juice to create fresh homemade ricotta or paneer; acid whey replaces water in sourdough baking.',
    estimated_resource_value: 'Medium ($5–$10 artisan cheese value)',
    category_group: 'dairy',
    tier: 'household'
  },
  {
    material_pattern: 'surplus milk|carton milk|sealed cheese|packaged dairy',
    waste_category: 'surplus_redistributable',
    recovery_method: 'redistribution',
    requirements:
      'Must be factory-sealed, unadulterated, and within manufacturer sell-by/use-by guidelines with unbroken cold-chain transport.',
    explanation:
      'Sealed surplus dairy provides essential calcium and bioavailable protein to regional food pantries and family shelter networks.',
    estimated_resource_value: 'High (Immediate essential family nutrition)',
    category_group: 'dairy',
    tier: 'community'
  },
  {
    material_pattern: 'used cooking oil|fryer oil|grease|vegetable fat|tallow|lard|spent oil',
    waste_category: 'other_separate',
    recovery_method: 'material_recovery',
    requirements:
      'Strain out food particles through a fine metal sieve; store in sealed leakproof steel drums or food-grade poly jugs; never pour into drains.',
    explanation:
      'Collected fats and oils undergo transesterification in processing refineries to produce certified ASTM D6751 biodiesel and renewable aviation fuels.',
    estimated_resource_value: 'High (Yields 0.9L clean-burning biodiesel per 1L waste oil)',
    category_group: 'oils',
    tier: 'industrial'
  },
  {
    material_pattern: 'egg shell|eggshell',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Rinse out egg white albumen residue; heat-sterilize at 100°C for 10 minutes; pulverize into fine powder with a grinder or mortar.',
    explanation:
      'Eggshells are 95% bioavailable calcium carbonate; powder applied around nightshades (tomatoes, peppers) prevents blossom-end rot and balances acidic soil pH.',
    estimated_resource_value: 'Low-Medium (Natural organic mineral soil conditioner)',
    category_group: 'dairy',
    tier: 'household'
  },
  {
    material_pattern: 'meat bone|animal carcass|chicken bone|beef bone|bone scrap',
    waste_category: 'unavoidable_organic',
    recovery_method: 'reuse',
    requirements:
      'Roast bones at 200°C for 30 minutes for flavor; simmer with water and an acid splash (apple cider vinegar) for 8–18 hours.',
    explanation:
      'Slow simmering extracts deep collagen, gelatin, and bone marrow minerals into highly nourishing, gut-healthy culinary bone broth.',
    estimated_resource_value: 'Medium ($6–$12 artisanal bone broth equivalent)',
    category_group: 'protein',
    tier: 'household'
  },
  {
    material_pattern: 'meat bone|animal carcass|connective tissue|offal|animal byproduct',
    waste_category: 'unavoidable_organic',
    recovery_method: 'biogas',
    requirements:
      'Requires commercial thermophilic anaerobic digestion facility; avoid standard backyard home compost to prevent rodent and carnivore attraction.',
    explanation:
      'High lipid and protein contents generate superior biomethane yields in industrial digesters, generating clean electrical power and bio-fertilizer digestate.',
    estimated_resource_value: 'High (0.6–0.9 kWh renewable power per kg)',
    category_group: 'protein',
    tier: 'industrial'
  },
  {
    material_pattern: 'crustacean shell|shrimp shell|crab shell|lobster shell|fish bone|fish scrap',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Rinse and dry shells promptly; collect in segregated freezer storage to prevent odors.',
    explanation:
      'Crustacean carapaces are a premier source of natural chitin and chitosan, refined into biodegradable bioplastics, water treatment flocculants, and seed coatings.',
    estimated_resource_value: 'High ($15–$30/kg purified pharmaceutical chitosan value)',
    category_group: 'seafood',
    tier: 'industrial'
  },
  {
    material_pattern:
      'nut shell|walnut shell|coconut shell|pecan shell|avocado pit|peach stone|fruit pit',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements: 'Clean away soft fruit pulp; dry thoroughly in ambient sunlight or low heat.',
    explanation:
      'Hard lignocellulose shells and pits are ground for natural cosmetics exfoliants, industrial blast abrasives, activated carbon filters, or high-BTU biomass briquettes.',
    estimated_resource_value: 'Medium (Activated carbon and bio-abrasive precursor)',
    category_group: 'nuts_seeds',
    tier: 'industrial'
  },
  {
    material_pattern:
      'takeout container|greasy cardboard|food packaging|waxed paper|soiled packaging|napkin',
    waste_category: 'other_separate',
    recovery_method: 'separate_disposal',
    requirements:
      'Remove all loose organic food scraps; separate recyclable plastics or metals from unrecyclable PFAS-treated paper or grease-soaked cardboard.',
    explanation:
      'Prevents contaminated materials from degrading municipal compost batches and ensures plastics enter proper chemical recycling streams.',
    estimated_resource_value: 'Environmental Protection (Protects compost batch purity)',
    category_group: 'packaging',
    tier: 'household'
  }
];

export const RECOVERY_METHOD_METADATA = {
  reuse: {
    label: 'Direct Reuse & Redeployment',
    badgeClass: 'badge-success',
    icon: '🔁',
    description: 'Transform, remount, or repurpose intact components or culinary portions directly.'
  },
  refurbishment: {
    label: 'Precision Refurbishment',
    badgeClass: 'badge-primary',
    icon: '🔧',
    description:
      'Ultrasonic cleaning, bearing repacking, and servicing to restore factory tolerances.'
  },
  remanufacturing: {
    label: 'Industrial Remanufacturing',
    badgeClass: 'badge-primary',
    icon: '🏭',
    description: 'Rebuild core assemblies (alternators, cylinders, gearboxes) with full warranty.'
  },
  component_harvesting: {
    label: 'Component Harvesting',
    badgeClass: 'badge-success',
    icon: '🪛',
    description: 'Desolder or extract functioning ICs, motors, sensors, and discrete hardware.'
  },
  precious_metal_recovery: {
    label: 'Precious Metal Smelting',
    badgeClass: 'badge-warning',
    icon: '🪙',
    description: 'Hydrometallurgically refine gold, silver, copper, and platinum group metals.'
  },
  scrap_recycling: {
    label: 'Scrap Metal Recycling',
    badgeClass: 'badge-secondary',
    icon: '⚙️',
    description:
      'Melt segregated ferrous and non-ferrous alloys into secondary ingots (95% energy savings).'
  },
  chemical_recycling: {
    label: 'Polymer & Chemical Recycling',
    badgeClass: 'badge-secondary',
    icon: '🧪',
    description: 'Shred, wash, and re-pelletize engineering thermoplastics (HDPE, ABS, Nylon).'
  },
  hazardous_neutralization: {
    label: 'Hazardous Regulated Handling',
    badgeClass: 'badge-danger',
    icon: '⚠️',
    description:
      'Regulated neutralization and closed-loop recycling for batteries, chemicals, and solvents.'
  },
  redistribution: {
    label: 'Surplus Redistribution',
    badgeClass: 'badge-primary',
    icon: '🤝',
    description:
      'Route surplus inventory to secondary industrial markets or community food pantries.'
  },
  composting: {
    label: 'Aerobic Composting',
    badgeClass: 'badge-success',
    icon: '🌱',
    description: 'Decompose biodegradable organic matter into nutrient-dense humic soil humus.'
  },
  biogas: {
    label: 'Anaerobic Biogas',
    badgeClass: 'badge-warning',
    icon: '⚡',
    description: 'Convert organic residues into renewable biomethane fuel and clean electricity.'
  },
  pectin_recovery: {
    label: 'Pectin Extraction',
    badgeClass: 'badge-secondary',
    icon: '🧪',
    description:
      'Extract biological polymers from fruit rinds for food stabilizing and pharmaceuticals.'
  },
  material_recovery: {
    label: 'Material Recovery',
    badgeClass: 'badge-secondary',
    icon: '🔬',
    description: 'Upcycle residues into biomaterials, bio-fertilizers, or clean renewable biofuels.'
  },
  separate_disposal: {
    label: 'Specialized Disposal',
    badgeClass: 'badge-muted',
    icon: '🗑️',
    description: 'Segregate non-recyclable or contaminated residues to protect recycling purity.'
  }
};

export const WASTE_CATEGORY_METADATA = {
  edible_reusable: {
    label: 'Directly Reusable / Intact Component',
    badgeClass: 'badge-success',
    description: 'Intact, high-integrity hardware or clean edible food ready for immediate reuse.'
  },
  surplus_redistributable: {
    label: 'Surplus / Refurbishable',
    badgeClass: 'badge-primary',
    description: 'Surplus inventory, items needing minor servicing, or wholesome surplus food.'
  },
  unavoidable_organic: {
    label: 'Recyclable Scrap / Material Core',
    badgeClass: 'badge-warning',
    description:
      'Non-reusable material residue, scrap metal, polymers, or unavoidable organic scraps.'
  },
  other_separate: {
    label: 'Regulated / Hazardous Stream',
    badgeClass: 'badge-danger',
    description: 'Batteries, spent chemicals, contaminated packaging, or regulated e-waste.'
  }
};

/**
 * Loads active recovery rules from Supabase recovery_rules table, falling back to local defaults.
 * @returns {Promise<Array<object>>}
 */
export async function getActiveRecoveryRules() {
  try {
    const { data, error } = await supabase.from('recovery_rules').select('*').eq('is_active', true);

    if (error || !data || data.length === 0) {
      return DEFAULT_RECOVERY_RULES;
    }
    return data;
  } catch {
    return DEFAULT_RECOVERY_RULES;
  }
}

/**
 * Maps an advanced recovery method to one of the 7 core database check constraint values
 * to guarantee 100% database compatibility even on legacy or unmigrated Supabase databases.
 *
 * @param {string} method
 * @returns {string} One of: 'reuse', 'redistribution', 'composting', 'biogas', 'pectin_recovery', 'material_recovery', 'separate_disposal'
 */
export function mapToDbRecoveryMethod(method) {
  const m = (method || '').toLowerCase().trim();
  const VALID_DB_METHODS = new Set([
    'reuse',
    'redistribution',
    'composting',
    'biogas',
    'pectin_recovery',
    'material_recovery',
    'separate_disposal'
  ]);

  if (VALID_DB_METHODS.has(m)) return m;

  if (m === 'refurbishment' || m === 'remanufacturing') {
    return 'reuse';
  }
  if (
    m === 'component_harvesting' ||
    m === 'precious_metal_recovery' ||
    m === 'scrap_recycling' ||
    m === 'chemical_recycling'
  ) {
    return 'material_recovery';
  }
  if (m === 'hazardous_neutralization') {
    return 'separate_disposal';
  }
  if (m.includes('compost')) return 'composting';
  if (m.includes('biogas')) return 'biogas';
  if (m.includes('redistribut') || m.includes('donat')) return 'redistribution';
  if (m.includes('pectin')) return 'pectin_recovery';

  return 'material_recovery';
}

/**
 * Computes matching recovery pathway recommendations for a given waste item.
 * Supports multi-tier matching (material pattern, keyword inference, and category fallback)
 * covering organic food residues and inorganic industrial, mechanical, and electronic materials.
 *
 * @param {string} foodName
 * @param {string} wasteCategory
 * @param {string} [foodCategory]
 * @param {Array<object>} [rulesList]
 * @returns {Promise<Array<{ method: string, reason: string, requirements: string, estimatedValue: string, tier?: string }>>}
 */
export async function getRecoveryRecommendations(
  foodName = '',
  wasteCategory = '',
  foodCategory = '',
  rulesList = null
) {
  const rawMatches = [];

  // 1. If rulesList contains AI recovery options (with .method or .recovery_method), ingest them directly
  if (Array.isArray(rulesList) && rulesList.length > 0) {
    for (const item of rulesList) {
      if (!item || typeof item !== 'object') continue;
      const method = (item.method || item.recovery_method || '').toLowerCase().trim();
      if (method) {
        rawMatches.push({
          method,
          reason: item.reason || item.explanation || 'Matches recommended circular pathway.',
          requirements: item.requirements || 'Ensure proper collection and segregation.',
          estimatedValue:
            item.estimatedValue ||
            item.estimated_resource_value ||
            'Circular environmental diversion',
          tier: item.tier || 'household',
          score: 10
        });
      }
    }
  }

  // 2. Fetch and evaluate database recovery rules
  const dbRules = await getActiveRecoveryRules();
  const safeFoodName = typeof foodName === 'string' ? foodName : '';
  const safeFoodCategory = typeof foodCategory === 'string' ? foodCategory : '';
  const searchString = `${safeFoodName} ${safeFoodCategory}`.trim().toLowerCase();

  for (const rule of dbRules) {
    if (!rule || !rule.material_pattern) continue;
    try {
      const pattern = new RegExp(rule.material_pattern, 'i');
      const isMaterialMatch = pattern.test(searchString);
      const isCategoryMatch = rule.waste_category === wasteCategory;
      const method = (rule.recovery_method || rule.method || '').toLowerCase().trim();
      if (!method) continue;

      if (isMaterialMatch && isCategoryMatch) {
        rawMatches.push({
          method,
          reason:
            rule.explanation || 'Matches optimal circular pathway based on material composition.',
          requirements: rule.requirements || 'Ensure item is kept free of foreign contaminants.',
          estimatedValue: rule.estimated_resource_value || 'Circular environmental diversion',
          tier: rule.tier || 'household',
          score: 10
        });
      } else if (isMaterialMatch) {
        rawMatches.push({
          method,
          reason: rule.explanation || 'Targeted circular application for this material.',
          requirements: rule.requirements || 'Ensure proper collection conditions.',
          estimatedValue: rule.estimated_resource_value || 'Circular environmental diversion',
          tier: rule.tier || 'community',
          score: 7
        });
      }
    } catch {
      // Ignore invalid regex safely
    }
  }

  // 3. Intelligent Keyword Inference (Covers inorganic & organic unlisted inputs)
  if (rawMatches.length === 0) {
    // Inorganic Electronic & Electrical
    if (
      /(pcb|motherboard|logic board|\bchip\b|\bic\b|transistor|capacitor|resistor)/i.test(
        searchString
      )
    ) {
      rawMatches.push({
        method: 'material_recovery',
        reason:
          'Desolder and salvage functional high-value ICs, microcontrollers, and discrete components.',
        requirements: 'Use temperature-controlled hot air rework and ESD protection.',
        estimatedValue: 'High ($10–$50 salvaged electronic component value)',
        tier: 'community',
        score: 8
      });
    } else if (/(battery|18650|lithium|lead acid|lifepo4|\bcell\b)/i.test(searchString)) {
      rawMatches.push({
        method: 'separate_disposal',
        reason:
          'Isolate specialized hazardous material and route to closed-loop hydrometallurgical recycling.',
        requirements: 'Tape battery terminals; store in fire-retardant vermiculite container.',
        estimatedValue: 'Safety compliance & critical mineral recovery',
        tier: 'industrial',
        score: 8
      });
    } else if (/(bearing|ball bearing|roller bearing)/i.test(searchString)) {
      rawMatches.push({
        method: 'reuse',
        reason:
          'Ultrasonic degreasing and repacking with high-pressure grease restores operational tolerances.',
        requirements: 'Inspect raceways for micro-pitting; repack with EP2 synthetic grease.',
        estimatedValue: 'Medium ($5–$25 per refurbished precision bearing)',
        tier: 'community',
        score: 8
      });
    } else if (/(gear|sprocket|pulley|spline|shaft)/i.test(searchString)) {
      rawMatches.push({
        method: 'reuse',
        reason:
          'Re-machine gear teeth flanks or adapt keyways for secondary mechanical drive applications.',
        requirements: 'Check backlash and tooth root wear tolerances.',
        estimatedValue: 'High ($20–$80 per remanufactured machine drive gear)',
        tier: 'industrial',
        score: 8
      });
    } else if (/(bolt|screw|fastener|\bnut\b|stud|washer)/i.test(searchString)) {
      rawMatches.push({
        method: 'reuse',
        reason:
          'Clean, gauge, and organize into workshop inventory bins for maintenance and prototyping.',
        requirements: 'Check thread pitch with thread gauge; discard stretched fasteners.',
        estimatedValue: 'Workshop hardware inventory savings',
        tier: 'household',
        score: 8
      });
    } else if (/(aluminum|aluminium|extrusion|t-slot|6061)/i.test(searchString)) {
      rawMatches.push({
        method: 'reuse',
        reason:
          'Modular structural aluminum can be repurposed for machinery guarding, frames, and workbenches.',
        requirements: 'Check straightness and square cut ends on cold saw.',
        estimatedValue: 'High ($12–$45/meter structural framing value)',
        tier: 'community',
        score: 8
      });
      rawMatches.push({
        method: 'material_recovery',
        reason:
          'Melt into secondary alloy billet with 95% energy savings compared to primary smelting.',
        requirements: 'Keep free from iron bolts and non-metallic contamination.',
        estimatedValue: 'High ($1.80–$2.50/kg aluminum scrap)',
        tier: 'industrial',
        score: 7
      });
    } else if (/(copper|brass|bronze|wire|pipe|tubing)/i.test(searchString)) {
      rawMatches.push({
        method: 'material_recovery',
        reason:
          'Melt clean non-ferrous metal into secondary electrical-grade copper or foundry ingots.',
        requirements: 'Strip insulation or cut away lead solder joints.',
        estimatedValue: 'High ($5.50–$8.20/kg clean copper/brass scrap)',
        tier: 'industrial',
        score: 8
      });
    } else if (
      /(hdpe|polypropylene|\babs\b|nylon|polycarbonate|polymer|plastic)/i.test(searchString)
    ) {
      rawMatches.push({
        method: 'material_recovery',
        reason:
          'Shred, wash, and re-pelletize thermoplastic resin for secondary extrusion or molding.',
        requirements: 'Keep polymer resin codes strictly segregated to prevent contamination.',
        estimatedValue: 'Medium ($1.20–$2.40/kg clean regrind value)',
        tier: 'industrial',
        score: 8
      });
    } else if (/(concrete|brick|masonry|rubble)/i.test(searchString)) {
      rawMatches.push({
        method: 'material_recovery',
        reason: 'Crush and screen demolition rubble into DOT-certified road sub-base aggregate.',
        requirements: 'Separate rebar and foreign debris.',
        estimatedValue: 'Medium ($15–$25/ton aggregate value)',
        tier: 'industrial',
        score: 8
      });
    } else if (/(aloe|succulent|cactus|herbal|medicinal|gel)/i.test(searchString)) {
      rawMatches.push({
        method: 'reuse',
        reason:
          'Botanical succulent residues contain functional gel suitable for natural skincare or topical hydration.',
        requirements: 'Wash outer leaf thoroughly; fillet to extract clear inner gel.',
        estimatedValue: 'Natural botanical cosmetic & skincare savings',
        tier: 'household',
        score: 8
      });
      rawMatches.push({
        method: 'composting',
        reason:
          'High-moisture plant matter breaks down readily in aerobic composting, adding hydration to dry compost.',
        requirements: 'Chop thick leaves coarsely to speed decomposition.',
        estimatedValue: 'Soil organic carbon and moisture amendment',
        tier: 'household',
        score: 7
      });
    } else if (/(peel|rind|skin|zest|pomace|pulp|leaf|leaves)/i.test(searchString)) {
      rawMatches.push({
        method: 'composting',
        reason:
          'Fruit and plant skins decompose quickly in aerobic compost, generating nutrient-rich humus.',
        requirements: 'Chop coarsely; keep free of synthetic stickers and non-organic coatings.',
        estimatedValue: 'Restores organic garden soil fertility',
        tier: 'household',
        score: 6
      });
      rawMatches.push({
        method: 'pectin_recovery',
        reason:
          'Fruit peels and fibrous skins contain structural pectins suitable for bio-refining.',
        requirements: 'Requires regional biochemical processing facility.',
        estimatedValue: 'High bio-polymer value',
        tier: 'industrial',
        score: 5
      });
    } else if (
      /(bone|carcass|marrow|meat|poultry|pork|beef|fish|seafood|chicken)/i.test(searchString)
    ) {
      rawMatches.push({
        method: 'reuse',
        reason:
          'Animal and fish bones can be simmered to extract nourishing culinary broth and gelatin.',
        requirements: 'Simmer with clean water; strain thoroughly before use.',
        estimatedValue: 'Culinary stock grocery savings',
        tier: 'household',
        score: 6
      });
      rawMatches.push({
        method: 'biogas',
        reason:
          'Protein- and fat-dense animal residues generate superior methane yields in anaerobic digesters.',
        requirements: 'Requires municipal or industrial thermophilic digester.',
        estimatedValue: 'High green electricity generation',
        tier: 'industrial',
        score: 5
      });
    } else if (/(oil|grease|fat|butter|lard|tallow)/i.test(searchString)) {
      rawMatches.push({
        method: 'material_recovery',
        reason:
          'Used fats and oils are chemically transesterified into ASTM-certified clean biodiesel.',
        requirements: 'Store in airtight containers; never pour down municipal wastewater drains.',
        estimatedValue: 'High renewable liquid fuel value',
        tier: 'industrial',
        score: 6
      });
    } else if (/(seed|pit|stone|shell|husk|nut)/i.test(searchString)) {
      rawMatches.push({
        method: 'material_recovery',
        reason:
          'Hard lignified shells and pits can be crushed into natural abrasives, activated carbon, or mulch.',
        requirements: 'Rinse away soft pulp and dry thoroughly before collection.',
        estimatedValue: 'Durable bio-composite material value',
        tier: 'industrial',
        score: 6
      });
    } else if (
      /(bread|bakery|dough|crust|pastry|flour|grain|rice|pasta|noodle)/i.test(searchString)
    ) {
      if (wasteCategory === 'surplus_redistributable') {
        rawMatches.push({
          method: 'redistribution',
          reason: 'Wholesome surplus grain and bakery products support local community nutrition.',
          requirements: 'Must be within use-by dates, wholesome, and stored dry.',
          estimatedValue: 'Immediate community food security',
          tier: 'community',
          score: 6
        });
      } else {
        rawMatches.push({
          method: 'reuse',
          reason:
            'Stale grain and bread items can be toasted into breadcrumbs, croutons, or fermented.',
          requirements: 'Ensure zero signs of mold or off-odors.',
          estimatedValue: 'Pantry grocery savings',
          tier: 'household',
          score: 6
        });
      }
    }
  }

  // 4. Fallback based on waste category if still no match
  if (rawMatches.length === 0) {
    if (wasteCategory === 'edible_reusable') {
      rawMatches.push({
        method: 'reuse',
        reason: 'Item is intact and suitable for direct reuse or culinary consumption.',
        requirements: 'Ensure clean and uncontaminated handling.',
        estimatedValue: 'Direct replacement and savings value',
        tier: 'household',
        score: 4
      });
    } else if (wasteCategory === 'surplus_redistributable') {
      rawMatches.push({
        method: 'redistribution',
        reason: 'Wholesome surplus or reusable hardware suitable for secondary distribution.',
        requirements: 'Ensure proper sorting and transport.',
        estimatedValue: 'Direct community or secondary market value',
        tier: 'community',
        score: 4
      });
    } else if (wasteCategory === 'unavoidable_organic') {
      rawMatches.push({
        method: 'composting',
        reason: 'Organic plant material decomposes into beneficial soil compost.',
        requirements: 'Keep free from plastics, stickers, chemicals, and excess salt or fat.',
        estimatedValue: 'Rich organic soil amendment',
        tier: 'household',
        score: 4
      });
    } else {
      rawMatches.push({
        method: 'separate_disposal',
        reason: 'Isolate specialized or hazardous materials from general waste streams.',
        requirements: 'Check local regulations for certified hazardous or e-waste disposal.',
        estimatedValue: 'Prevents environmental contamination',
        tier: 'household',
        score: 4
      });
    }
  }

  // Deduplicate matches by recovery method, picking highest score
  const dedupedMap = new Map();
  for (const match of rawMatches) {
    if (!match || !match.method) continue;
    if (!dedupedMap.has(match.method) || dedupedMap.get(match.method).score < match.score) {
      dedupedMap.set(match.method, match);
    }
  }

  const result = Array.from(dedupedMap.values()).map((m) => ({
    method: m.method,
    reason: m.reason || 'Circular resource recovery.',
    requirements: m.requirements || 'Ensure proper collection conditions.',
    estimatedValue: m.estimatedValue || 'Circular environmental diversion',
    tier: m.tier || 'household'
  }));

  if (result.length === 0) {
    result.push({
      method: 'material_recovery',
      reason: 'Circular material recovery pathway.',
      requirements: 'Keep free from foreign contaminants.',
      estimatedValue: 'Material diversion',
      tier: 'household'
    });
  }

  return result;
}

/**
 * Creates a new recovery record tied to a scan.
 * Automatically maps advanced methods to valid DB constraints.
 *
 * @param {object} params
 * @param {string} params.scanId - UUID of the parent food scan
 * @param {string} params.userId - UUID of the authenticated user
 * @param {string} params.recoveryMethod - Recovery method name
 * @param {string} params.reason - Recommendation reason
 * @param {string} [params.estimatedValue] - Estimated resource value
 * @param {'suggested'|'planned'|'completed'|'dismissed'} [params.status='suggested']
 * @returns {Promise<object>} Created record
 */
export async function createRecoveryRecord({
  scanId,
  userId,
  recoveryMethod,
  reason,
  estimatedValue = null,
  status = 'suggested'
}) {
  const finalMethod = mapToDbRecoveryMethod(recoveryMethod);

  const { data, error } = await supabase
    .from('recovery_records')
    .insert({
      user_id: userId,
      scan_id: scanId,
      recovery_method: finalMethod,
      recommendation_reason: reason || 'Recommended circular resource recovery pathway.',
      estimated_resource_value: estimatedValue,
      status: status
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create recovery record: ${error.message}`);
  }

  return data;
}

/**
 * Loads the user's recovery records, optionally filtered by status.
 *
 * @param {'all'|'suggested'|'planned'|'completed'|'dismissed'} [statusFilter='all']
 * @returns {Promise<Array<object>>}
 */
export async function loadUserRecoveries(statusFilter = 'all') {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('User must be authenticated to load recovery records.');
  }

  let query = supabase
    .from('recovery_records')
    .select('*, food_scans(food_name, food_category, waste_category, quantity, quantity_unit)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load recovery records: ${error.message}`);
  }

  return data || [];
}

/**
 * Updates the workflow status of a circular recovery record.
 *
 * @param {string} recordId - UUID of the recovery record
 * @param {'suggested'|'planned'|'completed'|'dismissed'} newStatus
 * @returns {Promise<object>} Updated record
 */
export async function updateRecoveryStatus(recordId, newStatus) {
  const VALID_STATUSES = ['suggested', 'planned', 'completed', 'dismissed'];
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid recovery status: ${newStatus}`);
  }

  const { data, error } = await supabase
    .from('recovery_records')
    .update({ status: newStatus })
    .eq('id', recordId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update recovery status: ${error.message}`);
  }

  return data;
}
