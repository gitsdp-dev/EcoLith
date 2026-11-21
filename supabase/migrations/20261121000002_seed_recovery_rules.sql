-- =============================================================================
-- EcoLith Phase 3 Seed: Comprehensive Circular Economy Recovery Rules
-- Covers all organic waste categories and scales (Household, Community, Industrial)
-- =============================================================================

insert into public.recovery_rules (
  material_pattern,
  waste_category,
  recovery_method,
  requirements,
  explanation,
  is_active
) values
-- 1. Citrus Peels / Rinds (Pectin Extraction)
(
  'citrus|lemon|orange|lime|grapefruit|tangerine|citron|peel|rind',
  'unavoidable_organic',
  'pectin_recovery',
  'Requires access to specialized biochemical or industrial extraction facility; free from synthetic fruit stickers and waxes.',
  'Citrus rinds are abundant in natural polysaccharides, yielding commercial-grade pectin used in food stabilizing, confectionery, and pharmaceutical capsules.',
  true
),
-- 2. Citrus Peels / Rinds (Aerobic Composting)
(
  'citrus|lemon|orange|lime|grapefruit|tangerine|citron',
  'unavoidable_organic',
  'composting',
  'Chop or shred rinds into small pieces; mix well with dry brown carbon; avoid over-concentrating in vermicompost (earthworms are sensitive to citric acid).',
  'Aerobic composting breaks down citrus cellulose and terpenes into rich humic matter, retaining soil moisture and adding trace micronutrients.',
  true
),
-- 3. Banana & Tropical Fruit Peels
(
  'banana|plantain|mango skin|papaya peel|tropical fruit peel',
  'unavoidable_organic',
  'material_recovery',
  'Air-dry or bake at 80°C to dehydrate; pulverize or steep in water for nutrient extraction.',
  'Banana and plantain peels are extraordinarily rich in bioavailable potassium (K) and phosphorus (P), yielding rapid-uptake liquid organic plant fertilizer.',
  true
),
-- 4. Pome Fruits & Pomace (Apple, Pear, Quince)
(
  'apple|pear|quince|cider pomace|fruit core',
  'unavoidable_organic',
  'pectin_recovery',
  'Process press cake or cores within 12 hours of juicing or freeze to prevent spontaneous wild fermentation.',
  'Apple pomace contains high-methoxyl pectin and dietary fiber, suitable for upcycled prebiotic dietary fiber ingredients and thickening agents.',
  true
),
-- 5. Spent Coffee Grounds & Tea Leaves (Mushroom Substrate)
(
  'coffee ground|spent coffee|coffee residue|tea leaf|tea leaves|spent tea',
  'unavoidable_organic',
  'material_recovery',
  'Dry thoroughly before storage to prevent green mold; blend with pasteurized straw or hardwood sawdust substrate at a 1:3 ratio.',
  'Spent coffee grounds and tea leaves provide ideal nitrogen, lignin, and mineral profiles for cultivating gourmet oyster and lion''s mane mushrooms.',
  true
),
-- 6. Spent Coffee Grounds (Compost Activator)
(
  'coffee ground|spent coffee|tea leaf|tea leaves',
  'unavoidable_organic',
  'composting',
  'Spread evenly across compost layers; count grounds as green nitrogen-rich material despite their dark brown color.',
  'Coffee grounds heat up compost piles rapidly to thermophilic levels (55°C–65°C), accelerating the breakdown of stubborn dry leaves and yard waste.',
  true
),
-- 7. Surplus Fresh Bakery & Bread (Food Rescue)
(
  'bread|bakery|pastry|croissant|bagel|bun|loaf|fresh bread',
  'surplus_redistributable',
  'redistribution',
  'Must be wholesome, unexpired, stored dry in original sealed food-grade packaging; verify allergen labeling (gluten, dairy, nuts).',
  'Fresh surplus baked goods can be immediately diverted to local hunger relief charities, community pantries, and youth breakfast clubs.',
  true
),
-- 8. Stale Bread & Crusts (Culinary Upcycling)
(
  'stale bread|bread crust|baguette|pita|tortilla|crouton',
  'edible_reusable',
  'reuse',
  'Ensure zero signs of visible mold; bake at low heat (150°C) until bone dry, or store in sealed jars.',
  'Stale bread can be transformed into shelf-stable seasoned croutons, Japanese-style panko breadcrumbs, French toast, bread pudding, or kvass.',
  true
),
-- 9. Spent Brewer''s Grain & Distillery Mash
(
  'spent.*grain|brewer.*grain|brewery mash|malt residue|distillery grain|spent mash',
  'unavoidable_organic',
  'material_recovery',
  'Dehydrate promptly within 6 hours of brewing to prevent lactic souring; store in moisture-sealed totes.',
  'Spent barley grain contains up to 20% protein and 70% fiber, making it a high-value input for upcycled baking flours, artisanal dog biscuits, and livestock feed.',
  true
),
-- 10. Clean Vegetable Scraps & Tops (Stock Simmering)
(
  'vegetable scrap|carrot peel|onion skin|celery top|leek green|herb stem|root peel',
  'unavoidable_organic',
  'reuse',
  'Wash thoroughly to remove soil grit; freeze in a dedicated sealed container until gathering a 500g batch; avoid brassicas (cabbage/broccoli can impart bitterness).',
  'Clean vegetable trimmings simmered with water and bay leaves yield an aromatic, nutrient-rich culinary vegetable stock for soups and risottos.',
  true
),
-- 11. Raw Vegetable Scraps & Salad Greens (Composting)
(
  'raw vegetable scrap|salad greens|leafy green|cabbage|lettuce|spinach|kale',
  'unavoidable_organic',
  'composting',
  'Mix high-moisture greens with dry brown leaves or shredded cardboard in a 1:2 volume ratio to prevent anaerobic slime.',
  'Microbial aerobic digestion converts succulent vegetable matter into bioactive organic humus that rebuilds soil structure and locks in soil moisture.',
  true
),
-- 12. Surplus Whole Produce & Blemished Produce
(
  'whole fruit|whole vegetable|blemished fruit|ugly produce|surplus produce|farm surplus',
  'surplus_redistributable',
  'redistribution',
  'Sort to remove bruised or decaying specimens; pack in clean ventilated crates; maintain ambient or cool conditions.',
  'Cosmetically imperfect but nutritionally wholesome produce can be supplied directly to community kitchen gleaning programs and food banks.',
  true
),
-- 13. Cooked Food & Prepared Meal Leftovers
(
  'cooked food|cooked meal|prepared surplus|curry|casserole|pasta dish|rice dish|leftover meal',
  'edible_reusable',
  'reuse',
  'Rapidly cool to below 4°C within 2 hours of cooking; store in airtight food-grade glass containers; reheat to 74°C internal temperature before eating.',
  'Structured meal planning, proper refrigeration, and creative ingredient recombination prevent wholesome prepared foods from premature disposal.',
  true
),
-- 14. Surplus Dairy, Milk & Whey
(
  'surplus milk|dairy|yogurt|cream|whey|curd|cottage cheese',
  'edible_reusable',
  'reuse',
  'Check for clean lactic aroma; ensure continuous cold-chain storage below 4°C.',
  'Surplus whole milk can be gently curdled with vinegar or lemon juice to create fresh homemade ricotta or paneer; acid whey replaces water in sourdough baking.',
  true
),
-- 15. Commercial Surplus Dairy (Food Rescue)
(
  'surplus milk|carton milk|sealed cheese|packaged dairy',
  'surplus_redistributable',
  'redistribution',
  'Must be factory-sealed, unadulterated, and within manufacturer sell-by/use-by guidelines with unbroken cold-chain transport.',
  'Sealed surplus dairy provides essential calcium and bioavailable protein to regional food pantries and family shelter networks.',
  true
),
-- 16. Used Cooking Oil & Deep Fryer Grease
(
  'used cooking oil|fryer oil|grease|vegetable fat|tallow|lard|spent oil',
  'other_separate',
  'material_recovery',
  'Strain out food particles through a fine metal sieve; store in sealed leakproof steel drums or food-grade poly jugs; never pour into drains.',
  'Collected fats and oils undergo transesterification in processing refineries to produce certified ASTM D6751 biodiesel and renewable aviation fuels.',
  true
),
-- 17. Eggshells (Calcium Soil Amendment)
(
  'egg shell|eggshell',
  'unavoidable_organic',
  'material_recovery',
  'Rinse out egg white albumen residue; heat-sterilize at 100°C for 10 minutes; pulverize into fine powder with a grinder or mortar.',
  'Eggshells are 95% bioavailable calcium carbonate; powder applied around nightshades (tomatoes, peppers) prevents blossom-end rot and balances acidic soil pH.',
  true
),
-- 18. Meat Bones & Carcasses (Broth Extraction)
(
  'meat bone|animal carcass|chicken bone|beef bone|bone scrap',
  'unavoidable_organic',
  'reuse',
  'Roast bones at 200°C for 30 minutes for flavor; simmer with water and an acid splash (apple cider vinegar) for 8–18 hours.',
  'Slow simmering extracts deep collagen, gelatin, and bone marrow minerals into highly nourishing, gut-healthy culinary bone broth.',
  true
),
-- 19. Meat Bones & Animal Offal (Anaerobic Biogas)
(
  'meat bone|animal carcass|connective tissue|offal|animal byproduct',
  'unavoidable_organic',
  'biogas',
  'Requires commercial thermophilic anaerobic digestion facility; avoid standard backyard home compost to prevent rodent and carnivore attraction.',
  'High lipid and protein contents generate superior biomethane yields in industrial digesters, generating clean electrical power and bio-fertilizer digestate.',
  true
),
-- 20. Seafood Byproducts & Crustacean Shells
(
  'crustacean shell|shrimp shell|crab shell|lobster shell|fish bone|fish scrap',
  'unavoidable_organic',
  'material_recovery',
  'Rinse and dry shells promptly; collect in segregated freezer storage to prevent odors.',
  'Crustacean carapaces are a premier source of natural chitin and chitosan, refined into biodegradable bioplastics, water treatment flocculants, and seed coatings.',
  true
),
-- 21. Nut Shells & Fruit Pits
(
  'nut shell|walnut shell|coconut shell|pecan shell|avocado pit|peach stone|fruit pit',
  'unavoidable_organic',
  'material_recovery',
  'Clean away soft fruit pulp; dry thoroughly in ambient sunlight or low heat.',
  'Hard lignocellulose shells and pits are ground for natural cosmetics exfoliants, industrial blast abrasives, activated carbon filters, or high-BTU biomass briquettes.',
  true
),
-- 22. Contaminated Food Packaging & Waxed Paper
(
  'takeout container|greasy cardboard|food packaging|waxed paper|soiled packaging|napkin',
  'other_separate',
  'separate_disposal',
  'Remove all loose organic food scraps; separate recyclable plastics or metals from unrecyclable PFAS-treated paper or grease-soaked cardboard.',
  'Prevents contaminated materials from degrading municipal compost batches and ensures plastics enter proper chemical recycling streams.',
  true
);
