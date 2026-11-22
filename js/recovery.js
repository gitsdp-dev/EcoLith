import { supabase } from './supabase.js';

/**
 * Built-in circular resource recovery rules fallback (22 comprehensive rules).
 * Ensures instant, reliable recommendations for every type of food waste and user persona
 * (Home cooks, restaurants, bakeries, cafes, food banks, and municipal processors).
 */
export const DEFAULT_RECOVERY_RULES = [
  // 1. Citrus Peels / Rinds (Pectin Extraction)
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
  // 2. Citrus Peels / Rinds (Aerobic Composting)
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
  // 3. Banana & Tropical Fruit Peels
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
  // 4. Pome Fruits & Pomace (Apple, Pear, Quince)
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
  // 5. Spent Coffee Grounds & Tea Leaves (Mushroom Substrate)
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
  // 5b. Aloe Vera & Botanical Succulents
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
  // 6. Spent Coffee Grounds (Compost Activator)
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
  // 7. Surplus Fresh Bakery & Bread (Food Rescue)
  {
    material_pattern: 'bread|bakery|pastry|croissant|bagel|bun|loaf|fresh bread',
    waste_category: 'surplus_redistributable',
    recovery_method: 'redistribution',
    requirements:
      'Must be wholesome, unexpired, stored dry in original sealed food-grade packaging; verify allergen labeling (gluten, dairy, nuts).',
    explanation:
      'Fresh surplus baked goods can be immediately diverted to local hunger relief charities, community pantries, and youth breakfast clubs.',
    estimated_resource_value: 'High (Immediate human caloric and social impact: ~2,500 kcal/kg)',
    category_group: 'bakery',
    tier: 'community'
  },
  // 8. Stale Bread & Crusts (Culinary Upcycling)
  {
    material_pattern: 'stale bread|bread crust|baguette|pita|tortilla|crouton',
    waste_category: 'edible_reusable',
    recovery_method: 'reuse',
    requirements:
      'Ensure zero signs of visible mold; bake at low heat (150°C) until bone dry, or store in sealed jars.',
    explanation:
      'Stale bread can be transformed into shelf-stable seasoned croutons, Japanese-style panko breadcrumbs, French toast, bread pudding, or kvass.',
    estimated_resource_value: 'Medium ($4–$8 equivalent pantry grocery savings)',
    category_group: 'bakery',
    tier: 'household'
  },
  // 9. Spent Brewer's Grain & Distillery Mash
  {
    material_pattern:
      'spent.*grain|brewer.*grain|brewery mash|malt residue|distillery grain|spent mash',
    waste_category: 'unavoidable_organic',
    recovery_method: 'material_recovery',
    requirements:
      'Dehydrate promptly within 6 hours of brewing to prevent lactic souring; store in moisture-sealed totes.',
    explanation:
      'Spent barley grain contains up to 20% protein and 70% fiber, making it a high-value input for upcycled baking flours, artisanal dog biscuits, and livestock feed.',
    estimated_resource_value: 'High ($0.50–$1.20/kg high-protein animal feed value)',
    category_group: 'grain',
    tier: 'industrial'
  },
  // 10. Clean Vegetable Scraps & Tops (Stock Simmering)
  {
    material_pattern:
      'vegetable scrap|carrot peel|onion skin|celery top|leek green|herb stem|root peel',
    waste_category: 'unavoidable_organic',
    recovery_method: 'reuse',
    requirements:
      'Wash thoroughly to remove soil grit; freeze in a dedicated sealed container until gathering a 500g batch; avoid brassicas (cabbage/broccoli can impart bitterness).',
    explanation:
      'Clean vegetable trimmings simmered with water and bay leaves yield an aromatic, nutrient-rich culinary vegetable stock for soups and risottos.',
    estimated_resource_value: 'Low-Medium ($3–$6 commercial stock replacement)',
    category_group: 'vegetable',
    tier: 'household'
  },
  // 11. Raw Vegetable Scraps & Salad Greens (Composting)
  {
    material_pattern: 'raw vegetable scrap|salad greens|leafy green|cabbage|lettuce|spinach|kale',
    waste_category: 'unavoidable_organic',
    recovery_method: 'composting',
    requirements:
      'Mix high-moisture greens with dry brown leaves or shredded cardboard in a 1:2 volume ratio to prevent anaerobic slime.',
    explanation:
      'Microbial aerobic digestion converts succulent vegetable matter into bioactive organic humus that rebuilds soil structure and locks in soil moisture.',
    estimated_resource_value: 'Medium (Prevents 0.8 kg CO2e per kg landfill diversion)',
    category_group: 'vegetable',
    tier: 'household'
  },
  // 12. Surplus Whole Produce & Blemished Produce
  {
    material_pattern:
      'whole fruit|whole vegetable|blemished fruit|ugly produce|surplus produce|farm surplus',
    waste_category: 'surplus_redistributable',
    recovery_method: 'redistribution',
    requirements:
      'Sort to remove bruised or decaying specimens; pack in clean ventilated crates; maintain ambient or cool conditions.',
    explanation:
      'Cosmetically imperfect but nutritionally wholesome produce can be supplied directly to community kitchen gleaning programs and food banks.',
    estimated_resource_value: 'High (Saves 100% of embedded farm water and labor)',
    category_group: 'produce',
    tier: 'community'
  },
  // 13. Cooked Food & Prepared Meal Leftovers
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
  // 14. Surplus Dairy, Milk & Whey
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
  // 15. Commercial Surplus Dairy (Food Rescue)
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
  // 16. Used Cooking Oil & Deep Fryer Grease
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
  // 17. Eggshells (Calcium Soil Amendment)
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
  // 18. Meat Bones & Carcasses (Broth Extraction)
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
  // 19. Meat Bones & Animal Offal (Anaerobic Biogas)
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
  // 20. Seafood Byproducts & Crustacean Shells
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
  // 21. Nut Shells & Fruit Pits
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
  // 22. Contaminated Food Packaging & Waxed Paper
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
    label: 'Direct Reuse',
    badgeClass: 'badge-success',
    icon: '🔁',
    description: 'Transform or repurpose in the kitchen or home before discarding.'
  },
  redistribution: {
    label: 'Redistribution',
    badgeClass: 'badge-primary',
    icon: '🤝',
    description: 'Donate safe surplus food to local community food pantries or shelters.'
  },
  composting: {
    label: 'Aerobic Composting',
    badgeClass: 'badge-success',
    icon: '🌱',
    description: 'Decompose organic matter into nutrient-dense humus for soil regeneration.'
  },
  biogas: {
    label: 'Anaerobic Biogas',
    badgeClass: 'badge-warning',
    icon: '⚡',
    description: 'Convert high-energy food residue into renewable biogas and green electricity.'
  },
  pectin_recovery: {
    label: 'Pectin Extraction',
    badgeClass: 'badge-secondary',
    icon: '🧪',
    description: 'Extract valuable biological polymers from fruit rinds for food and medicine.'
  },
  material_recovery: {
    label: 'Material Recovery',
    badgeClass: 'badge-secondary',
    icon: '🔬',
    description: 'Upcycle residues into biomaterials, mushroom substrate, or clean biofuel.'
  },
  separate_disposal: {
    label: 'Specialized Disposal',
    badgeClass: 'badge-muted',
    icon: '🗑️',
    description: 'Segregate non-compostable food contact waste to avoid contamination.'
  }
};

export const WASTE_CATEGORY_METADATA = {
  edible_reusable: {
    label: 'Edible Leftover / Reusable',
    badgeClass: 'badge-success',
    description: 'Clean, safe leftovers or trimmings suitable for meals or culinary reuse.'
  },
  surplus_redistributable: {
    label: 'Surplus Food (Redistributable)',
    badgeClass: 'badge-primary',
    description: 'Wholesome surplus food ideal for donation before quality declines.'
  },
  unavoidable_organic: {
    label: 'Unavoidable Organic Residue',
    badgeClass: 'badge-warning',
    description:
      'Inedible organic parts (peels, grounds, shells, bones) ready for circular processing.'
  },
  other_separate: {
    label: 'Specialized Stream',
    badgeClass: 'badge-muted',
    description: 'Fats, oils, or contaminated residues requiring isolated collection.'
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
 * Computes matching recovery pathway recommendations for a given food waste item.
 * Supports multi-tier matching (material pattern, keyword inference, and category fallback)
 * to provide comprehensive, actionable coverage for any user type.
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

  // 3. Intelligent Keyword Inference (Covers arbitrary / exotic unlisted inputs)
  if (rawMatches.length === 0) {
    if (/(aloe|succulent|cactus|herbal|medicinal|gel)/i.test(searchString)) {
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

  // 3. Fallback based on waste category if still no match
  if (rawMatches.length === 0) {
    if (wasteCategory === 'edible_reusable') {
      rawMatches.push({
        method: 'reuse',
        reason: 'Edible portions can be safely consumed or incorporated into new recipes.',
        requirements:
          'Store below 4°C within 2 hours; reheat thoroughly to 74°C before consumption.',
        estimatedValue: 'Avoids new grocery expenditure',
        tier: 'household',
        score: 4
      });
    } else if (wasteCategory === 'surplus_redistributable') {
      rawMatches.push({
        method: 'redistribution',
        reason: 'Wholesome surplus can support local community nutrition.',
        requirements:
          'Must be within use-by dates and unadulterated; follow food rescue guidelines.',
        estimatedValue: 'Direct social impact',
        tier: 'community',
        score: 4
      });
    } else if (wasteCategory === 'unavoidable_organic') {
      rawMatches.push({
        method: 'composting',
        reason: 'Plant-based organic matter decomposes into beneficial soil compost.',
        requirements: 'Keep free from plastics, stickers, chemicals, and excess salt or fat.',
        estimatedValue: 'Rich organic soil amendment',
        tier: 'household',
        score: 4
      });
    } else {
      rawMatches.push({
        method: 'separate_disposal',
        reason: 'Isolate contaminated materials from clean organic waste streams.',
        requirements: 'Check local municipal guidelines for specialized disposal.',
        estimatedValue: 'Prevents landfill stream contamination',
        tier: 'household',
        score: 4
      });
    }
  }

  // Deduplicate matches by recovery method, picking the highest-scoring explanation
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
      method: 'composting',
      reason: 'Organic plant material decomposes into beneficial soil compost.',
      requirements: 'Keep free from plastics, stickers, chemicals, and contaminants.',
      estimatedValue: 'Rich organic soil amendment',
      tier: 'household'
    });
  }

  return result;
}

/**
 * Creates a new recovery record tied to a food scan.
 *
 * @param {object} params
 * @param {string} params.scanId - UUID of the parent food scan
 * @param {string} params.userId - UUID of the authenticated user
 * @param {string} params.recoveryMethod - One of approved methods
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
  const VALID_METHODS = new Set([
    'reuse',
    'redistribution',
    'composting',
    'biogas',
    'pectin_recovery',
    'material_recovery',
    'separate_disposal'
  ]);

  let finalMethod = (recoveryMethod || '').toLowerCase().trim();
  if (!VALID_METHODS.has(finalMethod)) {
    if (finalMethod.includes('compost')) finalMethod = 'composting';
    else if (
      finalMethod.includes('reuse') ||
      finalMethod.includes('craft') ||
      finalMethod.includes('skin')
    )
      finalMethod = 'reuse';
    else if (finalMethod.includes('redistribut') || finalMethod.includes('donat'))
      finalMethod = 'redistribution';
    else if (
      finalMethod.includes('biogas') ||
      finalMethod.includes('energy') ||
      finalMethod.includes('fuel')
    )
      finalMethod = 'biogas';
    else if (finalMethod.includes('pectin')) finalMethod = 'pectin_recovery';
    else if (finalMethod.includes('material') || finalMethod.includes('extract'))
      finalMethod = 'material_recovery';
    else if (finalMethod.includes('dispos') || finalMethod.includes('separate'))
      finalMethod = 'separate_disposal';
    else finalMethod = 'composting'; // Fail-safe guaranteed valid enum
  }

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
export async function fetchUserRecoveryRecords(statusFilter = 'all') {
  let query = supabase
    .from('recovery_records')
    .select(
      `
      id,
      scan_id,
      recovery_method,
      recommendation_reason,
      estimated_resource_value,
      status,
      created_at,
      food_scans (
        id,
        food_name,
        food_category,
        waste_category,
        quantity,
        quantity_unit,
        created_at
      )
    `
    )
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch recovery records: ${error.message}`);
  }

  return data || [];
}

/**
 * Updates the status of an existing recovery record.
 *
 * @param {string} recordId - UUID of the recovery record
 * @param {'suggested'|'planned'|'completed'|'dismissed'} newStatus
 * @returns {Promise<object>}
 */
export async function updateRecoveryRecordStatus(recordId, newStatus) {
  const { data, error } = await supabase
    .from('recovery_records')
    .update({ status: newStatus })
    .eq('id', recordId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update recovery record: ${error.message}`);
  }

  return data;
}
