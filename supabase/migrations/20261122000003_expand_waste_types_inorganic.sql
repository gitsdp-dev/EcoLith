-- =============================================================================
-- EcoLith Migration: Universal Circular Resource Management Expansion
-- Enables Full Support for Inorganic Industrial, Mechanical, Electronic,
-- Polymer, Metal, and Construction Waste Streams alongside Organic Waste
-- =============================================================================

-- 1. Seed Comprehensive Inorganic & Industrial Recovery Rules
INSERT INTO public.recovery_rules (
  material_pattern,
  waste_category,
  recovery_method,
  requirements,
  explanation,
  is_active
) VALUES
-- Electronic E-waste & PCBs (Component Harvesting)
(
  'pcb|circuit|motherboard|logic board|microcontroller|integrated circuit|\bic\b|server board',
  'unavoidable_organic',
  'material_recovery',
  'Use temperature-controlled hot air rework stations and ESD-safe grounding to desolder undamaged discrete components (FPGA, MOSFETs, tantalum capacitors, quartz crystals).',
  'High-density server and computer circuit boards contain functioning microprocessors, power ICs, and high-purity gold-plated pin headers suitable for component harvesting.',
  true
),
-- Electronic E-waste & PCBs (Precious Metal Smelting)
(
  'pcb|circuit|motherboard|logic board|e-waste|telecom board|ram stick|gold contact',
  'unavoidable_organic',
  'material_recovery',
  'Consolidate in dry totes; route to ISO 14001 / R2 certified electronic scrap smelting and hydrometallurgical refining refineries; avoid open-flame burning.',
  'Printed circuit boards yield 100–300g gold, 1kg silver, and 100kg copper per metric ton, exceeding the yield of primary raw ore mining by 40-50x.',
  true
),
-- Lithium-Ion Battery Storage (Regulated Isolation)
(
  'battery|lithium|18650|lifepo4|li-ion|battery pack|cell pack|prismatic \bcell\b',
  'other_separate',
  'separate_disposal',
  'Tape open terminals with non-conductive electrical tape; store in non-combustible sand or vermiculite containers; never puncture, crush, or heat.',
  'Spent lithium-ion battery cells undergo cryogenic shredding and hydrometallurgical leaching to recover battery-grade lithium carbonate, nickel sulfate, and cobalt.',
  true
),
-- Electric & Stepper Motors (Refurbishment)
(
  'electric motor|stepper motor|servo motor|bldc motor|alternator rotor|induction motor',
  'edible_reusable',
  'reuse',
  'Measure phase winding resistance; inspect bearings for play; clean shaft and repack grease to restore operational specification.',
  'Industrial electric motors and precision steppers feature robust lamination stacks that can be rebuilt with new bearings and brushes for robotics and automation.',
  true
),
-- Scrap Copper Wiring & Cables
(
  'copper wire|electrical cable|wiring harness|copper winding|busbar|coaxial cable',
  'unavoidable_organic',
  'material_recovery',
  'Mechanically strip outer PVC/rubber insulation with automated rotary wire strippers; keep bare bright copper (Millberry) segregated.',
  'Scrap electrical copper maintains 100% of its electrical conductivity upon remelting, requiring 85% less energy than producing virgin copper from chalcopyrite ore.',
  true
),
-- Precision Ball & Roller Bearings
(
  'bearing|ball bearing|roller bearing|tapered bearing|pillow block|needle bearing',
  'edible_reusable',
  'reuse',
  'Degrease in solvent wash; inspect raceway for micro-pitting or brinelling using dial indicator; repack with EP2 synthetic lithium grease.',
  'Quality 52100 chrome steel ball bearings with minor cosmetic wear can be inspected, cleaned, and redeployed in secondary low-speed conveyors or workshop equipment.',
  true
),
-- Gears, Sprockets & Spline Shafts
(
  'gear|sprocket|spline shaft|timing pulley|spur gear|bevel gear|helical gear',
  'edible_reusable',
  'reuse',
  'Check pitch line wear and tooth flank backlash; re-machine root radius or induction harden for secondary mechanical drives.',
  'Carburized steel gears can be resurfaced or adapted with keyways for custom mechanical drives, prototype gearboxes, or agricultural repairs.',
  true
),
-- High-Tensile Structural Fasteners
(
  'bolt|fastener|screw|hex nut|stud|socket cap|machine screw|high tensile|grade 8.8|grade 10.9',
  'edible_reusable',
  'reuse',
  'Clean in ultrasonic bath; check thread pitch with thread gauge; discard any stretched neck or stripped fasteners.',
  'High-strength structural and alloy steel fasteners can be segregated into hardware storage bin systems for maintenance and prototyping.',
  true
),
-- Hydraulic & Pneumatic Cylinders and Valves
(
  'hydraulic cylinder|pneumatic cylinder|hydraulic valve|directional valve|spool valve|manifold',
  'edible_reusable',
  'reuse',
  'Inspect chrome rod for scoring; hone cylinder bore; install replacement polyurethane U-cup seal and wiper kit; pressure test to 200 bar.',
  'Hydraulic rams and valves are engineered for multi-decade service life; seal rebuilds restore full operating pressure at 20% of new equipment cost.',
  true
),
-- Machine Tooling & Tungsten Carbide Inserts
(
  'carbide insert|toolholder|endmill|drill bit|tool steel|hss|cutting tool|milling insert',
  'unavoidable_organic',
  'material_recovery',
  'Collect in segregated tungsten carbide scrap canisters; send to specialized zinc-process or acid digestion recycling refiners.',
  'Spent carbide milling inserts contain 90%+ tungsten carbide (WC) and cobalt binder, yielding high scrap value and conserving critical tungsten reserves.',
  true
),
-- Structural Aluminum Extrusions & T-Slot
(
  'aluminum extrusion|structural aluminum|t-slot|6061|6063|aluminum plate|aluminum sheet|billet',
  'edible_reusable',
  'reuse',
  'Inspect for squareness and straightness; remove steel fasteners and chips; square cut ends on cold saw.',
  'Modular 6061/6063 aluminum T-slot extrusions can be immediately repurposed to construct 3D printer frames, robotics testbeds, safety guarding, and workshop tables.',
  true
),
-- Clean Scrap Copper Pipes & Brass
(
  'copper scrap|copper pipe|copper tube|copper bar|brass fitting|bronze bushing|plumbing scrap',
  'unavoidable_organic',
  'material_recovery',
  'Cut away lead solder joints; drain fluids; segregate clean unalloyed copper from yellow brass (Cu-Zn) and bronze (Cu-Sn).',
  'Scrap copper and copper alloys are 100% recyclable without any loss of ductility or thermal/electrical conductivity, serving as premier feedstock for foundries.',
  true
),
-- Stainless Steel (304 / 316) Scrap
(
  'stainless steel|304 stainless|316 stainless|stainless tank|stainless pipe|ferritic stainless',
  'unavoidable_organic',
  'material_recovery',
  'Test with magnet to distinguish austenitic (300-series non-magnetic) from 400-series; degrease and shear into furnace-ready charging sizes.',
  'Stainless steel scrap provides essential recycled chromium (18%) and nickel (8-10%), drastically lowering carbon intensity for stainless steel production.',
  true
),
-- HDPE Industrial Plastics & Drums
(
  'hdpe|high density polyethylene|plastic drum|plastic pallet|pipe scrap|hdpe pipe',
  'unavoidable_organic',
  'material_recovery',
  'Rinse residual chemicals; shred into 8mm flakes; wash in detergent bath and dry; pelletize through single-screw vented extruder.',
  'HDPE retains high tensile impact strength across recycling cycles, producing commercial recycled pellets for underground corrugated drainage pipe and composite plastic lumber.',
  true
),
-- Engineering Thermoplastics (ABS, Polycarbonate, Nylon)
(
  '\babs\b|polycarbonate|nylon|pa6|pa66|teflon|ptfe|polypropylene|engineering plastic|3d print scrap',
  'unavoidable_organic',
  'material_recovery',
  'Keep resin codes strictly segregated; desiccant dry at 80°C to eliminate absorbed atmospheric moisture before extrusion or re-molding.',
  'Engineering polymers (ABS, Nylon, Polycarbonate) can be ground and re-extruded into 3D printer filament or blended with virgin resin for injection-molded enclosures.',
  true
),
-- Automotive Core Remanufacturing (Alternators & Starters)
(
  'alternator|starter motor|ac compressor|power steering pump|caliper core',
  'surplus_redistributable',
  'redistribution',
  'Verify casting housing has no structural cracks; pack in core return crate for remanufacturing supplier deposit return.',
  'Automotive component cores are remanufactured by replacing worn brushes, commutators, and bearings, saving 85% of raw manufacturing material and energy.',
  true
),
-- Crushed Concrete & Masonry Rubble
(
  'concrete|masonry rubble|brick|crushed concrete|demolition rubble|mortar',
  'unavoidable_organic',
  'material_recovery',
  'Run through magnetic overband separator to remove rebar; crush with primary jaw crusher and screen into 20mm/40mm aggregate sizes.',
  'Crushed concrete replaces virgin quarried stone as Department of Transportation approved road sub-base (Class 2 aggregate), reducing quarrying impact.',
  true
),
-- Architectural Plate Glass
(
  'plate glass|architectural glass|window pane|float glass|tempered glass',
  'unavoidable_organic',
  'material_recovery',
  'Separate window frames, rubber gaskets, and sealants; separate clear float glass from tinted glass; collect in sturdy glass bins.',
  'Clean plate glass cullet melts at lower furnace temperatures than raw sand and soda ash, reducing glass manufacturing energy and producing fiberglass insulation.',
  true
);
